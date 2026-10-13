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

/** 守りのスキルを置いた編成（初期装備には受け流し・身構えはないので、ブロックを試すテストで使う）。15 = シールド（ブロック 6）/ 18 = 盾（ブロック 11）。 */
export const WITH_BLOCKS: SlotTable = { ...DEFAULT_PLAYER_SLOTS, 12: 'herb', 15: 'guard', 18: 'shield' }; // 薬草は 12 に置き直す（初期装備の薬草は 15 なので、シールドで上書きされないように）

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

/** 固定スロットを解錠するレリック（製品にはない。解錠の仕組みのテスト用）。 */
export const unlockRelic = (...slots: number[]): Relic => ({ id: `test_unlock_${slots.join('_')}`, name: 'テスト', icon: 'T', description: '', unlocksSlots: slots, apply() {} });

/** スキルの効果を「POW×mult+add」の攻撃に書き換えるレリック（製品にはない。上書きの仕組みのテスト用）。 */
export const reshapeRelic = (skillId: string, mult: number, add: number): Relic => ({
  id: `test_reshape_${skillId}`, name: 'テスト', icon: 'T', description: '',
  apply({ bus, player }) {
    bus.on('onSkillActivated', (p) => (p.user === player && p.skill?.id === skillId ? { ...p, skill: { ...p.skill, effects: [{ type: 'attack', mult, add }] } } : undefined));
  },
});
