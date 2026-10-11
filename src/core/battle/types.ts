export type StateId =
  | 'Init' | 'Deal' | 'PlayerAction' | 'EnemyAction'
  | 'Initiative' | 'FirstAction' | 'SurvivalCheck' | 'SecondAction'
  | 'Surrender' | 'CheckDeath';

/** 許可された遷移表。これ以外の遷移は例外になる（厳密なステート管理）。 */
export const TRANSITIONS: Record<StateId | 'START', readonly StateId[]> = {
  START: ['Init'],
  Init: ['Deal'],
  Deal: ['PlayerAction'],
  // Hit なら自身へ再突入 / Stand なら敵の行動 / バーストなら敵の行動を飛ばして行動順へ / 撤退
  PlayerAction: ['PlayerAction', 'EnemyAction', 'Initiative', 'Surrender'],
  EnemyAction: ['Initiative'],
  // 両者バーストなら誰も行動せず CheckDeath へ
  Initiative: ['FirstAction', 'CheckDeath'],
  // 同時攻撃・後攻なし（バースト）は CheckDeath へ直行
  FirstAction: ['SurvivalCheck', 'CheckDeath'],
  SurvivalCheck: ['SecondAction', 'CheckDeath'],
  SecondAction: ['CheckDeath'],
  Surrender: ['CheckDeath'],
  CheckDeath: ['Deal'],
};

export type PlayerInput = 'hit' | 'stand' | 'surrender';

export interface BattleState {
  readonly id: StateId;
  /** 状態の処理を実行し、次の状態を返す。null ならバトル終了。 */
  enter(ctx: BattleContext): Promise<StateId | null>;
}

import type { BattleContext } from './BattleContext';
