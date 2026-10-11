import { describe, expect, it } from 'vitest';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Deck } from '../src/core/cards/Deck';
import { Hand } from '../src/core/cards/Hand';
import { Entity } from '../src/core/entities/Entity';
import { decideInitiative } from '../src/core/rules/initiative';
import { createRuleSet } from '../src/core/rules/RuleSet';
import { DEFAULT_PLAYER_SLOTS } from '../src/core/skills/catalog';
import { applyDamage, skillForTotal } from '../src/core/skills/execute';
import { slotKeyOf, slotsFromRanges } from '../src/core/skills/Skill';
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
  });
});

describe('Deck', () => {
  it('52枚で重複なし、シードで再現可能', () => {
    const d = new Deck(seededRng(1));
    const drawn = Array.from({ length: 52 }, () => d.draw());
    expect(new Set(drawn.map((c) => c.suit + c.rank)).size).toBe(52);
    expect(() => d.draw()).toThrow();
    expect(new Deck(seededRng(7)).draw()).toEqual(new Deck(seededRng(7)).draw());
  });
});

describe('スロット', () => {
  it('11以下は 11 に、21 より大きい値は 21 に丸める', () => {
    expect(slotKeyOf(2)).toBe(11);
    expect(slotKeyOf(11)).toBe(11);
    expect(slotKeyOf(12)).toBe(12);
    expect(slotKeyOf(21)).toBe(21);
  });
  it('範囲指定でスロット表を作れる（両端を含む）', () => {
    const t = slotsFromRanges([[14, 16, 'a'], [20, 21, 'b']]);
    expect([t[13], t[14], t[16], t[17], t[20], t[21]]).toEqual([undefined, 'a', 'a', undefined, 'b', 'b']);
  });
  it('未設定の合計値は fallbackSkill（基本攻撃）が発動する', () => {
    const e = new Entity('player', 'p', 60, { ...DEFAULT_PLAYER_SLOTS });
    expect(skillForTotal(e, 8).id).toBe('small_attack');
    expect(skillForTotal(e, 15).id).toBe('guard');
    expect(skillForTotal(e, 13).id).toBe('basic_attack');
    expect(skillForTotal(e, 20).id).toBe('big_attack');
    expect(skillForTotal(e, 21).id).toBe('critical_strike');
  });
  it('キャラクターごとに fallbackSkill を変えられる', () => {
    const e = new Entity('player', 'p', 60, {}, 'guard');
    expect(skillForTotal(e, 13).id).toBe('guard');
  });
});

describe('applyDamage / Block', () => {
  it('Block が HP より先に減る', () => {
    const e = new Entity('player', 'p', 60);
    e.block = 6;
    expect(applyDamage(e, 4)).toEqual({ absorbed: 4, hpLoss: 0 });
    expect(e.block).toBe(2);
    expect(e.hp).toBe(60);
    expect(applyDamage(e, 5)).toEqual({ absorbed: 2, hpLoss: 3 });
    expect(e.block).toBe(0);
    expect(e.hp).toBe(57);
  });
  it('piercing は Block を無視する', () => {
    const e = new Entity('player', 'p', 60);
    e.block = 10;
    expect(applyDamage(e, 5, true)).toEqual({ absorbed: 0, hpLoss: 5 });
    expect(e.block).toBe(10);
  });
  it('HP は 0 未満にならない', () => {
    const e = new Entity('player', 'p', 10);
    applyDamage(e, 99);
    expect(e.hp).toBe(0);
  });
});

describe('行動順（decideInitiative）', () => {
  const base = { playerBust: false, enemyBust: false, playerBlackjack: false, enemyBlackjack: false };
  it('大きい方が先攻', () => {
    expect(decideInitiative({ ...base, playerTotal: 20, enemyTotal: 18 })).toMatchObject({ mode: 'sequential', first: 'player', second: 'enemy' });
    expect(decideInitiative({ ...base, playerTotal: 17, enemyTotal: 18 })).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });
  it('同値は同時攻撃', () => {
    expect(decideInitiative({ ...base, playerTotal: 18, enemyTotal: 18 }).mode).toBe('simultaneous');
  });
  it('バーストした側は行動不能、相手が先制クリティカル', () => {
    const t = decideInitiative({ ...base, playerTotal: 25, enemyTotal: 10, playerBust: true });
    expect(t).toMatchObject({ mode: 'bustSkip', first: 'enemy', second: null, crit: { enemy: true, player: false } });
    const u = decideInitiative({ ...base, playerTotal: 10, enemyTotal: 24, enemyBust: true });
    expect(u).toMatchObject({ mode: 'bustSkip', first: 'player', second: null, crit: { player: true, enemy: false } });
  });
  it('両者バーストは誰も行動しない', () => {
    expect(decideInitiative({ ...base, playerTotal: 25, enemyTotal: 24, playerBust: true, enemyBust: true }).mode).toBe('none');
  });
  it('ブラックジャックはその側の行動がクリティカル', () => {
    const t = decideInitiative({ ...base, playerTotal: 21, enemyTotal: 18, playerBlackjack: true });
    expect(t.crit).toEqual({ player: true, enemy: false });
  });
});
