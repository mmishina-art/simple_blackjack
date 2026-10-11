import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 敵の自動行動: 伏せカードを公開し、AI に従って引く。 */
export class EnemyActionState implements BattleState {
  readonly id = 'EnemyAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { enemy, player, rules, enemyDef } = ctx;
    ctx.log(`${enemy.name}のターン`);
    await ctx.wait(500);
    enemy.hand.revealAll();
    ctx.notify();
    await ctx.wait(500);

    while (!enemy.hand.isBust(rules) && enemyDef.ai.decide(enemy, player, rules) === 'hit') {
      ctx.draw(enemy);
      ctx.log(`${enemy.name}はヒット (合計 ${enemy.hand.total(rules)})`);
      await ctx.wait(600);
    }

    if (enemy.hand.isBust(rules)) ctx.log(`${enemy.name}がバースト！`);
    else {
      ctx.log(`${enemy.name}はスタンド`);
      ctx.bus.emit('onStand', { entity: enemy });
    }
    return 'Initiative';
  }
}
