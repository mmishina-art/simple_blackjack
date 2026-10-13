import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/**
 * ラウンド終了処理と死亡判定。ブロックは戦闘中は持ち越される（戦闘終了で消える）。
 * HP が 0 以下ならバトル終了。相打ち（両者 0）はプレイヤー敗北。
 */
export class CheckDeathState implements BattleState {
  readonly id = 'CheckDeath' as const;

  async enter(ctx: BattleContext): Promise<StateId | null> {
    ctx.bus.emit('onRoundEnd', { round: ctx.round });
    ctx.notify();

    if (ctx.debugWin) {
      ctx.enemy.hp = 0;
      if (ctx.player.hp <= 0) ctx.player.hp = 1;
    }
    if (ctx.player.isDead || ctx.enemy.isDead) {
      ctx.winner = ctx.player.isDead ? ctx.enemy : ctx.player;
      ctx.log(ctx.winner === ctx.player ? '勝利！' : '敗北…');
      ctx.bus.emit('onBattleEnd', { winner: ctx.winner });
      return null;
    }
    return 'Deal';
  }
}
