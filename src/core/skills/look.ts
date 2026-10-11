import type { Rarity } from '../rarity';
import { rarityOfSkill, SLOT_MAX, SLOT_MIN, type SkillDef, type SlotKey } from './Skill';

export interface SlotLook {
  /** 11以下・21 の特殊スロット（専用の見た目）。 */
  special: boolean;
  /** 特殊スロットの色味: 11以下 = 鋼（グレー）、21 = 金。 */
  tone: 'steel' | 'gold' | null;
  /** 通常スロットのレア度（セットされたスキルのレア度。空きはコモン扱い）。特殊スロットでは使わない。 */
  rarity: Rarity;
}

/**
 * スロットの見た目の規則（全画面共通）:
 *  - 11以下は特殊スロット（鋼のグレー）、21 は特殊スロット（金）
 *  - それ以外はセットされたスキルのレア度に合わせる。空き（通常攻撃）はコモン扱い
 */
export function slotLook(key: SlotKey, skill: SkillDef | null | undefined): SlotLook {
  const tone = key === SLOT_MIN ? 'steel' : key === SLOT_MAX ? 'gold' : null;
  return { special: tone !== null, tone, rarity: skill ? rarityOfSkill(skill) : 'common' };
}
