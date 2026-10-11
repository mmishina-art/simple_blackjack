import type { EntityId } from '../entities/Entity';

export interface TurnInfo {
  /**
   * sequential : 合計値の大きい方が先攻、小さい方が後攻
   * simultaneous: 同値。両者が同時に攻撃（防御系 → 攻撃 → 死亡判定の順）
   * bustSkip   : 片方がバースト。相手が先制クリティカル、バースト側は行動不能
   * none       : 両者バースト。誰も行動しない
   */
  mode: 'sequential' | 'simultaneous' | 'bustSkip' | 'none';
  first: EntityId | null;
  /** 後攻。null なら行動しない。 */
  second: EntityId | null;
  crit: Record<EntityId, boolean>;
}

export interface InitiativeInput {
  playerTotal: number;
  enemyTotal: number;
  playerBust: boolean;
  enemyBust: boolean;
  playerBlackjack: boolean;
  enemyBlackjack: boolean;
}

/** 行動順の決定（純関数）。ブラックジャック（初手21）はその側の行動をクリティカルにする。 */
export function decideInitiative(i: InitiativeInput): TurnInfo {
  const crit: Record<EntityId, boolean> = {
    player: i.playerBlackjack && !i.playerBust,
    enemy: i.enemyBlackjack && !i.enemyBust,
  };

  if (i.playerBust && i.enemyBust) return { mode: 'none', first: null, second: null, crit: { player: false, enemy: false } };
  if (i.playerBust) return { mode: 'bustSkip', first: 'enemy', second: null, crit: { player: false, enemy: true } };
  if (i.enemyBust) return { mode: 'bustSkip', first: 'player', second: null, crit: { player: true, enemy: false } };

  if (i.playerTotal === i.enemyTotal) return { mode: 'simultaneous', first: 'player', second: 'enemy', crit };
  return i.playerTotal > i.enemyTotal
    ? { mode: 'sequential', first: 'player', second: 'enemy', crit }
    : { mode: 'sequential', first: 'enemy', second: 'player', crit };
}
