import { activateSkill, applyEffects, runSlotSkill, skillForTotal } from '../../skills/execute';
import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/**
 * 先攻の行動。
 * 同値（simultaneous）の場合は両者分をここで処理する: 防御系 → 攻撃 → （死亡判定は CheckDeath でまとめて）。
 */
export class FirstActionState implements BattleState {
  readonly id = 'FirstAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const turn = ctx.turn!;
    const { player, enemy, rules } = ctx;

    if (turn.mode === 'simultaneous') {
      const plan = [player, enemy].map((user) => {
        const target = user === player ? enemy : player;
        const activated = activateSkill(ctx, user, skillForTotal(user, user.hand.total(rules)));
        return { user, target, activated };
      });
      for (const { user, target, activated } of plan) {
        if (activated) applyEffects(ctx, user, target, activated, 'support');
      }
      await ctx.wait(600);
      for (const { user, target, activated } of plan) {
        if (activated) applyEffects(ctx, user, target, activated, 'attack');
      }
      await ctx.wait(800);
      return 'CheckDeath';
    }

    const first = ctx.entityOf(turn.first!);
    const other = first === player ? enemy : player;
    runSlotSkill(ctx, first, other);
    await ctx.wait(900);
    return turn.second ? 'SurvivalCheck' : 'CheckDeath';
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
    runSlotSkill(ctx, second, other);
    await ctx.wait(900);
    return 'CheckDeath';
  }
}
