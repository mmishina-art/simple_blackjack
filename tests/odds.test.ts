import { describe, expect, it } from 'vitest';
import { makeCard } from '../src/core/cards/Card';
import { Deck } from '../src/core/cards/Deck';
import { Hand } from '../src/core/cards/Hand';
import { drawOdds, formatPercent } from '../src/core/cards/odds';
import { createRuleSet } from '../src/core/rules/RuleSet';
import { seededRng } from '../src/core/util/Rng';

const rules = createRuleSet();
const hand = (...ranks: Parameters<typeof makeCard>[0][]): Hand => {
  const h = new Hand();
  ranks.forEach((r) => h.add(makeCard(r, 'S')));
  return h;
};

describe('次のカードのバースト・21 の確率', () => {
  it('新しい山札（52枚）: 手札 10+6=16 なら、6 以上でバースト・5 で 21', () => {
    const deck = new Deck(seededRng(1));
    const odds = drawOdds(deck, hand('10', '6'), new Hand(), rules)!;
    // 6〜10・J・Q・K（10 は 4 枚ずつ 4 種 = 16 枚）… 6,7,8,9 が各4 + 10値16 = 32 枚でバースト、5 が4枚で 21
    expect(odds.bust).toBeCloseTo(32 / 52);
    expect(odds.blackjack).toBeCloseTo(4 / 52);
  });

  it('A は 11 として数えるので、手札 A+9 に 2 を引くと 12、バーストは10・J・Q・K ではなく起きない', () => {
    const odds = drawOdds(new Deck(seededRng(1)), hand('A', '9'), new Hand(), rules)!;
    expect(odds.bust).toBe(0);
    expect(odds.blackjack).toBeCloseTo(4 / 52); // A+9+A = 21（A を 1 として数える: 1+9+11=21）
  });

  it('山札と敵の伏せカードを合わせた集合から数える（伏せカードが何でも、確率は変わらない）', () => {
    const rng = seededRng(7);
    const deck = new Deck(rng);
    const enemy = new Hand();
    enemy.add(deck.draw());
    enemy.add(deck.draw(), { faceDown: true });
    const a = drawOdds(deck, hand('10', '6'), enemy, rules)!;
    // 敵の2枚のうち公開の1枚だけ除かれた 51 枚から数える
    const visible = enemy.cards.find((c) => !enemy.isFaceDown(c))!;
    const all = new Deck(seededRng(1)).contents.filter((c) => !(c.rank === visible.rank && c.suit === visible.suit));
    const bust = all.filter((c) => Hand.totalOf([...hand('10', '6').cards, c], rules) > 21).length / all.length;
    expect(a.bust).toBeCloseTo(bust);
  });

  it('見えていないカードがなければ null', () => {
    const deck = new Deck(seededRng(1));
    while (deck.remaining > 0) deck.draw();
    expect(drawOdds(deck, hand('10'), new Hand(), rules)).toBeNull();
  });

  it('表示の丸め', () => {
    expect(formatPercent(0.3077)).toBe('31%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.003)).toBe('<1%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.997)).toBe('>99%');
  });
});
