/** ブロックのマーク: 身を包む半円のバリアー（光の膜と、膜の面を示す線）。 */
const BARRIER_ICON = '<svg class="block-chip__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19a9 9 0 0 1 18 0" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 19a5 5 0 0 1 10 0M12 10v9" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/><path d="M4.5 21h15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

export class HpBar {
  readonly el = document.createElement('div');
  private fill = document.createElement('div');
  private label = document.createElement('span');
  private name = document.createElement('span');
  private blockChip = document.createElement('span');
  private left = document.createElement('span');
  private atkChip = document.createElement('span');

  constructor(variant: 'player' | 'enemy') {
    this.el.className = `hpbar hpbar--${variant}`;
    const track = document.createElement('div');
    track.className = 'hpbar__track';
    this.fill.className = 'hpbar__fill';
    track.append(this.fill);
    const row = document.createElement('div');
    row.className = 'hpbar__row';
    this.name.className = 'hpbar__name';
    this.left.className = 'hpbar__left';
    this.left.append(this.name);
    this.label.className = 'hpbar__label';
    this.blockChip.className = 'block-chip';
    this.blockChip.hidden = true;
    this.atkChip.className = 'atk-chip';
    this.atkChip.title = '敵のレベル（LV）= 攻撃するときの平均ダメージ。LV 5 なら、1回の攻撃で約 5 ダメージ';
    const right = document.createElement('span');
    right.className = 'hpbar__right';
    right.append(this.blockChip, this.atkChip, this.label);
    row.append(this.left, right);
    this.el.append(row, track);
  }

  /** 名前の横に要素（レリック等）を添える。 */
  attach(el: HTMLElement): void {
    this.left.append(el);
  }

  update(name: string, hp: number, maxHp: number, block = 0, level?: number): void {
    this.name.textContent = name;
    this.label.textContent = `HP ${hp} / ${maxHp}`;
    this.fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.atkChip.hidden = level === undefined;
    if (level !== undefined) this.atkChip.textContent = `LV ${level}`;
    this.blockChip.hidden = block <= 0;
    this.blockChip.innerHTML = `${BARRIER_ICON}<span>${block}</span>`;
    this.blockChip.setAttribute('aria-label', `ブロック ${block}`);
    this.blockChip.title = `ブロック ${block}`;
  }
}
