/** ブロックのマーク: 六角形が 3 つ寄り合った、蜂の巣のようなバリアーの板（結晶・蜘蛛の巣に見えないよう、放射状の線は使わない）。 */
const BARRIER_ICON = '<svg class="block-chip__icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="12.0,2.2 16.5,4.8 16.5,10.0 12.0,12.6 7.5,10.0 7.5,4.8" fill="currentColor" fill-opacity="0.55" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><polygon points="7.5,10.0 12.0,12.6 12.0,17.8 7.5,20.4 3.0,17.8 3.0,12.6" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><polygon points="16.5,10.0 21.0,12.6 21.0,17.8 16.5,20.4 12.0,17.8 12.0,12.6" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';

export class HpBar {
  readonly el = document.createElement('div');
  private fill = document.createElement('div');
  private label = document.createElement('span');
  private name = document.createElement('span');
  private blockChip = document.createElement('span');
  private left = document.createElement('span');
  private atkChip = document.createElement('span');

  private right = document.createElement('span');

  private topRow?: HTMLElement;
  private topRowLeft?: HTMLElement;
  private topRowRight?: HTMLElement;

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
    this.right.className = 'hpbar__right';
    if (variant === 'enemy') {
      this.topRow = document.createElement('div');
      this.topRow.className = 'hpbar__top';
      this.topRowLeft = document.createElement('span');
      this.topRowLeft.className = 'hpbar__top-left';
      this.topRowRight = document.createElement('span');
      this.topRowRight.className = 'hpbar__top-right';
      this.topRow.append(this.topRowLeft, this.topRowRight);
      this.left.append(this.atkChip);
      this.right.append(this.blockChip, this.label);
      row.append(this.left, this.right);
      this.el.append(this.topRow, row, track);
    } else {
      this.right.append(this.blockChip, this.atkChip, this.label);
      row.append(this.left, this.right);
      this.el.append(row, track);
    }
  }

  /** 名前の前に要素（ラウンド表示等）を添える。敵は上段の左に配置。 */
  prepend(el: HTMLElement): void {
    if (this.topRowLeft) {
      this.topRowLeft.append(el);
    } else {
      this.left.prepend(el);
    }
  }

  /** 名前の横に要素（レリック等）を添える。 */
  attach(el: HTMLElement): void {
    this.left.append(el);
  }

  /** 右端に要素（操作ボタン等）を添える。敵は上段の右に配置。 */
  attachRight(el: HTMLElement): void {
    if (this.topRowRight) {
      this.topRowRight.append(el);
    } else {
      this.right.append(el);
    }
  }

  update(name: string, hp: number, maxHp: number, block = 0, level?: number): void {
    this.name.textContent = name;
    this.label.textContent = `HP ${hp} / ${maxHp}`;
    this.fill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    this.atkChip.hidden = level === undefined;
    if (level !== undefined) this.atkChip.textContent = `Lv.${level}`;
    this.blockChip.hidden = block <= 0;
    this.blockChip.innerHTML = `${BARRIER_ICON}<span>${block}</span>`;
    this.blockChip.setAttribute('aria-label', `ブロック ${block}`);
    this.blockChip.title = `ブロック ${block}`;
  }
}
