import { type Card, isAce } from './Card';
import type { RuleSet } from '../rules/RuleSet';

export class Hand {
  private _cards: Card[] = [];
  private faceDown = new Set<Card>();

  get cards(): readonly Card[] {
    return this._cards;
  }

  get size(): number {
    return this._cards.length;
  }

  add(card: Card, opts: { faceDown?: boolean } = {}): void {
    this._cards.push(card);
    if (opts.faceDown) this.faceDown.add(card);
  }

  clear(): void {
    this._cards = [];
    this.faceDown.clear();
  }

  isFaceDown(card: Card): boolean {
    return this.faceDown.has(card);
  }

  get hasHidden(): boolean {
    return this.faceDown.size > 0;
  }

  revealAll(): void {
    this.faceDown.clear();
  }

  /** 合計値。A は「バーストしない範囲で最も有利な方（1 or 11）」に自動計算。 */
  total(rules: RuleSet): number {
    return Hand.totalOf(this._cards, rules);
  }

  /** 公開されているカードのみの合計値（敵の表示用）。 */
  visibleTotal(rules: RuleSet): number {
    return Hand.totalOf(
      this._cards.filter((c) => !this.faceDown.has(c)),
      rules,
    );
  }

  isBust(rules: RuleSet): boolean {
    return this.total(rules) > rules.bustLimit;
  }

  /** 最初の2枚（配牌枚数）で規定スコアに到達していればブラックジャック。 */
  isBlackjack(rules: RuleSet): boolean {
    return this._cards.length === rules.initialCards && this.total(rules) === rules.blackjackScore;
  }

  static totalOf(cards: readonly Card[], rules: RuleSet): number {
    let sum = 0;
    let aces = 0;
    for (const c of cards) {
      sum += c.value;
      if (isAce(c)) aces++;
    }
    // 有利な方 = バーストしない範囲で最大。1枚ずつ 11 に格上げしていく。
    while (aces > 0 && sum + rules.aceBonus <= rules.bustLimit) {
      sum += rules.aceBonus;
      aces--;
    }
    return sum;
  }
}
