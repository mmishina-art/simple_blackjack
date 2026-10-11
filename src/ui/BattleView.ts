import { audio } from '../audio/AudioManager';
import type { BattleMachine } from '../core/battle/BattleMachine';
import { EnemyView, floatText } from './components/EnemyView';
import { HandView } from './components/HandView';
import { HpBar } from './components/HpBar';

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
    private readonly onRestart: () => void,
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
    this.playerArea = section('player-area', this.playerHand.el, this.playerHp.el);

    this.hitBtn.className = 'btn btn--hit';
    this.hitBtn.textContent = 'Hit';
    this.standBtn.className = 'btn btn--stand';
    this.standBtn.textContent = 'Stand';
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
      machine.bus.on('onResolve', ({ result, damage }) => this.playResolveEffects(result.outcome, damage)),
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

  private playResolveEffects(outcome: 'playerWin' | 'enemyWin' | 'push', damage: number): void {
    if (outcome === 'push' || damage <= 0) return;
    if (outcome === 'playerWin') {
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
    this.roundEl.textContent = ctx.round > 0 ? `ROUND ${ctx.round}` : '';

    // Hit / Stand は PlayerAction で入力待ちのときのみ活性
    const active = this.machine.canAct;
    this.hitBtn.disabled = !active;
    this.standBtn.disabled = !active;

    if (ctx.winner) this.showResult(ctx.winner === ctx.player);
  }

  private showResult(won: boolean): void {
    if (!this.overlay.hidden) return;
    this.overlay.hidden = false;
    this.overlay.innerHTML = '';
    const title = document.createElement('h1');
    title.className = won ? 'overlay__title overlay__title--win' : 'overlay__title overlay__title--lose';
    title.textContent = won ? 'YOU WIN!' : 'YOU LOSE...';
    const again = document.createElement('button');
    again.className = 'btn btn--retry';
    again.textContent = 'もう一度';
    again.addEventListener('click', () => {
      audio.sfx('click');
      this.onRestart();
    });
    this.overlay.append(title, again);
  }
}

function section(cls: string, ...children: HTMLElement[]): HTMLElement {
  const el = document.createElement('section');
  el.className = cls;
  el.append(...children);
  return el;
}
