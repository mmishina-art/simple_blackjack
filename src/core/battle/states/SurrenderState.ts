import type { BattleContext } from '../BattleContext';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/**
 * 防御（サレンダー）: 自分のスキルは発動せず、このラウンドに受けるダメージ（HP の減少）に上限がつく。
 * 上限は装備している防具の値（なければ RuleSet.defendCap）。ブロックは得ない。
 * 敵の手札は確定済みなので、そのまま Initiative へ進み、敵だけが行動する（行動順の比較はなし）。
 */
export class SurrenderState implements BattleState {
  readonly id = 'Surrender' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, rules } = ctx;
    ctx.playerSurrendered = true;
    ctx.bus.emit('onSurrender', { entity: player });
    player.damageCap = player.armorCap ?? rules.defendCap;
    player.capTaken = 0;
    ctx.log(`${player.name}は防御に徹した…（受けるダメージは最大 ${player.damageCap}）`);
    if (player.defendHeal > 0) {
      const { amount } = ctx.bus.emit('onHealed', { entity: player, amount: player.defendHeal, skill: null });
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + Math.max(0, Math.floor(amount)));
      ctx.log(`${player.name}は HP を ${player.hp - before} 回復した`);
      ctx.bus.emit('onHealApplied', { entity: player, amount: player.hp - before });
    }
    ctx.notify();
    await ctx.wait(PACE.surrender);
    return 'Initiative';
  }
}
