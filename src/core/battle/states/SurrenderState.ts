import { applyDamage } from '../../skills/execute';
import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** サレンダー: 自分のスキルも敵のターンも発動せず、固定ダメージ（Block 貫通）を受けてラウンドを終える。 */
export class SurrenderState implements BattleState {
  readonly id = 'Surrender' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, rules } = ctx;
    ctx.bus.emit('onSurrender', { entity: player });
    ctx.log(`${player.name}は撤退した…`);
    const damage = rules.surrenderDamage;
    const { absorbed, hpLoss } = applyDamage(player, damage, true);
    ctx.bus.emit('onDamageDealt', { attacker: null, defender: player, damage, absorbed, hpLoss, skill: null, crit: false });
    ctx.log(`${player.name}に${hpLoss}ダメージ`);
    ctx.notify();
    await ctx.wait(900);
    return 'CheckDeath';
  }
}
