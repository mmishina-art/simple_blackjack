import { describe, expect, it } from 'vitest';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Deck } from '../src/core/cards/Deck';
import { Hand } from '../src/core/cards/Hand';
import { computeDamage } from '../src/core/rules/damage';
import { judge } from '../src/core/rules/judge';
import { createRuleSet } from '../src/core/rules/RuleSet';
import { seededRng } from '../src/core/util/Rng';

const rules = createRuleSet();
const hand = (...ranks: Rank[]) => {
  const h = new Hand();
  ranks.forEach((r) => h.add(makeCard(r, 'S')));
  return h;
};

describe('Hand.total', () => {
  it('数字札と絵札', () => {
    expect(hand('2', '9').total(rules)).toBe(11);
    expect(hand('K', 'Q').total(rules)).toBe(20);
  });
  it('A は有利な方（1 or 11）', () => {
    expect(hand('A', '9').total(rules)).toBe(20);
    expect(hand('A', '9', '5').total(rules)).toBe(15);
    expect(hand('A', 'A', '9').total(rules)).toBe(21);
    expect(hand('A', 'K').total(rules)).toBe(21);
  });
  it('バースト判定と bustLimit の変更', () => {
    const h = hand('K', 'Q', '3');
    expect(h.isBust(rules)).toBe(true);
    expect(h.isBust(createRuleSet({ bustLimit: 24 }))).toBe(false);
  });
  it('ブラックジャックは初手2枚のみ', () => {
    expect(hand('A', 'K').isBlackjack(rules)).toBe(true);
    expect(hand('7', '7', '7').isBlackjack(rules)).toBe(false);
  });
  it('伏せカードは visibleTotal に含まれない', () => {
    const h = new Hand();
    h.add(makeCard('5', 'S'));
    h.add(makeCard('K', 'S'), { faceDown: true });
    expect(h.visibleTotal(rules)).toBe(5);
    expect(h.total(rules)).toBe(15);
    h.revealAll();
    expect(h.visibleTotal(rules)).toBe(15);
  });
});

describe('judge / damage', () => {
  it('プレイヤー勝利: プレイヤー合計がダメージ', () => {
    const r = judge(hand('K', '9'), hand('K', '8'), rules);
    expect(r.outcome).toBe('playerWin');
    expect(computeDamage(r, rules)).toMatchObject({ attacker: 'player', damage: 19 });
  });
  it('敵勝利: 敵合計がダメージ', () => {
    const r = judge(hand('K', '6'), hand('K', '8'), rules);
    expect(computeDamage(r, rules)).toMatchObject({ attacker: 'enemy', damage: 18 });
  });
  it('プレイヤーバースト: バースト合計がダメージ', () => {
    const r = judge(hand('K', 'Q', '5'), hand('K', '8'), rules);
    expect(r.playerBust).toBe(true);
    expect(computeDamage(r, rules)).toMatchObject({ attacker: 'enemy', damage: 25 });
  });
  it('敵バースト: プレイヤー勝利', () => {
    const r = judge(hand('K', '2'), hand('K', 'Q', '5'), rules);
    expect(r.outcome).toBe('playerWin');
    expect(computeDamage(r, rules).damage).toBe(12);
  });
  it('同値はプッシュでダメージ0', () => {
    const r = judge(hand('K', '8'), hand('9', '9'), rules);
    expect(r.outcome).toBe('push');
    expect(computeDamage(r, rules)).toMatchObject({ attacker: null, damage: 0 });
  });
  it('ブラックジャック勝利は1.5倍（切り捨て）', () => {
    const r = judge(hand('A', 'K'), hand('K', '9'), rules);
    expect(computeDamage(r, rules)).toMatchObject({ attacker: 'player', damage: 31, blackjackBonus: true });
  });
  it('敵のブラックジャック勝利も1.5倍', () => {
    const r = judge(hand('K', '9'), hand('A', 'Q'), rules);
    expect(computeDamage(r, rules)).toMatchObject({ attacker: 'enemy', damage: 31 });
  });
});

describe('Deck', () => {
  it('52枚で重複なし、シードで再現可能', () => {
    const d = new Deck(seededRng(1));
    const drawn = Array.from({ length: 52 }, () => d.draw());
    expect(new Set(drawn.map((c) => c.suit + c.rank)).size).toBe(52);
    expect(d.remaining).toBe(0);
    expect(() => d.draw()).toThrow();
    const a = new Deck(seededRng(7)).draw();
    const b = new Deck(seededRng(7)).draw();
    expect(a).toEqual(b);
  });
});
