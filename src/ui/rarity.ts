import { RARITY_LABEL, type Rarity } from '../core/rarity';

export const rarityClass = (r: Rarity | undefined): string => `rar-${r ?? 'common'}`;

/** レア度のバッジ要素（コモン / レア / レジェンド）。 */
export function rarityBadge(r: Rarity | undefined): string {
  const rarity = r ?? 'common';
  return `<span class="rar-badge rar-badge--${rarity}">${RARITY_LABEL[rarity]}</span>`;
}

/**
 * 一覧（報酬・宝箱・ショップ・選択シート・図鑑など）でのレア度。見た目は色（枠・アイコン）だけで示し、文字の札は出さない。
 * 読み上げ用に、見えない文字でレア度を添える（色だけで伝えないため）。札つきの表示は、説明のポップアップ（rarityBadge）だけ。
 */
export function rarityNote(r: Rarity | undefined): string {
  return `<span class="sr-only">（${RARITY_LABEL[r ?? 'common']}）</span>`;
}
