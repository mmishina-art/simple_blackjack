import { backdropHtml } from './art';
import { enemyArtHtml } from './enemyArt';

type Anim = 'hurt' | 'attack' | 'defeated';

/** 敵モンスターの表示とアニメーション。 */
export class EnemyView {
  readonly el = document.createElement('div');
  private sprite = document.createElement('div');

  constructor(enemyId: string, stage = 1) {
    this.el.className = 'enemy-stage';
    this.el.dataset.stage = String(stage); // 階層ごとに背景の色合いが変わる（CSS）
    this.sprite.className = 'enemy-sprite';
    this.sprite.innerHTML = enemyArtHtml(enemyId) || enemyArtHtml('slime');
    const backdrop = document.createElement('div');
    backdrop.className = 'enemy-backdrop';
    const bd = backdropHtml(stage);
    backdrop.innerHTML = bd.html;
    if (bd.image) backdrop.classList.add('enemy-backdrop--image');
    this.el.append(backdrop, this.sprite);
  }

  play(anim: Anim): void {
    this.sprite.classList.remove('is-hurt', 'is-attack');
    void this.sprite.offsetWidth; // アニメーション再始動
    if (anim === 'defeated') this.sprite.classList.add('is-defeated');
    else this.sprite.classList.add(anim === 'hurt' ? 'is-hurt' : 'is-attack');
  }

  floatText(text: string, kind: FloatKind = 'damage', note = ''): void {
    floatText(this.el, text, kind, note);
  }
}

export type FloatKind = 'damage' | 'heal' | 'block' | 'skill';

/** 数字が浮かび上がる演出。kind で色が変わる（damage=ダメージ / heal=回復 / block=ブロック・防御 / skill=スキル名）。note は数字の下に添える内訳。 */
export function floatText(parent: HTMLElement, text: string, kind: FloatKind = 'damage', note = ''): void {
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

/**
 * 効果の画面演出（その場が光る）。block=ブロックを得た（青い盾の光）/ heal=回復（緑の光とささやかな粒）/ guard=攻撃をブロックが防いだ（白青の火花）/ break=ブロックを破壊した（金と橙の砕け散る光）。
 * 親は position: relative であること。アニメーションが終わると自動で消える。
 */
export function playFx(parent: HTMLElement, kind: 'block' | 'heal' | 'guard' | 'break'): void {
  const el = document.createElement('div');
  el.className = `fx fx--${kind}`;
  el.setAttribute('aria-hidden', 'true');
  parent.append(el);
  el.addEventListener('animationend', () => el.remove());
  window.setTimeout(() => el.remove(), 1200); // アニメーションなし（動きを減らす設定）でも消える
}
