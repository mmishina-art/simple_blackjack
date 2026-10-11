import { computeDamage } from '../../rules/damage';
import { judge } from '../../rules/judge';
import type { BattleContext } from '../BattleContext';
import type { BattleState, StateId } from '../types';

/** 判定とダメージ処理。 */
export class ResolveState implements BattleState {
  readonly id = 'Resolve' as const;

  async enter(ctx: BattleContext): Promise<StateId> {
    const { player, enemy, rules } = ctx;
    enemy.hand.revealAll();

    const result = judge(player.hand, enemy.hand, rules);
    const info = computeDamage(result, rules);
    const attacker = info.attacker === 'player' ? player : info.attacker === 'enemy' ? enemy : null;
    const defender = info.attacker === 'player' ? enemy : info.attacker === 'enemy' ? player : null;

    const calc = ctx.bus.emit('onDamageCalculated', { attacker, defender, damage: info.damage, info, result });
    const damage = Math.max(0, Math.floor(calc.damage));
    calc.defender?.takeDamage(damage);

    ctx.lastResult = result;
    ctx.lastDamage = { ...info, damage };

    if (result.outcome === 'push') {
      ctx.log(`引き分け (${result.playerTotal} vs ${result.enemyTotal})`);
      // レリックや特性が引き分けにダメージを与えた場合
      if (calc.defender && damage > 0) ctx.log(`${calc.defender.name}に${damage}ダメージ`);
    } else if (calc.attacker && calc.defender) {
      const bj = info.blackjackBonus ? ` ブラックジャック×${rules.blackjackMultiplier}！` : '';
      ctx.log(`${result.outcome === 'playerWin' ? '勝利' : '敗北'}！${bj} ${calc.defender.name}に${damage}ダメージ`);
    }

    ctx.bus.emit('onResolve', { result, damage, attacker: calc.attacker, defender: calc.defender });
    ctx.notify();
    await ctx.wait(1000);
    return 'CheckDeath';
  }
}
