/** ブロックのマーク: 多角形（六角形）のバリア。外枠と内側の六角形を、線でつないだ結晶のような形。 */
const BARRIER_ICON = '<svg class="block-chip__icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,1.5 21.1,6.75 21.1,17.25 12,22.5 2.9,17.25 2.9,6.75" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><polygon points="12,7 16.4,9.5 16.4,14.5 12,17 7.6,14.5 7.6,9.5" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M12 1.5V7M21.1 6.75 16.4 9.5M21.1 17.25 16.4 14.5M12 22.5V17M2.9 17.25 7.6 14.5M2.9 6.75 7.6 9.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.8"/></svg>';

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
