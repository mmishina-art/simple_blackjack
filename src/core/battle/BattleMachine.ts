import { Deck } from '../cards/Deck';
import { Entity } from '../entities/Entity';
import { DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS } from '../skills/catalog';
import type { CharacterId, SkillId, SlotTable } from '../skills/Skill';
import type { EnemyDef } from '../entities/enemies/EnemyDef';
import { EventBus } from '../events/EventBus';
import { createRuleSet, type RuleSet } from '../rules/RuleSet';
import { defaultRng, type Rng } from '../util/Rng';
import type { Relic } from '../../relics/Relic';
import type { BattleContext } from './BattleContext';
import { CheckDeathState } from './states/CheckDeathState';
import { FirstActionState, SecondActionState, SurvivalCheckState } from './states/ActionStates';
import { InitiativeState } from './states/InitiativeState';
import { SurrenderState } from './states/SurrenderState';
import { DealState } from './states/DealState';
import { EnemyActionState } from './states/EnemyActionState';
import { InitState } from './states/InitState';
import { PlayerActionState } from './states/PlayerActionState';
import { PlayerDealState } from './states/PlayerDealState';
import { TRANSITIONS, type BattleState, type PlayerInput, type StateId } from './types';

export interface BattleOptions {
  enemy: EnemyDef;
  playerCharacter?: CharacterId;
  playerMaxHp?: number;
  /** 開始時のプレイヤーHP（連戦での持ち越し用）。省略時は最大HP。 */
  playerHp?: number;
  /** プレイヤーの合計値スロット。省略時は仮の初期スロット。 */
  playerSlots?: SlotTable;
  /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
  playerFallback?: SkillId;
  /** プレイヤーの基本パワー（POW）。省略時は初期値。 */
  playerAttack?: number;
  /** 装備している防具の被ダメージ上限（防御したラウンドに効く）。省略時は RuleSet.defendCap。 */
  playerArmorCap?: number;
  /** 装備している防具の反射割合（防御したラウンドに効く）。 */
  playerArmorReflect?: number;
  /** 戦闘開始時にプレイヤーが持つブロック（祭壇の強化）。 */
  playerBlock?: number;
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
    const player = new Entity(
      'player', 'あなた', opts.playerMaxHp ?? 60,
      { ...(opts.playerSlots ?? DEFAULT_PLAYER_SLOTS) }, opts.playerFallback ?? DEFAULT_PLAYER_FALLBACK, opts.playerAttack,
    );
    const enemy = new Entity('enemy', opts.enemy.name, opts.enemy.maxHp, { ...opts.enemy.slots }, opts.enemy.fallbackSkill, opts.enemy.attack);
    player.character = opts.playerCharacter ?? 'warrior';
    player.armorCap = opts.playerArmorCap;
    player.armorReflect = opts.playerArmorReflect ?? (player.character === 'mage' ? 1 : 0);
    player.scaleAttackBySlot = true; // プレイヤーの基本パワーは、スロットごとに変わる（敵は固定）
    player.block = opts.playerBlock ?? 0;
    if (opts.playerHp !== undefined) player.hp = Math.min(opts.playerHp, player.maxHp);
    enemy.weakness = opts.enemy.weakness;
    enemy.attackElement = opts.enemy.attackElement;

    this.ctx = {
      rules,
      bus: this.bus,
      deck: new Deck(rng),
      player,
      enemy,
      enemyDef: opts.enemy,
      round: 0,
      turn: null,
      playerSurrendered: false,
      bustOrDie: false,
      plan: {},
      winner: null,
      debugWin: false,
      entityOf: (id) => (id === 'player' ? player : enemy),
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
      EnemyAction: new EnemyActionState(),
      PlayerDeal: new PlayerDealState(),
      PlayerAction: new PlayerActionState(),
      Initiative: new InitiativeState(),
      FirstAction: new FirstActionState(),
      SurvivalCheck: new SurvivalCheckState(),
      SecondAction: new SecondActionState(),
      Surrender: new SurrenderState(),
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

  /** デバッグ用: すぐに勝つ。入力待ちなら Stand を送り、そのラウンドの終わりの死亡判定で、敵を倒したことにする。 */
  debugWin(): void {
    this.ctx.debugWin = true;
    if (this.canAct) this.submit('stand');
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

  /**
   * 指定ステートから実行を再開する（テスト・リプレイ用）。stopAt のいずれかに到達したら、そのステートに入る前に戻る。
   */
  async runFrom(start: StateId, stopAt: readonly StateId[] = []): Promise<void> {
    let cur: StateId | null = start;
    this._state = start;
    while (cur) {
      const next: StateId | null = await this.states[cur].enter(this.ctx);
      if (!next || stopAt.includes(next)) return;
      this.transition(next);
      cur = next;
    }
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
