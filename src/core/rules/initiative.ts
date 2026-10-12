import type { EntityId } from '../entities/Entity';

export interface TurnInfo {
  /**
   * sequential : 合計値の大きい方が先攻、小さい方が後攻
   * simultaneous: 同値。両者が同時に攻撃（防御系 → 攻撃 → 死亡判定の順）
   * bustSkip   : 片方がバースト。バースト側はスキルが発動せず、相手だけが行動する（受けるダメージの倍率は bust.ts）
   * defend     : プレイヤーがサレンダー（防御）。自分のスキルは不発で、敵だけが行動する
   * none       : 両者バースト等。誰も行動しない
   */
  mode: 'sequential' | 'simultaneous' | 'bustSkip' | 'defend' | 'none';
  first: EntityId | null;
  /** 後攻。null なら行動しない。 */
  second: EntityId | null;
}

export interface InitiativeInput {
  playerTotal: number;
  enemyTotal: number;
  playerBust: boolean;
  enemyBust: boolean;
  /** プレイヤーがサレンダーを選んだ。 */
  playerSurrendered?: boolean;
}

/** 行動順の決定（純関数）。バーストした側は行動できない（受けるダメージが増える処理は bust.ts）。 */
export function decideInitiative(i: InitiativeInput): TurnInfo {
  if (i.playerSurrendered) {
    if (i.enemyBust) return { mode: 'none', first: null, second: null };
    return { mode: 'defend', first: 'enemy', second: null };
  }
  if (i.playerBust && i.enemyBust) return { mode: 'none', first: null, second: null };
  if (i.playerBust) return { mode: 'bustSkip', first: 'enemy', second: null };
  if (i.enemyBust) return { mode: 'bustSkip', first: 'player', second: null };

  if (i.playerTotal === i.enemyTotal) return { mode: 'simultaneous', first: 'player', second: 'enemy' };
  return i.playerTotal > i.enemyTotal
    ? { mode: 'sequential', first: 'player', second: 'enemy' }
    : { mode: 'sequential', first: 'enemy', second: 'player' };
}
