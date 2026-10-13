import type { EventBus } from '../events/EventBus';
import type { Entity } from '../entities/Entity';
import { damageTakenMultiplier } from '../rules/bust';
import type { RuleSet } from '../rules/RuleSet';
import { attackValue, getSkill, slotKeyOf, supportValue, type SkillDef } from './Skill';

export interface PreviewPart {
  type: 'attack' | 'block' | 'heal';
  /** 値（攻撃はレリック・特性・相手のバーストによる補正後、相手の Block 吸収前）。 */
  value: number;
}

export interface SkillPreview {
  skill: SkillDef | null;
  parts: PreviewPart[];
}

/**
 * 現在の合計値で発動するスキルの予測（副作用なし）。
 * 実際の発動と同じフック（onSkillActivated / onDamageCalculated / onBlockGained / onHealed）を通すので、
 * レリック・敵の特性による補正も反映される。
 */
export function previewSkill(env: { bus: EventBus; rules: RuleSet }, user: Entity, target: Entity, total: number): SkillPreview {
  const base = getSkill(user.slots[slotKeyOf(total)] ?? user.fallbackSkill);
  const skill = env.bus.emit('onSkillActivated', { user, skill: base }).skill;
  if (!skill) return { skill: null, parts: [] };

  const parts: PreviewPart[] = skill.effects.map((e): PreviewPart => {
    if (e.type === 'attack') {
      const raw = attackValue(e, user.attackAt(total));
      const calc = env.bus.emit('onDamageCalculated', { attacker: user, defender: target, damage: raw, skill });
      return { type: 'attack', value: Math.max(0, Math.floor(calc.damage * damageTakenMultiplier(calc.defender, env.rules))) };
    }
    const amount = supportValue(e, user.attackAt(total));
    if (e.type === 'block') return { type: 'block', value: Math.max(0, Math.floor(env.bus.emit('onBlockGained', { entity: user, amount }).amount)) };
    return { type: 'heal', value: Math.max(0, Math.floor(env.bus.emit('onHealed', { entity: user, amount }).amount)) };
  });
  return { skill, parts };
}

/** スロット表の各マスに添える効果の短い表示。攻撃=ダメージ数 / 回復=+回復数 / Block=B+数。 */
export function badgeText(part: PreviewPart): string {
  return part.type === 'attack' ? String(part.value) : part.type === 'heal' ? `+${part.value}` : `B${part.value}`;
}

/** 全スロットの予測（スロット表に効果を出すため）。previewSkill と同じフックを通すので、レリック・特性・相手のバーストも反映される。 */
export function previewAllSlots(env: { bus: EventBus; rules: RuleSet }, user: Entity, target: Entity, keys: readonly number[]): Map<number, PreviewPart[]> {
  return new Map(keys.map((k) => [k, previewSkill(env, user, target, k).parts]));
}

/** 「大攻撃 → 10ダメージ」のような表示用テキスト。 */
/** nameOverride: スロット未設定（通常攻撃）のときの表示名など。 */
export function formatPreview(p: SkillPreview, targetBlock = 0, nameOverride?: string): string {
  if (!p.skill) return '不発（スキルが発動しない）';
  const bits = p.parts.map((part) => {
    if (part.type === 'block') return `Block +${part.value}`;
    if (part.type === 'heal') return `HP +${part.value}`;
    const absorbed = targetBlock > 0 ? `（Block吸収後 ${Math.max(0, part.value - targetBlock)}）` : '';
    return `${part.value}ダメージ${absorbed}`;
  });
  return `${nameOverride ?? p.skill.name} → ${bits.join('・')}`;
}
