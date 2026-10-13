import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/**
 * プレイヤー入力待ち（敵の手札は確定済み）。
 * Hit なら自身へ再突入。Stand・バーストならそのまま Initiative（即バトル）、防御なら Surrender へ。
 */
export class PlayerActionState implements BattleState {
  readonly id = 'PlayerAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, rules } = ctx;

    // 初手が21（ブラックジャック）でも自動では進めず、ほかの手と同じく入力を待つ
    if (player.hand.size === rules.initialCards) {
      ctx.log(player.hand.isBlackjack(rules) ? 'ブラックジャック！ あなたのターン' : 'あなたのターン');
    }
    const input = await ctx.waitForInput();

    if (input === 'surrender') return 'Surrender';

    if (input === 'stand') {
      ctx.log('スタンド');
      ctx.bus.emit('onStand', { entity: player });
      return 'Initiative';
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
