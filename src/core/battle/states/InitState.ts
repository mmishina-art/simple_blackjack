import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 初期化: HP とデッキのセットアップ。 */
export class InitState implements BattleState {
  readonly id = 'Init' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    ctx.enemy.hp = ctx.enemy.maxHp;
    ctx.round = 0;
    ctx.deck.reset();
    ctx.log(`${ctx.enemy.name}があらわれた！`);
    if (ctx.enemyDef.trait) ctx.log(`特性: ${ctx.enemyDef.trait}`);
    ctx.bus.emit('onBattleStart', { player: ctx.player, enemy: ctx.enemy });
    return 'Deal';
  }
}
