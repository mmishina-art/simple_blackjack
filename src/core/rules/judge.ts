import type { Hand } from '../cards/Hand';
import type { RuleSet } from './RuleSet';

export type Outcome = 'playerWin' | 'enemyWin' | 'push';

export interface RoundResult {
  outcome: Outcome;
  playerTotal: number;
  enemyTotal: number;
  playerBust: boolean;
  enemyBust: boolean;
  playerBlackjack: boolean;
  enemyBlackjack: boolean;
}

/**
 * 勝敗判定（純関数）。
 * バーストした側は無条件で負け（プレイヤーは先に行動するので、両者バーストならプレイヤー負け）。
 * それ以外は合計値が大きい方が勝ち、同値はプッシュ。
 */
export function judge(player: Hand, enemy: Hand, rules: RuleSet): RoundResult {
  const playerTotal = player.total(rules);
  const enemyTotal = enemy.total(rules);
  const playerBust = playerTotal > rules.bustLimit;
  const enemyBust = enemyTotal > rules.bustLimit;

  let outcome: Outcome;
  if (playerBust) outcome = 'enemyWin';
  else if (enemyBust) outcome = 'playerWin';
  else if (playerTotal > enemyTotal) outcome = 'playerWin';
  else if (playerTotal < enemyTotal) outcome = 'enemyWin';
  else outcome = 'push';

  return {
    outcome,
    playerTotal,
    enemyTotal,
    playerBust,
    enemyBust,
    playerBlackjack: player.isBlackjack(rules),
    enemyBlackjack: enemy.isBlackjack(rules),
  };
}
