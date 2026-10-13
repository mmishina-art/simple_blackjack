import { describe, expect, it } from 'vitest';
import { ARMOR_POOL, ITEM_POOL, SKILL_POOL } from '../src/core/skills/catalog';
import { getSkill, rarityOfSkill } from '../src/core/skills/Skill';
import { codexKey, sortSkillsForCodex } from '../src/meta/codexOrder';

describe('図鑑の並び順', () => {
  it('レア度の低い順（コモン → レア → レジェンド）', () => {
    const order = sortSkillsForCodex([...SKILL_POOL]).map((id) => rarityOfSkill(getSkill(id)));
    const rank = { common: 0, rare: 1, legend: 2 } as const;
    for (let i = 1; i < order.length; i++) expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
  });

  it('同じレア度の中は、攻撃 → ブロック → 回復 → 複合、同じ種類の中は強さの小さい順', () => {
    // コモン: 攻撃（突き +1 < 斬撃 +3）、ブロック（受け流し +1 < 身構え +3）
    const commons = sortSkillsForCodex([...SKILL_POOL]).filter((id) => rarityOfSkill(getSkill(id)) === 'common');
    expect(commons.indexOf('jab')).toBeLessThan(commons.indexOf('slash'));
    expect(commons.indexOf('slash')).toBeLessThan(commons.indexOf('guard'));
    expect(commons.indexOf('guard')).toBeLessThan(commons.indexOf('shield'));
    expect(commons.indexOf('shield')).toBeLessThan(commons.indexOf('mend'));
  });

  it('バージョンアップの先は、同じ種類の中で、あとに並ぶ（突き → 大攻撃 → 渾身の一撃）', () => {
    const all = sortSkillsForCodex([...SKILL_POOL]);
    expect(all.indexOf('jab')).toBeLessThan(all.indexOf('big_attack'));
    expect(all.indexOf('big_attack')).toBeLessThan(all.indexOf('smash'));
    expect(all.indexOf('guard')).toBeLessThan(all.indexOf('bulwark'));
    expect(all.indexOf('bulwark')).toBeLessThan(all.indexOf('fortress'));
  });

  it('防具は、レア度の低い順 → 被ダメージの上限が大きい（柔らかい）順', () => {
    const sorted = sortSkillsForCodex([...ARMOR_POOL]);
    for (let i = 1; i < sorted.length; i++) {
      const a = codexKey(sorted[i - 1]);
      const b = codexKey(sorted[i]);
      expect(a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])).toBe(true);
    }
  });

  it('道具も、種類順 → 強さ順（同じレア度の中）', () => {
    const items = sortSkillsForCodex([...ITEM_POOL]);
    expect(items.length).toBe(ITEM_POOL.length);
  });
});
