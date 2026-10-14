import bat from '../art/enemies/bat.webp';
import dragon from '../art/enemies/dragon.webp';
import flame from '../art/enemies/flame.webp';
import gargoyle from '../art/enemies/gargoyle.webp';
import ghoul from '../art/enemies/ghoul.webp';
import golem from '../art/enemies/golem.webp';
import imp from '../art/enemies/imp.webp';
import iron_golem from '../art/enemies/iron_golem.webp';
import knight from '../art/enemies/knight.webp';
import merman from '../art/enemies/merman.webp';
import serpent from '../art/enemies/serpent.webp';
import skeleton from '../art/enemies/skeleton.webp';
import slime from '../art/enemies/slime.webp';
import wraith from '../art/enemies/wraith.webp';
import { ENEMY_SPRITES } from './enemySprites';

/**
 * 生成 AI（Gemini）で描いた敵の絵（src/ui/art/enemies/<敵の ID>.webp。tools/enemy-art.py で背景を透明にして縮めたもの）。
 * いまは 14 体すべてが画像。ここにない敵（新しく足した敵など）は、手書きの SVG（ENEMY_SPRITES）を使う。
 */
export const ENEMY_IMAGES: Partial<Record<string, string>> = {
  slime, skeleton, bat, ghoul, knight, // 第1階層
  merman, gargoyle, wraith, iron_golem, serpent, // 第2階層
  flame, golem, imp, dragon, // 第3階層
};

/** 敵の絵の HTML（画像があれば <img>、なければ SVG）。label を渡すと、読み上げ用の名前を付ける。 */
export function enemyArtHtml(id: string, label = ''): string {
  const img = ENEMY_IMAGES[id];
  if (img) return `<img class="enemy-art" src="${img}" alt="${label}" draggable="false" decoding="async">`;
  return ENEMY_SPRITES[id] ?? '';
}

/** マップのマス（SVG の <image>）に使う絵の URL。 */
export function enemyArtHref(id: string): string | null {
  const img = ENEMY_IMAGES[id];
  if (img) return img;
  const svg = ENEMY_SPRITES[id];
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}` : null;
}
