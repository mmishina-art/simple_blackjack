import type { EventBus } from '../events/EventBus';
import type { Entity } from '../entities/Entity';
import type { RuleSet } from '../rules/RuleSet';
import { attackValue, getSkill, hasAttack, slotKeyOf, type SkillDef } from './Skill';

export interface PreviewPart {
  type: 'attack' | 'block' | 'heal';
  /** 通常時の値（攻撃はレリック・特性の補正後、敵の Block 吸収前）。 */
  value: number;
  /** 攻撃のクリティカル時の値。 */
  critValue?: number;
}

export interface SkillPreview {
  skill: SkillDef | null;
  /** 発動時にクリティカルになるか（必ず会心・ブラックジャック等）。 */
  crit: boolean;
  parts: PreviewPart[];
}

/**
 * 現在の合計値で発動するスキルの予測（副作用なし）。
 * 実際の発動と同じフック（onSkillActivated / onDamageCalculated / onBlockGained / onHealed）を通すので、
 * レリック・敵の特性による補正も反映される。
 */
export function previewSkill(env: { bus: EventBus; rules: RuleSet }, user: Entity, target: Entity, total: number): SkillPreview {
  const base = getSkill(user.slots[slotKeyOf(total)] ?? user.fallbackSkill);
  const baseCrit = user.hand.isBlackjack(env.rules);
  const activated = env.bus.emit('onSkillActivated', { user, skill: base, crit: baseCrit });
  const skill = activated.skill;
  if (!skill) return { skill: null, crit: false, parts: [] };
  const crit = activated.crit || !!skill.alwaysCrit;

  const damageOf = (raw: number, isCrit: boolean): number =>
    Math.max(0, Math.floor(env.bus.emit('onDamageCalculated', { attacker: user, defender: target, damage: raw, skill, crit: isCrit }).damage));

  const parts: PreviewPart[] = skill.effects.map((e): PreviewPart => {
    if (e.type === 'attack') {
      const raw = attackValue(e, user.attack);
      const critRaw = Math.floor(raw * env.rules.critMultiplier);
      return { type: 'attack', value: damageOf(crit ? critRaw : raw, crit), critValue: damageOf(critRaw, true) };
    }
    if (e.type === 'block') return { type: 'block', value: Math.max(0, Math.floor(env.bus.emit('onBlockGained', { entity: user, amount: e.amount }).amount)) };
    return { type: 'heal', value: Math.max(0, Math.floor(env.bus.emit('onHealed', { entity: user, amount: e.amount }).amount)) };
  });
  return { skill, crit: crit && hasAttack(skill), parts };
}

/** 「大攻撃 → 14ダメージ（会心 21）」のような表示用テキスト。 */
export function formatPreview(p: SkillPreview, targetBlock = 0): string {
  if (!p.skill) return '不発（スキルが発動しない）';
  const bits = p.parts.map((part) => {
    if (part.type === 'block') return `Block +${part.value}`;
    if (part.type === 'heal') return `HP +${part.value}`;
    const absorbed = targetBlock > 0 ? `（Block吸収後 ${Math.max(0, part.value - targetBlock)}）` : '';
    const crit = p.crit ? '（会心）' : part.critValue !== undefined ? `（会心 ${part.critValue}）` : '';
    return `${part.value}ダメージ${crit}${absorbed}`;
  });
  return `${p.skill.name} → ${bits.join('・')}`;
}
