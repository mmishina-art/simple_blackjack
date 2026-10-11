import { decideInitiative } from '../../rules/initiative';
import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 行動順の決定: 合計値の大きい方が先攻。バースト側はスキルが発動しない。 */
export class InitiativeState implements BattleState {
  readonly id = 'Initiative' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, enemy, rules } = ctx;
    enemy.hand.revealAll();
    ctx.notify();

    const playerTotal = player.hand.total(rules);
    const enemyTotal = enemy.hand.total(rules);
    const playerBust = player.hand.isBust(rules);
    const enemyBust = enemy.hand.isBust(rules);
    const decided = decideInitiative({
      playerTotal, enemyTotal, playerBust, enemyBust,
      playerSurrendered: ctx.playerSurrendered,
    });
    const { turn } = ctx.bus.emit('onInitiativeDecided', { turn: decided, playerTotal, enemyTotal, playerBust, enemyBust });
    ctx.turn = turn;

    ctx.log(`${player.name} ${ctx.playerSurrendered ? '防御' : playerBust ? 'BUST' : playerTotal}  vs  ${enemy.name} ${enemyBust ? 'BUST' : enemyTotal}`);
    switch (turn.mode) {
      case 'none':
        ctx.log('両者バースト！ 誰も行動できない');
        break;
      case 'bustSkip': {
        const bust = turn.first === 'player' ? enemy : player;
        ctx.log(`${bust.name}はバースト！ スキルは発動しない。${ctx.entityOf(turn.first!).name}だけが行動する`);
        break;
      }
      case 'defend':
        ctx.log(`${enemy.name}の行動（あなたのスキルは発動しない）`);
        break;
      case 'simultaneous':
        ctx.log('同値！ 両者が同時に行動する');
        break;
      case 'sequential':
        ctx.log(`${ctx.entityOf(turn.first!).name}が先攻！`);
        break;
    }
    await ctx.wait(900);
    return turn.mode === 'none' ? 'CheckDeath' : 'FirstAction';
  }
}
