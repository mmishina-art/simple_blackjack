import { ENEMY_SPRITES } from './enemySprites';

/**
 * 生成 AI（Gemini）で描いた敵の絵（src/ui/art/enemies/<敵の ID>.webp。tools/art.py で背景を透明にして縮めたもの）。
 * フォルダに置くだけで使われる（ファイル名 = 敵の ID）。画像のない敵（新しく足した敵など）は、手書きの SVG（ENEMY_SPRITES）を使う。
 */
const files = import.meta.glob<string>('../art/enemies/*.webp', { eager: true, query: '?url', import: 'default' });
export const ENEMY_IMAGES: Partial<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.webp$/, '$1'), url]),
);

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
