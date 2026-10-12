import { describe, expect, it } from 'vitest';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Deck } from '../src/core/cards/Deck';
import { Hand } from '../src/core/cards/Hand';
import { Entity } from '../src/core/entities/Entity';
import { bustPenaltyText, damageTakenMultiplier } from '../src/core/rules/bust';
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
    expect(skillForTotal(e, 21).id).toBe('ace_strike');
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
  const base = { playerBust: false, enemyBust: false };
  it('大きい方が先攻', () => {
    expect(decideInitiative({ ...base, playerTotal: 20, enemyTotal: 18 })).toMatchObject({ mode: 'sequential', first: 'player', second: 'enemy' });
    expect(decideInitiative({ ...base, playerTotal: 17, enemyTotal: 18 })).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });
  it('同値は同時攻撃', () => {
    expect(decideInitiative({ ...base, playerTotal: 18, enemyTotal: 18 }).mode).toBe('simultaneous');
  });
  it('バーストした側はスキルが発動しない。相手は通常どおり行動する', () => {
    const t = decideInitiative({ ...base, playerTotal: 25, enemyTotal: 10, playerBust: true });
    expect(t).toEqual({ mode: 'bustSkip', first: 'enemy', second: null });
    const u = decideInitiative({ ...base, playerTotal: 10, enemyTotal: 24, enemyBust: true });
    expect(u).toEqual({ mode: 'bustSkip', first: 'player', second: null });
  });
  it('両者バーストは誰も行動しない', () => {
    expect(decideInitiative({ ...base, playerTotal: 25, enemyTotal: 24, playerBust: true, enemyBust: true }).mode).toBe('none');
  });

});

describe('バーストしたときの被ダメージ倍率（damageTakenMultiplier）', () => {
  const entityWith = (...ranks: Rank[]) => {
    const e = new Entity('player', 'p', 10);
    ranks.forEach((r) => e.hand.add(makeCard(r, 'S')));
    return e;
  };

  it('初期値は 1.5 倍。バーストした側だけに掛かる', () => {
    expect(rules.bustDamageMultiplier).toBe(1.5);
    expect(damageTakenMultiplier(entityWith('K', 'Q', '5'), rules)).toBe(1.5);
    expect(damageTakenMultiplier(entityWith('K', 'Q'), rules)).toBe(1);   // 20 はバーストではない
    expect(damageTakenMultiplier(entityWith('A', 'K'), rules)).toBe(1);   // 21 ちょうども等倍
    expect(damageTakenMultiplier(entityWith(), rules)).toBe(1);
  });

  it('倍率と bustLimit は RuleSet で変えられる', () => {
    expect(damageTakenMultiplier(entityWith('K', 'Q', '5'), createRuleSet({ bustDamageMultiplier: 2 }))).toBe(2);
    expect(damageTakenMultiplier(entityWith('K', 'Q', '5'), createRuleSet({ bustDamageMultiplier: 1 }))).toBe(1);
    expect(damageTakenMultiplier(entityWith('K', 'Q', '5'), createRuleSet({ bustLimit: 25 }))).toBe(1);
  });

  it('画面・ログの説明文は倍率に合わせる（等倍なら、スキル不発だけを伝える）', () => {
    expect(bustPenaltyText(rules)).toBe('スキル不発・受けるダメージ1.5倍');
    expect(bustPenaltyText(createRuleSet({ bustDamageMultiplier: 2 }))).toBe('スキル不発・受けるダメージ2倍');
    expect(bustPenaltyText(createRuleSet({ bustDamageMultiplier: 1 }))).toBe('スキル不発');
  });

  it('伏せカードがあるうちは等倍（予測表示が、まだ見えないバーストを漏らさない）', () => {
    const e = entityWith('K', 'Q');
    e.hand.add(makeCard('5', 'S'), { faceDown: true });
    expect(e.hand.isBust(rules)).toBe(true);
    expect(damageTakenMultiplier(e, rules)).toBe(1);
    e.hand.revealAll();
    expect(damageTakenMultiplier(e, rules)).toBe(1.5);
  });
});
