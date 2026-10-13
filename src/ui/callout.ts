import type { Entity } from '../core/entities/Entity';
import type { EventBus } from '../core/events/EventBus';
import type { Rarity } from '../core/rarity';
import type { RuleSet } from '../core/rules/RuleSet';
import { previewSkill, type PreviewPart } from '../core/skills/preview';
import { BASIC_ICON, fallbackLabel, isItem, rarityOfSkill, slotKeyOf } from '../core/skills/Skill';

/** 「いま発動するスキル」の大きな表示（スロット表の下）に必要な内容。 */
export interface Callout {
  name: string;
  icon: string;
  rarity: Rarity;
  parts: readonly PreviewPart[];
  /** 相手のブロック（攻撃がブロックに吸収されたあとの値を添えるため）。 */
  targetBlock: number;
  /** 不発（スキルが発動しない）。 */
  fizzled: boolean;
  /** 道具（効果が基本パワーに関係なく固定）。 */
  item: boolean;
}

export interface FxChip {
  type: PreviewPart['type'];
  /** 大きく出す数字（攻撃=ダメージ数、回復・ブロックは +数）。 */
  main: string;
  /** 数字の横の単位。 */
  unit: string;
  /** 補足（攻撃がブロックに吸収されたあとの値。ブロックを無視する攻撃は「ブロック無視」）。 */
  note?: string;
}

/** 効果の並びを、画面に出すチップにする。 */
export function fxChips(parts: readonly PreviewPart[], targetBlock: number): FxChip[] {
  return parts.map((part): FxChip => {
    if (part.type === 'attack') {
      const note = part.pierce ? (targetBlock > 0 ? `ブロック ${targetBlock} を破壊` : 'ブロック無視') : targetBlock > 0 ? `ブロック吸収後 ${Math.max(0, part.value - targetBlock)}` : undefined;
      return { type: 'attack', main: String(part.value), unit: 'ダメージ', note };
    }
    return part.type === 'heal'
      ? { type: 'heal', main: `+${part.value}`, unit: 'HP' }
      : { type: 'block', main: `+${part.value}`, unit: 'ブロック' };
  });
}

/**
 * 現在の合計値で発動するスキルの表示内容（レリック・特性・相手のバーストを反映した予測）。
 * 手札が空・バーストのときは null（そのときは別の文言を出す）。空きスロットは「通常攻撃」と明記する。
 */
export function calloutOf(env: { bus: EventBus; rules: RuleSet }, user: Entity, target: Entity): Callout | null {
  const total = user.hand.total(env.rules);
  if (user.hand.size === 0 || total > env.rules.bustLimit) return null;
  const p = previewSkill(env, user, target, total);
  if (!p.skill) return { name: '不発', icon: '×', rarity: 'common', parts: [], targetBlock: target.block, fizzled: true, item: false };
  const empty = !user.slots[slotKeyOf(total)];
  const fallback = empty && p.skill.id === user.fallbackSkill;
  return {
    name: fallback ? fallbackLabel(p.skill) : p.skill.name,
    icon: empty ? BASIC_ICON : p.skill.icon,
    rarity: rarityOfSkill(p.skill),
    parts: p.parts,
    targetBlock: target.block,
    fizzled: false,
    item: isItem(p.skill),
  };
}
