import type { TileKind } from '../../map/StageMap';

/**
 * マップのマスに出す絵（宝箱・店・祠・宿屋）。-12〜12 の座標で描いた線画で、色は `currentColor`（CSS の `color`）。
 * 敵・ボスは敵の絵、スタートは文字を出すので、ここにはない。
 */
export const TILE_ICONS: Partial<Record<TileKind, string>> = {
  // 宝箱: 丸い蓋・帯・留め金
  chest: `<path d="M-9 -1V-5.5C-9 -9 -5 -10 0 -10S9 -9 9 -5.5V-1Z" fill="currentColor" fill-opacity="0.22"/>
    <rect x="-9" y="-1" width="18" height="10" rx="1" fill="currentColor" fill-opacity="0.12"/>
    <path d="M-9 -1H9M-3.5 -9.6V9M3.5 -9.6V9"/>
    <rect x="-2" y="-3.2" width="4" height="5" rx="0.8" fill="currentColor"/>`,
  // 店: 縞の日よけのある露店（日よけ・柱・台・商品）
  shop: `<path d="M-10 -4L-8 -10H8L10 -4Z" fill="currentColor" fill-opacity="0.25"/>
    <path d="M-10 -4Q-7.5 -1 -5 -4Q-2.5 -1 0 -4Q2.5 -1 5 -4Q7.5 -1 10 -4"/>
    <path d="M-4 -10L-5 -4M0 -10V-4M4 -10L5 -4"/>
    <path d="M-8 -1V9M8 -1V9"/>
    <rect x="-9.5" y="4" width="19" height="3.2" rx="0.6" fill="currentColor" fill-opacity="0.3"/>
    <circle cx="-3.6" cy="1.8" r="2.1" fill="currentColor"/>
    <rect x="1.4" y="0" width="4.4" height="4" rx="0.6" fill="currentColor"/>`,
  // 祠: 屋根・石の本体・灯り
  shrine: `<path d="M-11 -2L0 -10L11 -2Z" fill="currentColor" fill-opacity="0.22"/>
    <path d="M-7 -2V9M7 -2V9M-9.5 9H9.5"/>
    <path d="M0 6.5C-2.6 5 -2.2 2 0 0C2.2 2 2.6 5 0 6.5Z" fill="currentColor"/>`,
  // 宿屋: 寝台と枕、上に月
  inn: `<path d="M-10 -1V9M10 3V9M-10 4H10"/>
    <rect x="-10" y="-1" width="20" height="5" rx="1" fill="currentColor" fill-opacity="0.18"/>
    <rect x="-8.2" y="0.2" width="5" height="2.6" rx="1.2" fill="currentColor"/>
    <path d="M6 -9.5A4 4 0 1 0 9.5 -4.4A3.6 3.6 0 0 1 6 -9.5Z" fill="currentColor"/>`,
};
