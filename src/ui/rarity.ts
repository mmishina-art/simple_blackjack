import { RARITY_LABEL, type Rarity } from '../core/rarity';

export const rarityClass = (r: Rarity | undefined): string => `rar-${r ?? 'common'}`;

/** レア度のバッジ要素（コモン / レア / レジェンド）。 */
export function rarityBadge(r: Rarity | undefined): string {
  const rarity = r ?? 'common';
  return `<span class="rar-badge rar-badge--${rarity}">${RARITY_LABEL[rarity]}</span>`;
}
