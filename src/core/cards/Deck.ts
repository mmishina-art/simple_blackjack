import { type Card, RANKS, SUITS, makeCard } from './Card';
import type { Rng } from '../util/Rng';

export class Deck {
  private cards: Card[] = [];

  constructor(private readonly rng: Rng) {
    this.reset();
  }

  get remaining(): number {
    return this.cards.length;
  }

  /** 山札に残っているカード（順序は意味を持たない。確率の計算用で、引く順は分からない前提で使う）。 */
  get contents(): readonly Card[] {
    return this.cards;
  }

  /** 52枚を作り直してシャッフルする。 */
  reset(): void {
    this.cards = [];
    for (const suit of SUITS) for (const rank of RANKS) this.cards.push(makeCard(rank, suit));
    this.shuffle();
  }

  /** 場に出ているカードを除いた山札を作り直す（山札枯渇時用）。 */
  resetExcluding(inPlay: readonly Card[]): void {
    this.reset();
    const used = new Set(inPlay.map((c) => c.suit + c.rank));
    this.cards = this.cards.filter((c) => !used.has(c.suit + c.rank));
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card {
    const card = this.cards.pop();
    if (!card) throw new Error('Deck is empty');
    return card;
  }
}
