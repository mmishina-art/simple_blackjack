export type StateId = 'Init' | 'Deal' | 'PlayerAction' | 'EnemyAction' | 'Resolve' | 'CheckDeath';

/** 許可された遷移表。これ以外の遷移は例外になる（厳密なステート管理）。 */
export const TRANSITIONS: Record<StateId | 'START', readonly StateId[]> = {
  START: ['Init'],
  Init: ['Deal'],
  Deal: ['PlayerAction'],
  PlayerAction: ['PlayerAction', 'EnemyAction', 'Resolve'],
  EnemyAction: ['Resolve'],
  Resolve: ['CheckDeath'],
  CheckDeath: ['Deal'],
};

export type PlayerInput = 'hit' | 'stand';

export interface BattleState {
  readonly id: StateId;
  /** 状態の処理を実行し、次の状態を返す。null ならバトル終了。 */
  enter(ctx: BattleContext): Promise<StateId | null>;
}

import type { BattleContext } from './BattleContext';
