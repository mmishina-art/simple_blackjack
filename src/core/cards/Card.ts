export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
  /**
   * 基本価値。A=1（11 扱いは Hand 側で自動判定）、J/Q/K=10。
   * レリックが onCardDrawn で差し替えることで「引いたカードの数字を変える」を実現できる。
   */
  value: number;
}

export function baseValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, value: baseValue(rank) };
}

export function isAce(card: Card): boolean {
  return card.rank === 'A';
}
