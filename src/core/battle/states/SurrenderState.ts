import type { BattleContext } from '../BattleContext';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/**
 * サレンダー: 自分のスキルは発動せず、防御として Block を得る。
 * 敵の手札は確定済みなので、そのまま Initiative へ進み、敵だけが行動する（行動順の比較はなし）。
 */
export class SurrenderState implements BattleState {
  readonly id = 'Surrender' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, rules } = ctx;
    ctx.playerSurrendered = true;
    ctx.bus.emit('onSurrender', { entity: player });
    ctx.log(`${player.name}は防御に徹した…`);
    const { amount } = ctx.bus.emit('onBlockGained', { entity: player, amount: rules.surrenderBlock });
    const gained = Math.max(0, Math.floor(amount));
    player.block += gained;
    ctx.log(`${player.name}は Block を ${gained} 得た`);
    ctx.notify();
    await ctx.wait(PACE.surrender);
    return 'Initiative';
  }
}
