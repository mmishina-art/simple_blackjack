import { Deck } from '../cards/Deck';
import { Entity } from '../entities/Entity';
import type { EnemyDef } from '../entities/enemies/EnemyDef';
import { EventBus } from '../events/EventBus';
import { createRuleSet, type RuleSet } from '../rules/RuleSet';
import { defaultRng, type Rng } from '../util/Rng';
import type { Relic } from '../../relics/Relic';
import type { BattleContext } from './BattleContext';
import { CheckDeathState } from './states/CheckDeathState';
import { DealState } from './states/DealState';
import { EnemyActionState } from './states/EnemyActionState';
import { InitState } from './states/InitState';
import { PlayerActionState } from './states/PlayerActionState';
import { ResolveState } from './states/ResolveState';
import { TRANSITIONS, type BattleState, type PlayerInput, type StateId } from './types';

export interface BattleOptions {
  enemy: EnemyDef;
  playerMaxHp?: number;
  /** 開始時のプレイヤーHP（連戦での持ち越し用）。省略時は最大HP。 */
  playerHp?: number;
  rules?: Partial<RuleSet>;
  rng?: Rng;
  relics?: Relic[];
  /** 演出ウェイト。テストでは即時解決する関数を渡す。 */
  pace?: (ms: number) => Promise<void>;
}

type Listener = () => void;
type LogListener = (text: string) => void;

export class BattleMachine {
  readonly bus = new EventBus();
  readonly ctx: BattleContext;
  private readonly states: Record<StateId, BattleState>;
  private _state: StateId | null = null;
  private pendingInput: ((i: PlayerInput) => void) | null = null;
  private changeListeners = new Set<Listener>();
  private logListeners = new Set<LogListener>();
  private _logs: string[] = [];

  constructor(opts: BattleOptions) {
    const rules = createRuleSet(opts.rules);
    const rng = opts.rng ?? defaultRng;
    const pace = opts.pace ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const player = new Entity('player', 'あなた', opts.playerMaxHp ?? 50);
    const enemy = new Entity('enemy', opts.enemy.name, opts.enemy.maxHp);
    if (opts.playerHp !== undefined) player.hp = Math.min(opts.playerHp, player.maxHp);

    this.ctx = {
      rules,
      bus: this.bus,
      deck: new Deck(rng),
      player,
      enemy,
      enemyDef: opts.enemy,
      round: 0,
      lastResult: null,
      lastDamage: null,
      winner: null,
      log: (text) => {
        this._logs.push(text);
        this.logListeners.forEach((l) => l(text));
      },
      notify: () => this.changeListeners.forEach((l) => l()),
      wait: pace,
      waitForInput: () => new Promise<PlayerInput>((resolve) => {
        this.pendingInput = resolve;
        this.ctx.notify();
      }),
      draw: (entity, drawOpts = {}) => {
        const { deck, bus } = this.ctx;
        if (deck.remaining === 0) {
          deck.resetExcluding([...player.hand.cards, ...enemy.hand.cards]);
        }
        const drawn = bus.emit('onCardDrawn', { entity, card: deck.draw() });
        entity.hand.add(drawn.card, drawOpts);
        if (entity.hand.isBust(rules)) bus.emit('onBust', { entity });
        this.ctx.notify();
      },
    };

    this.states = {
      Init: new InitState(),
      Deal: new DealState(),
      PlayerAction: new PlayerActionState(),
      EnemyAction: new EnemyActionState(),
      Resolve: new ResolveState(),
      CheckDeath: new CheckDeathState(),
    };

    const env = { bus: this.bus, rules, player, enemy };
    for (const relic of opts.relics ?? []) relic.apply(env);
    for (const trait of opts.enemy.relics ?? []) trait.apply(env);
  }

  get state(): StateId | null {
    return this._state;
  }

  get logs(): readonly string[] {
    return this._logs;
  }

  /** プレイヤーが入力可能か（Hit / Stand ボタンの活性条件）。 */
  get canAct(): boolean {
    return this._state === 'PlayerAction' && this.pendingInput !== null;
  }

  get isFinished(): boolean {
    return this.ctx.winner !== null;
  }

  onChange(l: Listener): () => void {
    this.changeListeners.add(l);
    return () => this.changeListeners.delete(l);
  }

  onLog(l: LogListener): () => void {
    this.logListeners.add(l);
    return () => this.logListeners.delete(l);
  }

  /** プレイヤー入力。PlayerAction で入力待ちのとき以外は無視される。 */
  submit(input: PlayerInput): boolean {
    if (!this.canAct) return false;
    const resolve = this.pendingInput!;
    this.pendingInput = null;
    this.ctx.notify();
    resolve(input);
    return true;
  }

  /** バトルを最初から最後まで実行する。 */
  async run(): Promise<void> {
    let next: StateId | null = 'Init';
    while (next) {
      this.transition(next);
      next = await this.states[next].enter(this.ctx);
    }
    this.ctx.notify();
  }

  private transition(to: StateId): void {
    const from = this._state ?? 'START';
    if (!TRANSITIONS[from].includes(to)) {
      throw new Error(`Invalid state transition: ${from} -> ${to}`);
    }
    this._state = to;
    this.ctx.notify();
  }
}
