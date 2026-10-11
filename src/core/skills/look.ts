import type { Rarity } from '../rarity';
import { rarityOfSkill, SLOT_MAX, SLOT_MIN, type SkillDef, type SlotKey } from './Skill';

export interface SlotLook {
  /** 11以下・21 の特殊スロット（金の専用の見た目）。 */
  special: boolean;
  /** 通常スロットのレア度（セットされたスキルのレア度。空きはコモン扱い）。特殊スロットでは使わない。 */
  rarity: Rarity;
}

/**
 * スロットの見た目の規則（全画面共通）:
 *  - 11以下・21 は特殊スロット（金）
 *  - それ以外はセットされたスキルのレア度に合わせる。空き（通常攻撃）はコモン扱い
 */
export function slotLook(key: SlotKey, skill: SkillDef | null | undefined): SlotLook {
  return { special: key === SLOT_MIN || key === SLOT_MAX, rarity: skill ? rarityOfSkill(skill) : 'common' };
}
