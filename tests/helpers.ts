import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Slime } from '../src/core/entities/enemies/Slime';
import type { EnemyDef } from '../src/core/entities/enemies/EnemyDef';
import { ResolveState } from '../src/core/battle/states/ResolveState';
import type { Relic } from '../src/relics/Relic';
import { seededRng } from '../src/core/util/Rng';

/** 指定した手札で Resolve を1回だけ実行し、ダメージの結果を返す（レリックの効果検証用）。 */
export async function calcResolve(player: Rank[], enemyHand: Rank[], relics: Relic[], enemy: EnemyDef = Slime) {
  const m = new BattleMachine({ enemy, relics, rng: seededRng(1), pace: async () => {} });
  const { ctx } = m;
  player.forEach((r) => ctx.player.hand.add(makeCard(r, 'S')));
  enemyHand.forEach((r) => ctx.enemy.hand.add(makeCard(r, 'H')));
  let captured: { damage: number; defender: 'player' | 'enemy' | null } = { damage: 0, defender: null };
  m.bus.on('onResolve', ({ damage, defender }) => { captured = { damage, defender: defender?.id ?? null }; }, 100);
  await new ResolveState().enter(ctx);
  return captured;
}
