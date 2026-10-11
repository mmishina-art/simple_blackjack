import { ENEMY_SPRITES } from './enemySprites';

type Anim = 'hurt' | 'attack' | 'defeated';

/** 敵モンスターの表示とアニメーション。 */
export class EnemyView {
  readonly el = document.createElement('div');
  private sprite = document.createElement('div');

  constructor(enemyId: string) {
    this.el.className = 'enemy-stage';
    this.sprite.className = 'enemy-sprite';
    this.sprite.innerHTML = ENEMY_SPRITES[enemyId] ?? ENEMY_SPRITES.slime;
    this.el.append(this.sprite);
  }

  play(anim: Anim): void {
    this.sprite.classList.remove('is-hurt', 'is-attack');
    void this.sprite.offsetWidth; // アニメーション再始動
    if (anim === 'defeated') this.sprite.classList.add('is-defeated');
    else this.sprite.classList.add(anim === 'hurt' ? 'is-hurt' : 'is-attack');
  }

  floatText(text: string, kind: 'damage' | 'heal' = 'damage'): void {
    floatText(this.el, text, kind);
  }
}

export function floatText(parent: HTMLElement, text: string, kind: 'damage' | 'heal' = 'damage'): void {
  const el = document.createElement('div');
  el.className = `float float--${kind}`;
  el.textContent = text;
  parent.append(el);
  el.addEventListener('animationend', () => el.remove());
  window.setTimeout(() => el.remove(), 1500);
}
