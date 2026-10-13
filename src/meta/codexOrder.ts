import type { Rarity } from '../core/rarity';
import { getSkill, rarityOfSkill, type SkillDef, type SkillId } from '../core/skills/Skill';
import { RARITY_ORDER } from '../run/loadout';

/**
 * 図鑑の並び順。レア度の低い順（コモン → レア → レジェンド）。
 * 同じレア度の中は、種類順（攻撃 → ブロック → 回復 → 複合）、同じ種類の中は効果の強さの小さい順。
 * 防具は、被ダメージの上限が大きい（柔らかい）順。
 */

/** 強さの目安に使う POW（スロット15 の値）。 */
const REF_POW = 5;

/** 種類: 0=攻撃のみ / 1=ブロックのみ / 2=回復のみ / 3=複合（効果が複数）。 */
function groupOf(skill: SkillDef): number {
  const types = new Set(skill.effects.map((e) => e.type));
  if (types.size !== 1) return 3;
  const type = [...types][0];
  return type === 'attack' ? 0 : type === 'block' ? 1 : 2;
}

/** 効果の強さの目安（POW 5 のときの合計。2回攻撃などは合算）。 */
function strengthOf(skill: SkillDef): number {
  return skill.effects.reduce((sum, e) => sum + Math.floor(REF_POW * (e.mult ?? 0)) + (e.type === 'attack' ? (e.add ?? 0) : (e.amount ?? 0)), 0);
}

/** 並べ替え用の鍵（小さいほど前）。 */
export function codexKey(id: SkillId): [number, number, number] {
  const skill = getSkill(id);
  if (skill.damageCap !== undefined) return [RARITY_ORDER_ASC(rarityOfSkill(skill)), -skill.damageCap, 0];
  return [RARITY_ORDER_ASC(rarityOfSkill(skill)), groupOf(skill), strengthOf(skill)];
}

/** レア度の低い順の番号（コモン=0, レア=1, レジェンド=2）。 */
export function RARITY_ORDER_ASC(rarity: Rarity): number {
  return 2 - RARITY_ORDER[rarity];
}

/** スキル・道具・防具の id を、図鑑の順に並べる。鍵が同じものは、もとの並びのまま。 */
export function sortSkillsForCodex(ids: readonly SkillId[]): SkillId[] {
  return ids
    .map((id, index) => ({ id, index, key: codexKey(id) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index)
    .map((x) => x.id);
}
