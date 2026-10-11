import { BattleMachine } from '../core/battle/BattleMachine';
import { Slime } from '../core/entities/enemies/Slime';
import { describeSkill, getSkill, type SkillDef, type SlotKey } from '../core/skills/Skill';
import type { RunState } from './Run';

export interface EffectiveSkill {
  /** スロットにセットされている本来のスキル。 */
  base: SkillDef;
  /** レリックを考慮した、実際に発動するスキル。 */
  skill: SkillDef;
  /** レリックを考慮した基本攻撃力。 */
  atk: number;
  /** 本来の説明と、レリック適用後の説明。 */
  baseText: string;
  text: string;
  /** レリックで効果（スキルの中身や基本攻撃力）が上書きされている。 */
  changed: boolean;
}

/**
 * 装備中の各スロットのスキルが、所持レリックでどう上書きされるかを調べる。
 * 実際の戦闘と同じフック（onSkillActivated）を通すので、レリックの追加で自動的に反映される。
 */
export function effectiveSlotSkills(run: RunState): Map<SlotKey, EffectiveSkill> {
  const probe = new BattleMachine({
    enemy: Slime, playerMaxHp: run.maxHp, playerHp: run.hp, playerSlots: run.slots,
    playerFallback: run.fallbackSkill, playerAttack: run.baseAttack, relics: run.relics, pace: async () => {},
  });
  const { player } = probe.ctx;
  const out = new Map<SlotKey, EffectiveSkill>();
  for (const [key, id] of Object.entries(run.slots)) {
    const base = getSkill(id!);
    const skill = probe.bus.emit('onSkillActivated', { user: player, skill: base }).skill ?? base;
    const baseText = describeSkill(base, run.baseAttack);
    const text = describeSkill(skill, player.attack);
    out.set(Number(key), { base, skill, atk: player.attack, baseText, text, changed: text !== baseText || skill.id !== base.id });
  }
  return out;
}
