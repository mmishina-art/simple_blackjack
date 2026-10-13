import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP, BlackDragon } from '../src/core/entities/enemies/catalog';
import { enemyLevel, hitsToDefeat, standDistribution } from '../src/core/entities/enemies/level';

describe('敵のレベル（LV = 攻撃するときの平均ダメージ）', () => {
  it('止まる合計値の確率: N〜21 だけで、合計 1。低い合計ほど起きやすい', () => {
    const d = standDistribution(17);
    expect([...d.keys()].every((t) => t >= 17 && t <= 21)).toBe(true);
    expect([...d.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(d.get(17)!).toBeGreaterThan(d.get(21)!);
  });

  it('LV は 1 以上の整数で、敵の強さの順（黒竜が最大）。竜の息吹の +3 も含む', () => {
    const levels = ENEMY_LINEUP.map((e) => enemyLevel(e));
    for (const lv of levels) expect(Number.isInteger(lv) && lv >= 1).toBe(true);
    expect(enemyLevel(BlackDragon)).toBe(Math.max(...levels));
    expect(enemyLevel({ ...BlackDragon, attackBonus: 0 })).toBeLessThan(enemyLevel(BlackDragon));
  });

  it('弱い敵ほど LV が低い（スライム < 黒竜）', () => {
    expect(enemyLevel(ENEMY_LINEUP[0])).toBeLessThan(enemyLevel(BlackDragon));
  });

  it('倒れるまでの回数: HP 30・LV 5 なら 6 回', () => {
    expect(hitsToDefeat(30, 5)).toBe(6);
    expect(hitsToDefeat(31, 5)).toBe(7);
    expect(hitsToDefeat(1, 99)).toBe(1);
  });
});
