import { STAGE_BACKDROP, TITLE_ART } from './enemySprites';

/**
 * 生成 AI（Gemini）で描いた、敵以外の絵（タイトル・戦闘の舞台の背景・場面の挿絵）。tools/art.py で WebP にして、
 * src/ui/art/ に置くだけで使われる。ない絵は、手書きの SVG のまま。
 *  - title.webp … タイトルの絵（背景は透明）
 *  - stages/stage1〜3.webp … 戦闘の舞台の背景（階層ごと。不透明）
 *  場面の挿絵（scenes/<shop・shrine・inn・reward・chest>.webp）は、scenes.ts の buildScene が使う。
 */
const name = (path: string) => path.replace(/^.*\/([^/]+)\.webp$/, '$1');
const toMap = (files: Record<string, string>): Partial<Record<string, string>> => Object.fromEntries(Object.entries(files).map(([p, u]) => [name(p), u]));
const TITLE = Object.values(import.meta.glob<string>('../art/title.webp', { eager: true, query: '?url', import: 'default' }))[0];
const STAGES = toMap(import.meta.glob<string>('../art/stages/*.webp', { eager: true, query: '?url', import: 'default' }));
const MAP_STAGES = toMap(import.meta.glob<string>('../art/maps/*.webp', { eager: true, query: '?url', import: 'default' }));

/** タイトルの絵（画像があれば <img>、なければ SVG）。 */
export function titleArtHtml(): string {
  return TITLE ? '<img class="enemy-art" src="' + TITLE + '" alt="21 を作るエースとキングのカードを持つ骸骨" draggable="false">' : TITLE_ART;
}

/** 戦闘の舞台の背景（階層ごと）。画像があるときは、階層ごとの色の変え方（CSS の filter）を使わない（has-image）。 */
export function backdropHtml(stage = 1): { html: string; image: boolean } {
  const img = STAGES[`stage${stage}`];
  return img ? { html: `<img class="backdrop-art" src="${img}" alt="" draggable="false">`, image: true } : { html: STAGE_BACKDROP, image: false };
}

/** マップ画面の背景（階層ごと）。画像があれば <img>、なければ空。 */
export function mapBackdropHtml(stage = 1): { html: string; image: boolean } {
  const img = MAP_STAGES[`stage${stage}`];
  return img ? { html: `<img class="map-backdrop__art" src="${img}" alt="" draggable="false">`, image: true } : { html: '', image: false };
}

