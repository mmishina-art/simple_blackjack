import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** プレイヤー入力待ち。Hit なら自身へ再突入、Stand なら EnemyAction、バーストなら Initiative、撤退なら Surrender へ。 */
export class PlayerActionState implements BattleState {
  readonly id = 'PlayerAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, rules } = ctx;

    // 配牌直後（初手）のブラックジャックは自動で Stand 扱い
    if (player.hand.isBlackjack(rules)) {
      ctx.log('ブラックジャック！');
      ctx.bus.emit('onStand', { entity: player });
      return 'EnemyAction';
    }

    if (player.hand.size === rules.initialCards) ctx.log('あなたのターン');
    const input = await ctx.waitForInput();

    if (input === 'surrender') return 'Surrender';

    if (input === 'stand') {
      ctx.log('スタンド');
      ctx.bus.emit('onStand', { entity: player });
      return 'EnemyAction';
    }

    ctx.draw(player);
    const card = player.hand.cards[player.hand.size - 1];
    ctx.log(`ヒット: ${card.rank} (合計 ${player.hand.total(rules)})`);
    if (player.hand.isBust(rules)) {
      ctx.log('あなたはバースト！');
      return 'Initiative';
    }
    return 'PlayerAction';
  }
}
