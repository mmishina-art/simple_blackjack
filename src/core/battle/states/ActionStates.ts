import { activateSkill, applyEffects, skillForTotal } from '../../skills/execute';
import type { BattleContext } from '../BattleContext';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/**
 * 先攻の行動。ラウンドの処理順:
 *   1. 両者のスキルを宣言し、**ブロックを先に付与**する（後攻のブロックも先攻の攻撃より前に入る）
 *   2. 先攻の残りの効果（攻撃・回復）→ 生存確認 → 後攻の残りの効果
 * 同値（simultaneous）は、ブロック → 回復 → 攻撃の順に両者分をまとめて処理し、死亡判定は CheckDeath で行う。
 */
export class FirstActionState implements BattleState {
  readonly id = 'FirstAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const turn = ctx.turn!;
    const { player, enemy, rules } = ctx;
    const declare = (user: typeof player) => {
      const skill = activateSkill(ctx, user, skillForTotal(user, user.hand.total(rules)));
      ctx.plan[user.id] = skill;
      return skill;
    };

    if (turn.mode === 'simultaneous') {
      const plan = [player, enemy].map((user) => ({ user, target: user === player ? enemy : player, skill: declare(user) }));
      await ctx.wait(PACE.declare);
      for (const { user, target, skill } of plan) if (skill) await applyEffects(ctx, user, target, skill, 'block');
      for (const { user, target, skill } of plan) if (skill) await applyEffects(ctx, user, target, skill, 'heal');
      for (const { user, target, skill } of plan) if (skill) await applyEffects(ctx, user, target, skill, 'attack');
      return 'CheckDeath';
    }

    const first = ctx.entityOf(turn.first!);
    const other = first === player ? enemy : player;
    const firstSkill = declare(first);

    // 単独行動（バースト・サレンダー）: そのままの順序で処理
    if (!turn.second) {
      await ctx.wait(PACE.declare);
      if (firstSkill) await applyEffects(ctx, first, other, firstSkill, 'all');
      return 'CheckDeath';
    }

    // 通常: 後攻のスキルも宣言し、両者のブロックを先に付与する（効果は1つずつ、間をあけて見せる）
    const secondSkill = declare(other);
    await ctx.wait(PACE.declare);
    if (firstSkill) await applyEffects(ctx, first, other, firstSkill, 'block');
    if (secondSkill) await applyEffects(ctx, other, first, secondSkill, 'block');
    if (firstSkill) await applyEffects(ctx, first, other, firstSkill, 'rest');
    return 'SurvivalCheck';
  }
}

/** 生存確認: 先攻の行動で誰かが倒れていたら、後攻は行動せず戦闘終了へ。 */
export class SurvivalCheckState implements BattleState {
  readonly id = 'SurvivalCheck' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    return ctx.player.isDead || ctx.enemy.isDead ? 'CheckDeath' : 'SecondAction';
  }
}

export class SecondActionState implements BattleState {
  readonly id = 'SecondAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const turn = ctx.turn!;
    const second = ctx.entityOf(turn.second!);
    const other = second === ctx.player ? ctx.enemy : ctx.player;
    if (second.id in ctx.plan) {
      // ブロックは先攻の行動前に付与済み。残り（攻撃・回復）をここで処理する
      const skill = ctx.plan[second.id];
      if (skill) await applyEffects(ctx, second, other, skill, 'rest');
    } else {
      const skill = activateSkill(ctx, second, skillForTotal(second, second.hand.total(ctx.rules)));
      await ctx.wait(PACE.declare);
      if (skill) await applyEffects(ctx, second, other, skill, 'all');
    }
    return 'CheckDeath';
  }
}
