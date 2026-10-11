export class HpBar {
  readonly el = document.createElement('div');
  private fill = document.createElement('div');
  private label = document.createElement('span');
  private name = document.createElement('span');
  private blockChip = document.createElement('span');
  private left = document.createElement('span');

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
    const right = document.createElement('span');
    right.className = 'hpbar__right';
    right.append(this.blockChip, this.label);
    row.append(this.left, right);
    this.el.append(row, track);
  }

  /** 名前の横に要素（レリック等）を添える。 */
  attach(el: HTMLElement): void {
    this.left.append(el);
  }

  update(name: string, hp: number, maxHp: number, block = 0): void {
    this.name.textContent = name;
    this.label.textContent = `HP ${hp} / ${maxHp}`;
    this.fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.blockChip.hidden = block <= 0;
    this.blockChip.textContent = `守 ${block}`;
  }
}
