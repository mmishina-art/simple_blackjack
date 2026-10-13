import type { BattleContext } from '../battle/BattleContext';
import type { Entity } from '../entities/Entity';
import { damageTakenMultiplier } from '../rules/bust';
import { attackValue, getSkill, slotKeyOf, type SkillDef } from './Skill';

/** ダメージ適用。HP より先に Block を減らす。piercing なら Block を無視する。 */
export function applyDamage(target: Entity, amount: number, piercing = false): { absorbed: number; hpLoss: number } {
  const dmg = Math.max(0, Math.floor(amount));
  const absorbed = piercing ? 0 : Math.min(target.block, dmg);
  target.block -= absorbed;
  const hpLoss = dmg - absorbed;
  target.hp = Math.max(0, target.hp - hpLoss);
  return { absorbed, hpLoss };
}

/** 現在の合計値でスロットに入っているスキル。未設定なら fallbackSkill。 */
export function skillForTotal(entity: Entity, total: number): SkillDef {
  return getSkill(entity.slots[slotKeyOf(total)] ?? entity.fallbackSkill);
}

/** スキルの発動宣言（onSkillActivated フック）。不発になった場合は null。 */
export function activateSkill(ctx: BattleContext, user: Entity, skill: SkillDef): SkillDef | null {
  const payload = ctx.bus.emit('onSkillActivated', { user, skill });
  if (!payload.skill) {
    ctx.log(`${user.name}のスキルは不発に終わった`);
    return null;
  }
  ctx.log(`${user.name}の「${payload.skill.name}」`);
  return payload.skill;
}

export type EffectPart = 'block' | 'heal' | 'attack' | 'rest' | 'all';

/**
 * スキルの効果を適用する。
 * part: 'block' = Block のみ / 'heal' = 回復のみ / 'attack' = 攻撃のみ / 'rest' = Block 以外（攻撃・回復）/ 'all' = すべて（効果の記述順）
 */
export function applyEffects(
  ctx: BattleContext,
  user: Entity,
  target: Entity,
  skill: SkillDef,
  part: EffectPart = 'all',
): void {
  const { bus } = ctx;
  for (const effect of skill.effects) {
    // この呼び出しで処理する効果の種類（part による絞り込み）
    const wanted = part === 'all' || part === effect.type || (part === 'rest' && effect.type !== 'block');
    if (!wanted) continue;
    if (effect.type === 'attack') {
      const base = attackValue(effect, user.attackAt(user.hand.total(ctx.rules)));
      const calc = bus.emit('onDamageCalculated', { attacker: user, defender: target, damage: base, skill });
      // バーストした側が受けるダメージは、レリック・特性の補正のあとに増える（そのあと Block が吸収する）
      const mult = damageTakenMultiplier(calc.defender, ctx.rules);
      const damage = Math.max(0, Math.floor(calc.damage * mult));
      const { absorbed, hpLoss } = applyDamage(calc.defender, damage);
      bus.emit('onDamageDealt', { attacker: user, defender: calc.defender, damage, absorbed, hpLoss, skill });
      const burst = mult !== 1 && damage > 0 ? `バースト ×${mult}` : '';
      if (hpLoss > 0 || absorbed === 0) {
        const notes = [absorbed > 0 ? `Block ${absorbed} を消費` : '', burst].filter(Boolean);
        ctx.log(`${calc.defender.name}に${hpLoss}ダメージ${notes.length > 0 ? `（${notes.join('・')}）` : ''}`);
      } else {
        ctx.log(`${calc.defender.name}は Block で防いだ（${[absorbed, burst].filter(Boolean).join('・')}）`);
      }
    } else {
      if (effect.type === 'block') {
        const { amount } = bus.emit('onBlockGained', { entity: user, amount: effect.amount });
        const gained = Math.max(0, Math.floor(amount));
        user.block += gained;
        ctx.log(`${user.name}は Block を ${gained} 得た`);
        bus.emit('onBlockApplied', { entity: user, amount: gained });
      } else {
        const { amount } = bus.emit('onHealed', { entity: user, amount: effect.amount });
        const before = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + Math.max(0, Math.floor(amount)));
        ctx.log(`${user.name}は HP を ${user.hp - before} 回復した`);
        bus.emit('onHealApplied', { entity: user, amount: user.hp - before });
      }
    }
  }
  ctx.notify();
}
