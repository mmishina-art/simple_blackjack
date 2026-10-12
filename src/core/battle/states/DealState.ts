import type { BattleContext } from '../BattleContext';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/** ラウンド開始: 手札を片付け、敵に初手を配る（1枚目は表、2枚目は伏せ）。プレイヤーへの配牌は敵の手札確定後。 */
export class DealState implements BattleState {
  readonly id = 'Deal' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, enemy, rules, deck } = ctx;
    ctx.round++;
    ctx.turn = null;
    ctx.playerSurrendered = false;
    ctx.plan = {};
    player.hand.clear();
    enemy.hand.clear();
    if (deck.remaining < rules.reshuffleThreshold) {
      deck.reset();
      ctx.log('山札をシャッフルした');
    }
    ctx.bus.emit('onRoundStart', { round: ctx.round });
    ctx.log(`--- ラウンド ${ctx.round} ---`);
    ctx.notify();

    for (let i = 0; i < rules.initialCards; i++) {
      ctx.draw(enemy, { faceDown: i === rules.initialCards - 1 });
      await ctx.wait(PACE.card);
    }
    return 'EnemyAction';
  }
}
