import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 死亡判定: HP が 0 以下ならバトル終了、それ以外は次ラウンドへ。 */
export class CheckDeathState implements BattleState {
  readonly id = 'CheckDeath' as const;

  async enter(ctx: BattleContext): Promise<StateId | null> {
    ctx.bus.emit('onRoundEnd', { round: ctx.round });
    if (ctx.enemy.isDead || ctx.player.isDead) {
      ctx.winner = ctx.enemy.isDead ? ctx.player : ctx.enemy;
      ctx.log(ctx.winner === ctx.player ? 'You Win!' : 'You Lose...');
      ctx.bus.emit('onBattleEnd', { winner: ctx.winner });
      return null;
    }
    return 'Deal';
  }
}
