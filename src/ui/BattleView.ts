import { audio } from '../audio/AudioManager';
import type { BattleMachine } from '../core/battle/BattleMachine';
import { EnemyView, floatText } from './components/EnemyView';
import { HandView } from './components/HandView';
import { HpBar } from './components/HpBar';
import { ENEMY_LINEUP } from '../core/entities/enemies/catalog';
import { expForNextLevel, type RunState } from '../run/Run';

/** 縦画面レイアウト: 上=敵 / 中=ログ / 下=プレイヤー / 最下=ボタン。 */
export class BattleView {
  private enemyView: EnemyView;
  private enemyHp = new HpBar('enemy');
  private playerHp = new HpBar('player');
  private enemyHand = new HandView();
  private playerHand = new HandView();
  private logEl = document.createElement('div');
  private roundEl = document.createElement('div');
  private hitBtn = document.createElement('button');
  private standBtn = document.createElement('button');
  private muteBtn = document.createElement('button');
  private overlay = document.createElement('div');
  private playerArea: HTMLElement;
  private unsubs: Array<() => void> = [];
  private container: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly machine: BattleMachine,
    private readonly run: RunState,
    /** 戦闘終了時のオーバーレイ内容を作る（次の画面への遷移はここで行う）。 */
    private readonly buildResult: (won: boolean) => HTMLElement,
  ) {
    this.container = document.createElement('main');
    this.container.className = 'battle';
    this.enemyView = new EnemyView(machine.ctx.enemyDef.id);

    this.roundEl.className = 'round';
    this.muteBtn.className = 'mute';
    this.muteBtn.setAttribute('aria-label', 'サウンドの切り替え');
    this.muteBtn.textContent = '♪';
    this.muteBtn.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      audio.sfx('click');
      this.renderMute();
    });
    const topRow = section('top-row', this.roundEl, this.muteBtn);
    const enemyArea = section('enemy-area', topRow, this.enemyHp.el, this.enemyView.el, this.enemyHand.el);
    this.logEl.className = 'log';
    this.logEl.setAttribute('aria-live', 'polite');
    this.playerArea = section('player-area', this.playerHand.el, this.playerHp.el, this.buildStatusStrip());

    this.hitBtn.className = 'btn btn--hit';
    this.hitBtn.innerHTML = '<span class="btn__main">Hit</span><span class="btn__sub">引く</span>';
    this.standBtn.className = 'btn btn--stand';
    this.standBtn.innerHTML = '<span class="btn__main">Stand</span><span class="btn__sub">勝負</span>';
    const actions = section('actions', this.hitBtn, this.standBtn);
    this.hitBtn.addEventListener('click', () => this.act('hit'));
    this.standBtn.addEventListener('click', () => this.act('stand'));

    this.overlay.className = 'overlay';
    this.overlay.hidden = true;

    this.container.append(enemyArea, this.logEl, this.playerArea, actions, this.overlay);
    root.replaceChildren(this.container);

    this.unsubs.push(
      machine.onChange(() => this.render()),
      machine.onLog((text) => this.appendLog(text)),
      machine.bus.on('onResolve', ({ defender, damage }) => this.playResolveEffects(defender?.id ?? null, damage)),
      machine.bus.on('onBattleEnd', ({ winner }) => {
        if (winner.id === 'player') window.setTimeout(() => this.enemyView.play('defeated'), 300);
      }),
    );
    this.renderMute();
    this.render();
  }

  destroy(): void {
    this.unsubs.forEach((u) => u());
    this.container.remove();
  }

  private act(input: 'hit' | 'stand'): void {
    if (this.machine.submit(input)) audio.sfx('click');
  }

  private playResolveEffects(defender: 'player' | 'enemy' | null, damage: number): void {
    if (!defender || damage <= 0) return;
    if (defender === 'enemy') {
      this.enemyView.play('hurt');
      this.enemyView.floatText(`-${damage}`);
    } else {
      this.enemyView.play('attack');
      floatText(this.playerArea, `-${damage}`);
      this.container.classList.remove('is-flash');
      void this.container.offsetWidth;
      this.container.classList.add('is-flash');
    }
  }

  /** レベル・経験値・所持レリックの表示。 */
  private buildStatusStrip(): HTMLElement {
    const strip = document.createElement('div');
    strip.className = 'status-strip';
    const next = expForNextLevel(this.run.level);
    const lv = document.createElement('span');
    lv.className = 'status-strip__lv';
    lv.textContent = `Lv ${this.run.level}`;
    const exp = document.createElement('span');
    exp.className = 'status-strip__exp';
    exp.textContent = next === null ? 'MAX' : `EXP ${this.run.exp}/${next}`;
    const relics = document.createElement('span');
    relics.className = 'status-strip__relics';
    for (const r of this.run.relics) {
      const chip = document.createElement('span');
      chip.className = 'medal medal--sm';
      chip.textContent = r.icon;
      chip.title = `${r.name}: ${r.description}`;
      relics.append(chip);
    }
    strip.append(lv, exp, relics);
    return strip;
  }

  private appendLog(text: string): void {
    const line = document.createElement('p');
    line.textContent = text;
    this.logEl.append(line);
    while (this.logEl.childElementCount > 50) this.logEl.firstElementChild?.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private renderMute(): void {
    this.muteBtn.classList.toggle('mute--off', audio.muted);
    this.muteBtn.setAttribute('aria-pressed', String(audio.muted));
  }

  private render(): void {
    const { ctx } = this.machine;
    this.enemyHp.update(ctx.enemy.name, ctx.enemy.hp, ctx.enemy.maxHp);
    this.playerHp.update(ctx.player.name, ctx.player.hp, ctx.player.maxHp);
    this.enemyHand.update(ctx.enemy, ctx.rules);
    this.playerHand.update(ctx.player, ctx.rules);
    this.roundEl.textContent =
      ctx.round > 0 ? `STAGE ${this.run.stage + 1}/${ENEMY_LINEUP.length} · ROUND ${ctx.round}` : '';

    // Hit / Stand は PlayerAction で入力待ちのときのみ活性
    const active = this.machine.canAct;
    this.hitBtn.disabled = !active;
    this.standBtn.disabled = !active;

    if (ctx.winner) this.showResult(ctx.winner === ctx.player);
  }

  private showResult(won: boolean): void {
    if (!this.overlay.hidden) return;
    this.overlay.hidden = false;
    this.overlay.replaceChildren(this.buildResult(won));
  }
}

function section(cls: string, ...children: HTMLElement[]): HTMLElement {
  const el = document.createElement('section');
  el.className = cls;
  el.append(...children);
  return el;
}
