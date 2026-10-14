import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { FATAL_SKILLS } from '../src/core/skills/catalog';
import { attackValue, getSkill, SLOT_MAX, type SkillId } from '../src/core/skills/Skill';

/** その敵の、止まりうる合計値（standOn〜21）ごとのスキル。 */
const reachable = (def: (typeof ENEMY_LINEUP)[number]): [number, SkillId][] => {
  const standOn = (def.ai as { standOn?: number }).standOn ?? 17;
  const out: [number, SkillId][] = [];
  for (let t = standOn; t <= SLOT_MAX; t++) out.push([t, def.slots[t] ?? def.fallbackSkill]);
  return out;
};
const damage = (def: (typeof ENEMY_LINEUP)[number], id: SkillId): number =>
  getSkill(id).effects.reduce((sum, e) => sum + (e.type === 'attack' ? attackValue(e, def.attack) + (def.attackBonus ?? 0) : 0), 0);

describe('敵の必殺（危険な合計値）', () => {
  it('どの敵も、止まりうる合計値のどこかに必殺がある', () => {
    for (const def of ENEMY_LINEUP) expect(reachable(def).some(([, id]) => getSkill(id).fatal), def.id).toBe(true);
  });
  it('必殺は一撃が重く（10 以上）、必殺でない攻撃より強い', () => {
    for (const def of ENEMY_LINEUP) {
      const rows = reachable(def);
      const fatal = rows.filter(([, id]) => getSkill(id).fatal).map(([, id]) => damage(def, id));
      const normal = rows.filter(([, id]) => !getSkill(id).fatal).map(([, id]) => damage(def, id));
      expect(Math.min(...fatal), def.id).toBeGreaterThanOrEqual(10);
      expect(Math.min(...fatal), def.id).toBeGreaterThan(Math.max(0, ...normal));
    }
  });
  it('必殺の場所は敵ごとに違う（大蝙蝠は低い合計値で早く止まる）', () => {
    const bat = ENEMY_LINEUP.find((d) => d.id === 'bat')!;
    expect((bat.ai as { standOn?: number }).standOn).toBe(13);
    expect(getSkill(bat.slots[13]!).fatal).toBe(true);
    expect(getSkill(bat.slots[21]!).fatal).toBeFalsy();
  });
  it('必殺のスキルは、どれも敵のスロットに置かれている', () => {
    const used = new Set(ENEMY_LINEUP.flatMap((d) => Object.values(d.slots)));
    for (const id of FATAL_SKILLS) expect(used.has(id), id).toBe(true);
  });
  it('画面: スロット表は赤い印（slot--fatal）、一覧は「必殺」の文字の札', () => {
    expect(readFileSync('src/ui/components/SlotStrip.ts', 'utf8')).toContain("skill?.fatal ? ' slot--fatal' : ''");
    const info = readFileSync('src/ui/components/EnemyInfo.ts', 'utf8');
    expect(info).toContain('<em class="fatal-tag">必殺</em>');
    const css = readFileSync('src/ui/styles/main.css', 'utf8');
    for (const k of ['.slot.slot--fatal {', '.slot.slot--fatal::before', '.lslot.lslot--fatal', '--fatal:']) expect(css, k).toContain(k);
  });
});
