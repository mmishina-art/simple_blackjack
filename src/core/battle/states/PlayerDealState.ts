import type { BattleContext } from '../BattleContext';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/** プレイヤーへの配牌。敵の手札が確定したあとに、初手を配る。 */
export class PlayerDealState implements BattleState {
  readonly id = 'PlayerDeal' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, enemy, rules } = ctx;
    for (let i = 0; i < rules.initialCards; i++) {
      ctx.draw(player);
      await ctx.wait(PACE.card);
    }
    ctx.bus.emit('onDealt', { player, enemy });
    return 'PlayerAction';
  }
}
