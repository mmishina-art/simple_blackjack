import { BattleMachine } from '../core/battle/BattleMachine';
import { Slime } from '../core/entities/enemies/Slime';
import { slotAttack } from '../core/skills/catalog';
import { describeSkill, describeSkillShort, effectTotals, fallbackLabel, getSkill, kindOfSkill, type EffectTotals, type SkillDef, type SkillId, type SkillKind, type SlotKey } from '../core/skills/Skill';
import type { RunState } from './Run';

export interface EffectiveSkill {
  /** スロットにセットされている本来のスキル。 */
  base: SkillDef;
  /** レリックを考慮した、実際に発動するスキル。 */
  skill: SkillDef;
  /** レリックを考慮した基本パワー。 */
  atk: number;
  /** 本来の説明と、レリック適用後の説明。 */
  baseText: string;
  text: string;
  /** レリックで効果（スキルの中身や基本パワー）が上書きされている。 */
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
    const atkBase = slotAttack(run.baseAttack, Number(key));
    const atk = player.attackAt(Number(key));
    const baseText = describeSkill(base, atkBase);
    const text = describeSkill(skill, atk);
    out.set(Number(key), { base, skill, atk, baseText, text, changed: text !== baseText || skill.id !== base.id });
  }
  return out;
}

/** スロットに置いたときの、そのスロットの見え方（レリックの補正後）。ビフォーアフターの表示用。 */
export interface SlotPreview {
  /** 空き（通常攻撃）なら null。 */
  id: SkillId | null;
  name: string;
  icon: string;
  kind: SkillKind;
  /** 種類と値だけの短い表示（例: 攻撃 15）。 */
  short: string;
  /** 計算式つきの表示（例: 攻撃 POW+5＝15）。 */
  formula: string;
  totals: EffectTotals;
  atk: number;
}

/**
 * そのスロットに id を置いたら（null なら空きにしたら）どうなるか。実際の戦闘と同じフックを通すので、レリックの補正も入る。
 * run の中身は変えない。
 */
export function previewSlot(run: RunState, key: SlotKey, id: SkillId | null): SlotPreview {
  const slots = { ...run.slots };
  if (id) slots[key] = id; else delete slots[key];
  const probe = new BattleMachine({
    enemy: Slime, playerMaxHp: run.maxHp, playerHp: run.hp, playerSlots: slots,
    playerFallback: run.fallbackSkill, playerAttack: run.baseAttack, relics: run.relics, pace: async () => {},
  });
  const { player } = probe.ctx;
  const base = getSkill(id ?? run.fallbackSkill);
  const skill = probe.bus.emit('onSkillActivated', { user: player, skill: base }).skill ?? base;
  const atk = player.attackAt(key);
  return {
    id,
    name: id ? skill.name : fallbackLabel(base) + '（空き）',
    icon: id ? skill.icon : '攻',
    kind: id ? kindOfSkill(base) : 'skill',
    short: describeSkillShort(skill, atk),
    formula: describeSkill(skill, atk),
    totals: effectTotals(skill, atk),
    atk,
  };
}
