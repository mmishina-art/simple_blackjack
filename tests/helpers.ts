import { BattleMachine, type BattleOptions } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import type { EnemyDef } from '../src/core/entities/enemies/EnemyDef';
import { Slime } from '../src/core/entities/enemies/Slime';
import type { StateId } from '../src/core/battle/types';
import { seededRng } from '../src/core/util/Rng';
import type { Relic } from '../src/relics/Relic';
import { DEFAULT_PLAYER_SLOTS } from '../src/core/skills/catalog';
import type { SlotTable } from '../src/core/skills/Skill';

export const noWait = async () => {};

/** 守りのスキルを置いた編成（初期装備にはシールド・盾はないので、Block を試すテストで使う）。15 = シールド（Block 6）/ 18 = 盾（Block 11）。 */
export const WITH_BLOCKS: SlotTable = { ...DEFAULT_PLAYER_SLOTS, 15: 'guard', 18: 'shield' };

export interface RoundSetup extends Partial<BattleOptions> {
  player: Rank[];
  enemyHand: Rank[];
  relics?: Relic[];
  enemy?: EnemyDef;
  playerHp?: number;
  enemyHp?: number;
  /** 実行開始ステート（既定: Initiative）。 */
  from?: StateId;
  /** この手前で止める。既定は次ラウンド開始（Deal）の手前。 */
  stopAt?: StateId[];
}

/** 指定した手札でラウンドの後半（行動順〜死亡判定）だけを実行する。 */
export async function playRound(setup: RoundSetup) {
  const { player, enemyHand, from = 'Initiative', stopAt = ['Deal'], enemyHp, ...opts } = setup;
  const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, ...opts });
  player.forEach((r) => m.ctx.player.hand.add(makeCard(r, 'S')));
  enemyHand.forEach((r) => m.ctx.enemy.hand.add(makeCard(r, 'H')));
  if (enemyHp !== undefined) m.ctx.enemy.hp = enemyHp;
  await m.runFrom(from, stopAt);
  return m;
}
