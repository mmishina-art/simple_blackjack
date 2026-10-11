import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 配牌: 双方に2枚ずつ。敵の1枚目は表、2枚目は裏。 */
export class DealState implements BattleState {
  readonly id = 'Deal' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, enemy, rules, deck } = ctx;
    ctx.round++;
    ctx.turn = null;
    ctx.playerSurrendered = false;
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
      ctx.draw(player);
      await ctx.wait(250);
      ctx.draw(enemy, { faceDown: i === 1 });
      await ctx.wait(250);
    }
    ctx.bus.emit('onDealt', { player, enemy });
    return 'PlayerAction';
  }
}
