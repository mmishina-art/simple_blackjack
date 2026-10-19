import type { BattleContext } from '../battle/BattleContext';
import type { Entity } from '../entities/Entity';
import { PACE } from '../battle/pace';
import { damageDealtMultiplier, damageTakenMultiplier } from '../rules/bust';
import { attackValue, ELEMENT_LABEL, getSkill, slotKeyOf, supportValue, type SkillDef } from './Skill';

/** ダメージ適用。HP より先にブロックを減らす。piercing ならブロックを無視する。 */
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
  if (payload.skill.absorbElement) user.activeElement = payload.skill.absorbElement;
  if (payload.skill.absorbAll) user.absorbAllElements = true;
  if (payload.skill.reflect) user.reflectRatio = Math.max(user.reflectRatio, payload.skill.reflect);
  ctx.log(`${user.name}の「${payload.skill.name}」`);
  ctx.bus.emit('onSkillUsed', { user, skill: payload.skill });
  return payload.skill;
}

export type EffectPart = 'block' | 'heal' | 'attack' | 'rest' | 'all';

/**
 * スキルの効果を適用する。効果は1つずつ適用し、そのたびに画面の演出を見せる間（PACE）をあける
 * （どの効果が起きたか分かるように、ブロック → 回復 → 攻撃のように続けて起きても、ひとまとめにしない）。
 * part: 'block' = ブロックのみ / 'heal' = 回復のみ / 'attack' = 攻撃のみ / 'rest' = ブロック 以外（攻撃・回復）/ 'all' = すべて（効果の記述順）
 */
export async function applyEffects(
  ctx: BattleContext,
  user: Entity,
  target: Entity,
  skill: SkillDef,
  part: EffectPart = 'all',
): Promise<void> {
  const { bus } = ctx;
  if (part === 'all' || part === 'block') {
    if (skill.absorbElement) user.activeElement = skill.absorbElement;
    if (skill.absorbAll) user.absorbAllElements = true;
    if (skill.reflect) user.reflectRatio = Math.max(user.reflectRatio, skill.reflect);
  }
  for (const effect of skill.effects) {
    // この呼び出しで処理する効果の種類（part による絞り込み）
    const wanted = part === 'all' || part === effect.type || (part === 'rest' && effect.type !== 'block');
    if (!wanted) continue;
    if (effect.type === 'attack') {
      const elem = effect.element ?? skill.element ?? user.attackElement;
      const base = attackValue(effect, user.attackAt(user.hand.total(ctx.rules)));
      const calc = bus.emit('onDamageCalculated', { attacker: user, defender: target, damage: base, skill });
      const def = calc.defender;
      // 弱点属性（×2、レリックで ×2.5）・敵の 21（×2）・バーストの被ダメージ倍率を掛ける
      const weakMult = elem && def.weakness === elem ? user.weaknessMultiplier : 1;
      const mult21 = damageDealtMultiplier(user, user.hand.total(ctx.rules), ctx.rules);
      const mult = damageTakenMultiplier(def, ctx.rules);
      let damage = Math.max(0, Math.floor(calc.damage * weakMult * mult21 * mult));
      // 反射の元にする値は、敵の 21 の 2 倍を掛ける前のダメージ（2 倍した分は跳ね返さない）
      const damageBefore21 = Math.max(0, Math.floor(calc.damage * weakMult * mult));

      // 属性吸収: 受け手が同じ属性（または全属性吸収）を帯びているなら、ダメージを 0 にして HP を回復する
      const canAbsorb = !!elem && (def.alwaysAbsorbElements || def.absorbAllElements || def.activeElement === elem);
      if (canAbsorb && damage > 0) {
        const healRaw = Math.max(1, Math.floor(damage * 0.5));
        const { amount } = bus.emit('onHealed', { entity: def, amount: healRaw, skill: null });
        const before = def.hp;
        def.hp = Math.min(def.maxHp, def.hp + Math.max(0, Math.floor(amount)));
        const healed = def.hp - before;
        ctx.log(`${def.name}は${ELEMENT_LABEL[elem]}属性を吸収し、HP を ${healed} 回復した！`);
        bus.emit('onHealApplied', { entity: def, amount: healed });
        ctx.notify();
        await ctx.wait(PACE.heal);
        continue;
      }

      // 防御中（防具の上限）: HP の減少が、残りの上限を超えないように軽減する（ブロックが先に吸収する）
      let reduced = 0;
      let reach = Infinity;
      if (def.damageCap !== null) {
        reach = (effect.pierce ? 0 : def.block) + Math.max(0, def.damageCap - def.capTaken);
        if (damage > reach) { reduced = damage - reach; damage = reach; }
      }
      // ブロックを無視する攻撃（会心の一撃）は、ブロックに吸われず、相手のブロックをすべて破壊する
      const broken = effect.pierce ? def.block : 0;
      const { absorbed, hpLoss } = applyDamage(def, damage, !!effect.pierce);
      if (effect.pierce) def.block = 0;
      if (def.damageCap !== null) def.capTaken += hpLoss;
      bus.emit('onDamageDealt', { attacker: user, defender: def, damage, absorbed, hpLoss, broken, reduced, skill });
      if (reduced > 0) ctx.log(`${def.name}の防具が ${reduced} ダメージを防いだ`);
      if (broken > 0) ctx.log(`${def.name}のブロック ${broken} を破壊した`);
      const burst = [
        weakMult !== 1 && damage > 0 ? `弱点 ×${weakMult}` : '',
        mult21 !== 1 && damage > 0 ? `21 ×${mult21}` : '',
        mult !== 1 && damage > 0 ? `バースト ×${mult}` : '',
      ].filter(Boolean).join('・');
      if (hpLoss > 0 || absorbed === 0) {
        const notes = [absorbed > 0 ? `ブロック ${absorbed} を消費` : '', burst].filter(Boolean);
        ctx.log(`${def.name}に${hpLoss}ダメージ${notes.length > 0 ? `（${notes.join('・')}）` : ''}`);
      } else {
        ctx.log(`${def.name}はブロックで防いだ（${[absorbed, burst].filter(Boolean).join('・')}）`);
      }

      // 攻撃の反射（魔導士の防御: 上限を超えた軽減分を反射 / 反射スキル: 敵の攻撃力そのものを反射）。
      // 敵の 21 の一撃は、2 倍する前の値で数える（予告のとき、防御が必ず得にならないように）
      if (def.reflectRatio > 0 && user !== def && !user.isDead) {
        const baseReflect = def.damageCap !== null ? Math.max(0, damageBefore21 - reach) : Math.min(absorbed + hpLoss, damageBefore21);
        const reflected = Math.floor(baseReflect * def.reflectRatio * def.reflectMultiplier);
        if (reflected > 0) {
          const refRes = applyDamage(user, reflected);
          bus.emit('onDamageDealt', { attacker: def, defender: user, damage: reflected, absorbed: refRes.absorbed, hpLoss: refRes.hpLoss, skill: null });
          ctx.log(`反射！${user.name}に${refRes.hpLoss}ダメージを跳ね返した`);
        }
      }
    } else {
      if (effect.type === 'block') {
        const { amount } = bus.emit('onBlockGained', { entity: user, amount: supportValue(effect, user.attackAt(user.hand.total(ctx.rules))), skill });
        const gained = Math.max(0, Math.floor(amount));
        user.block += gained;
        ctx.log(`${user.name}はブロックを ${gained} 得た`);
        bus.emit('onBlockApplied', { entity: user, amount: gained });
      } else {
        const { amount } = bus.emit('onHealed', { entity: user, amount: supportValue(effect, user.attackAt(user.hand.total(ctx.rules))), skill });
        const before = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + Math.max(0, Math.floor(amount)));
        ctx.log(`${user.name}は HP を ${user.hp - before} 回復した`);
        bus.emit('onHealApplied', { entity: user, amount: user.hp - before });
      }
    }
    // 効果を1つ適用するたびに画面を更新し、演出を見せる間をあける
    ctx.notify();
    await ctx.wait(PACE[effect.type]);
  }
}
