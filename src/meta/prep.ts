import { DEFAULT_PLAYER_SLOTS } from '../core/skills/catalog';
import { getSkill, rarityOfSkill, SLOT_KEYS, type SkillId, type SlotKey } from '../core/skills/Skill';
import {
  canCustomize, customCount, selectableStartingSkills, STARTER_SKILLS, startingCapacity, STARTING_SLOT_KEYS, validStartingSkills,
  type MetaState,
} from './Meta';

/** 出撃準備の1スロット分の状態。 */
export interface PrepSlot {
  key: SlotKey;
  /** 初期装備（変更しないときに入るスキル）。空きなら null。 */
  defaultId: SkillId | null;
  /** 変更後のスキル。変更していなければ null。 */
  customId: SkillId | null;
  /** 出撃時に実際に入るスキル（変更後 → なければ初期装備 → なければ空き）。 */
  effectiveId: SkillId | null;
  /** 出撃準備で装備を変えられるスロット（12〜20）か。固定スロット（11以下・21）は false。 */
  editable: boolean;
  /** 今、装備を変えられるか（枠に空きがある、またはすでに変更済み）。 */
  canChange: boolean;
}

export function prepSlots(meta: MetaState): PrepSlot[] {
  const custom = validStartingSkills(meta);
  return SLOT_KEYS.map((key) => {
    const defaultId = DEFAULT_PLAYER_SLOTS[key] ?? null;
    const customId = custom[key] ?? null;
    return {
      key, defaultId, customId, effectiveId: customId ?? defaultId,
      editable: STARTING_SLOT_KEYS.includes(key), canChange: canCustomize(meta, key),
    };
  });
}

const RARITY_ORDER = { legend: 0, rare: 1, common: 2 } as const;

/** 選べるスキルをレア度の高い順に並べる（同じレア度は元の順）。 */
export function sortByRarity(ids: readonly SkillId[]): SkillId[] {
  return ids
    .map((id, index) => ({ id, index, order: RARITY_ORDER[rarityOfSkill(getSkill(id))] }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((x) => x.id);
}

/** 出撃準備で選べるスキル（図鑑に載っているもの）。レア度の高い順。 */
export function prepCandidates(meta: MetaState): SkillId[] {
  return sortByRarity(selectableStartingSkills(meta));
}

/** 指定のスキルが、ほかのどのスロットに入る予定か（key 自身は除く）。 */
export function placedElsewhere(meta: MetaState, id: SkillId, key: SlotKey): SlotKey[] {
  return prepSlots(meta).filter((s) => s.key !== key && s.effectiveId === id).map((s) => s.key);
}

/**
 * 出撃準備で設定できるものがあるか（枠に空きがあり、図鑑に初期スキル以外の選べるスキルが載っている）。
 * タイトルの「出撃準備」に目印を出すために使う。
 */
export function hasUnusedKitOpportunity(meta: MetaState): boolean {
  const extra = selectableStartingSkills(meta).some((id) => !STARTER_SKILLS.includes(id));
  return extra && customCount(meta) < startingCapacity(meta);
}
