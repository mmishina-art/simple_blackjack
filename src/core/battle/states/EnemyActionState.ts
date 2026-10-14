import type { BattleContext } from '../BattleContext';
import { isBustOrDie } from '../../rules/bust';
import { PACE } from '../pace';
import type { BattleState, StateId } from '../types';

/**
 * 敵は先に AI に従って引ききり、手札を確定させる。
 * 公開されるのは最後に引いた1枚を除く手札だけ（伏せカードは常に「最後の1枚」）。
 * 新しく引くたびに、直前の伏せカードをめくってから次の1枚を伏せて引く。
 * 伏せカードは行動順の決定（Initiative）まで公開されない。
 */
export class EnemyActionState implements BattleState {
  readonly id = 'EnemyAction' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { enemy, player, rules, enemyDef } = ctx;

    while (!enemy.hand.isBust(rules) && enemyDef.ai.decide(enemy, player, rules) === 'hit') {
      enemy.hand.revealAll();
      ctx.draw(enemy, { faceDown: true });
      await ctx.wait(PACE.enemyHit);
    }

    // バーストしたかどうかも伏せカードが明かすまで分からないので、ログには出さない
    ctx.log(`${enemy.name}は${enemy.hand.size}枚で手札を決めた`);
    // 手札が 21 かバーストなら、どちらかは伏せたまま予告する（21 なら攻撃 2 倍、バーストなら行動できない）
    ctx.bustOrDie = isBustOrDie(enemy, rules);
    if (ctx.bustOrDie) ctx.log(`BUST or DIE ── ${enemy.name}の手は 21 か、バーストか`);
    if (!enemy.hand.isBust(rules)) ctx.bus.emit('onStand', { entity: enemy });
    await ctx.wait(PACE.settle);
    return 'PlayerDeal';
  }
}
