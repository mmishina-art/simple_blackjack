export type StateId =
  | 'Init' | 'Deal' | 'EnemyAction' | 'PlayerDeal' | 'PlayerAction'
  | 'Initiative' | 'FirstAction' | 'SurvivalCheck' | 'SecondAction'
  | 'Surrender' | 'CheckDeath';

/**
 * 許可された遷移表。これ以外の遷移は例外になる（厳密なステート管理）。
 *
 * ラウンドの流れ: 敵が先に引ききって手札を確定させ（最後の1枚だけ伏せ）、そのあとプレイヤーが引く。
 * プレイヤーが勝負（Stand / バースト / 防御）したら、敵の追加ドローはなく、すぐ行動順の決定→攻撃へ進む。
 */
export const TRANSITIONS: Record<StateId | 'START', readonly StateId[]> = {
  START: ['Init'],
  Init: ['Deal'],
  // 敵への配牌（初手2枚）→ 敵が引ききって手札確定 → プレイヤーへの配牌 → プレイヤーの入力
  Deal: ['EnemyAction'],
  EnemyAction: ['PlayerDeal'],
  PlayerDeal: ['PlayerAction'],
  // Hit なら自身へ再突入 / Stand・バーストは行動順の決定へ / 防御はサレンダー
  PlayerAction: ['PlayerAction', 'Initiative', 'Surrender'],
  // 両者バーストなら誰も行動せず CheckDeath へ
  Initiative: ['FirstAction', 'CheckDeath'],
  // 同時攻撃・後攻なし（バースト）は CheckDeath へ直行
  FirstAction: ['SurvivalCheck', 'CheckDeath'],
  SurvivalCheck: ['SecondAction', 'CheckDeath'],
  SecondAction: ['CheckDeath'],
  // サレンダー: ブロックを得て自分のスキルは不発。敵だけが行動する
  Surrender: ['Initiative'],
  CheckDeath: ['Deal'],
};

export type PlayerInput = 'hit' | 'stand' | 'surrender';

export interface BattleState {
  readonly id: StateId;
  /** 状態の処理を実行し、次の状態を返す。null ならバトル終了。 */
  enter(ctx: BattleContext): Promise<StateId | null>;
}

import type { BattleContext } from './BattleContext';
