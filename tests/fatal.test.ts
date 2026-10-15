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

describe('敵の危険な合計値', () => {
  it('どの敵も、止まりうる合計値のどこかに危険がある', () => {
    for (const def of ENEMY_LINEUP) expect(reachable(def).some(([, id]) => getSkill(id).fatal), def.id).toBe(true);
  });
  it('危険は一撃が重く（10 以上）、危険でない攻撃より強い（21 は 2 倍する前の値で比べる）', () => {
    for (const def of ENEMY_LINEUP) {
      const rows = reachable(def);
      const fatal = rows.filter(([, id]) => getSkill(id).fatal).map(([, id]) => damage(def, id));
      const normal = rows.filter(([, id]) => !getSkill(id).fatal).map(([, id]) => damage(def, id));
      expect(Math.min(...fatal), def.id).toBeGreaterThanOrEqual(10);
      expect(Math.min(...fatal), def.id).toBeGreaterThan(Math.max(0, ...normal));
    }
  });
  it('危険の場所は敵ごとに違う（大蝙蝠は低い合計値で早く止まる）。21 は危険にしない', () => {
    const bat = ENEMY_LINEUP.find((d) => d.id === 'bat')!;
    expect((bat.ai as { standOn?: number }).standOn).toBe(13);
    expect(getSkill(bat.slots[13]!).fatal).toBe(true);
    for (const def of ENEMY_LINEUP) expect(getSkill(def.slots[21] ?? def.fallbackSkill).fatal, def.id).toBeFalsy();
  });
  it('21 の必殺（2 倍）は、危険の一撃より重い', () => {
    for (const def of ENEMY_LINEUP) {
      const fatal = reachable(def).filter(([, id]) => getSkill(id).fatal).map(([, id]) => damage(def, id));
      expect(damage(def, def.slots[21] ?? def.fallbackSkill) * 2, def.id).toBeGreaterThan(Math.max(...fatal));
    }
  });
  it('危険のスキルは、どれも敵のスロットに置かれている', () => {
    const used = new Set(ENEMY_LINEUP.flatMap((d) => Object.values(d.slots)));
    for (const id of FATAL_SKILLS) expect(used.has(id), id).toBe(true);
  });
  it('画面: スロット表は赤い印（slot--fatal）、一覧は「危険」の文字の札。21 は「必殺」（2 倍した値）', () => {
    expect(readFileSync('src/ui/components/SlotStrip.ts', 'utf8')).toContain("skill?.fatal ? ' slot--fatal' : ''");
    const info = readFileSync('src/ui/components/EnemyInfo.ts', 'utf8');
    expect(info).toContain('<em class="fatal-tag">危険</em>');
    expect(info).toContain('<em class="die-tag" title="21 は攻撃 ${mult21} 倍">必殺</em>');
    expect(info).toContain('`攻撃 ${Number(n) * mult21}`'); // 21 の攻撃は 2 倍した値を出す
    const css = readFileSync('src/ui/styles/main.css', 'utf8');
    // 危険スロットは下地ごと血の赤色で塗り、敵の 21 は赤い下地 + レジェンド色枠
    for (const k of ['.slot.slot--fatal {', '.slot.slot--fatal .slot__val', '.slot.slot--fatal::before', '.lslot--fatal .lslot__desc', '--fatal:', '--die-hi:']) expect(css, k).toContain(k);
    const strip = readFileSync('src/ui/components/SlotStrip.ts', 'utf8');
    expect(strip).toContain("isEnemy21 ? 'legend'");
    expect(info).toContain("is21 ? 'legend'");
    // 敵の 21（必殺）は、危険と同じ赤い下地 + レジェンドの金の枠（危険より上）
    expect(strip).toContain("isEnemy21 && skill?.effects.some((e) => e.type === 'attack') ? ' slot--die' : ''");
    expect(info).toContain("die ? ' lslot--die' : ''");
    for (const k of ['.slot.slot--die {', '.lslot.lslot--die { background', 'border-left: 3px solid var(--rar)']) expect(css, k).toContain(k);
  });
});

describe('敵の技の役割の色: 攻撃はオレンジ、ブロックは青、回復は緑、21 はレジェンド色枠', () => {
  it('効果の種類で色を決める（ブロックを含む = 青、回復を含む = 緑、攻撃だけ = なし）', async () => {
    const { effectTone } = await import('../src/core/skills/look');
    expect(effectTone(getSkill('skel_guard'))).toBe('block');
    expect(effectTone(getSkill('ig_bash'))).toBe('block'); // 攻撃 + ブロック
    expect(effectTone(getSkill('bat_drain'))).toBe('heal'); // 攻撃 + 回復
    expect(effectTone(getSkill('skel_slash'))).toBeNull();
  });
  it('スロット表と一覧に色を付ける（攻撃はオレンジのアイコン、危険スロットは赤色）', () => {
    const strip = readFileSync('src/ui/components/SlotStrip.ts', 'utf8');
    expect(strip).toContain("isEnemy && !isEnemy21 && !skill?.fatal ? effectTone(skill) ?? 'attack' : null");
    expect(readFileSync('src/ui/components/EnemyInfo.ts', 'utf8')).toContain("!is21 && !fatal ? effectTone(row.skill) ?? 'attack' : null");
    const css = readFileSync('src/ui/styles/main.css', 'utf8');
    for (const k of ['.slot.slot--tone-block {', '.slot.slot--tone-heal {', '.lslot--tone-block .lslot__desc', '.lslot--tone-heal .lslot__desc', '.slot.slot--tone-attack .slot__icon', '--tone-attack:']) expect(css, k).toContain(k);
  });
});
