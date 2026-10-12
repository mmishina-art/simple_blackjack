import { ENEMY_SPRITES, STAGE_BACKDROP } from './enemySprites';

type Anim = 'hurt' | 'attack' | 'defeated';

/** 敵モンスターの表示とアニメーション。 */
export class EnemyView {
  readonly el = document.createElement('div');
  private sprite = document.createElement('div');

  constructor(enemyId: string) {
    this.el.className = 'enemy-stage';
    this.sprite.className = 'enemy-sprite';
    this.sprite.innerHTML = ENEMY_SPRITES[enemyId] ?? ENEMY_SPRITES.slime;
    const backdrop = document.createElement('div');
    backdrop.className = 'enemy-backdrop';
    backdrop.innerHTML = STAGE_BACKDROP;
    this.el.append(backdrop, this.sprite);
  }

  play(anim: Anim): void {
    this.sprite.classList.remove('is-hurt', 'is-attack');
    void this.sprite.offsetWidth; // アニメーション再始動
    if (anim === 'defeated') this.sprite.classList.add('is-defeated');
    else this.sprite.classList.add(anim === 'hurt' ? 'is-hurt' : 'is-attack');
  }

  floatText(text: string, kind: 'damage' | 'heal' = 'damage', note = ''): void {
    floatText(this.el, text, kind, note);
  }
}

/** 数字が浮かび上がる演出。note は数字の下に添える内訳（例: Block 5・バースト×1.5）。 */
export function floatText(parent: HTMLElement, text: string, kind: 'damage' | 'heal' = 'damage', note = ''): void {
  const el = document.createElement('div');
  el.className = `float float--${kind}`;
  el.textContent = text;
  if (note) {
    const small = document.createElement('small');
    small.className = 'float__note';
    small.textContent = note;
    el.append(small);
  }
  parent.append(el);
  el.addEventListener('animationend', () => el.remove());
  window.setTimeout(() => el.remove(), 1500);
}
