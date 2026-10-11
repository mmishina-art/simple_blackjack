import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 初期化: HP とデッキのセットアップ。 */
export class InitState implements BattleState {
  readonly id = 'Init' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    ctx.player.hp = ctx.player.maxHp;
    ctx.enemy.hp = ctx.enemy.maxHp;
    ctx.round = 0;
    ctx.deck.reset();
    ctx.log(`${ctx.enemy.name} があらわれた！`);
    ctx.bus.emit('onBattleStart', { player: ctx.player, enemy: ctx.enemy });
    return 'Deal';
  }
}
