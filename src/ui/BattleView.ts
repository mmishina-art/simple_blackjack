import type { BattleMachine } from '../core/battle/BattleMachine';
import { HandView } from './components/HandView';
import { HpBar } from './components/HpBar';

/** 縦画面レイアウト: 上=敵 / 中=ログ / 下=プレイヤー / 最下=ボタン。 */
export class BattleView {
  private enemyHp = new HpBar('enemy');
  private playerHp = new HpBar('player');
  private enemyHand = new HandView();
  private playerHand = new HandView();
  private logEl = document.createElement('div');
  private roundEl = document.createElement('div');
  private hitBtn = document.createElement('button');
  private standBtn = document.createElement('button');
  private overlay = document.createElement('div');
  private unsubs: Array<() => void> = [];
  private container: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly machine: BattleMachine,
    private readonly onRestart: () => void,
  ) {
    this.container = document.createElement('main');
    this.container.className = 'battle';

    const enemyArea = section('enemy-area', this.roundEl, this.enemyHp.el, this.enemyHand.el);
    this.roundEl.className = 'round';
    this.logEl.className = 'log';
    this.logEl.setAttribute('aria-live', 'polite');
    const playerArea = section('player-area', this.playerHand.el, this.playerHp.el);

    this.hitBtn.className = 'btn btn--hit';
    this.hitBtn.textContent = 'Hit';
    this.standBtn.className = 'btn btn--stand';
    this.standBtn.textContent = 'Stand';
    const actions = section('actions', this.hitBtn, this.standBtn);
    this.hitBtn.addEventListener('click', () => machine.submit('hit'));
    this.standBtn.addEventListener('click', () => machine.submit('stand'));

    this.overlay.className = 'overlay';
    this.overlay.hidden = true;

    this.container.append(enemyArea, this.logEl, playerArea, actions, this.overlay);
    root.replaceChildren(this.container);

    this.unsubs.push(
      machine.onChange(() => this.render()),
      machine.onLog((text) => this.appendLog(text)),
    );
    this.render();
  }

  destroy(): void {
    this.unsubs.forEach((u) => u());
    this.container.remove();
  }

  private appendLog(text: string): void {
    const line = document.createElement('p');
    line.textContent = text;
    this.logEl.append(line);
    while (this.logEl.childElementCount > 50) this.logEl.firstElementChild?.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
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
    again.addEventListener('click', this.onRestart);
    this.overlay.append(title, again);
  }
}

function section(cls: string, ...children: HTMLElement[]): HTMLElement {
  const el = document.createElement('section');
  el.className = cls;
  el.append(...children);
  return el;
}
