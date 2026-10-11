import type { Entity } from '../entities/Entity';
import { describeSkill, getSkill, SLOT_KEYS, slotLabel, type SkillDef, type SlotKey } from './Skill';

export interface SlotRow {
  key: SlotKey;
  label: string;
  skill: SkillDef;
  /** スロット未設定で、fallbackSkill（通常攻撃）が発動する行。 */
  isFallback: boolean;
  /** 効果の説明（現在の ATK での実数値つき）。 */
  text: string;
}

/** 合計値スロット表を、各行の発動スキルと実数値つきで一覧にする（敵の技の確認用）。 */
export function describeSlotTable(entity: Entity): SlotRow[] {
  return SLOT_KEYS.map((key) => {
    const id = entity.slots[key];
    const skill = getSkill(id ?? entity.fallbackSkill);
    return { key, label: slotLabel(key), skill, isFallback: !id, text: describeSkill(skill, entity.attack) };
  });
}
