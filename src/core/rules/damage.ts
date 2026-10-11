import type { RuleSet } from './RuleSet';
import type { RoundResult } from './judge';

export interface DamageInfo {
  /** ダメージを与える側。引き分けは null。 */
  attacker: 'player' | 'enemy' | null;
  damage: number;
  blackjackBonus: boolean;
}

/**
 * ダメージ計算（純関数）。
 * - プレイヤー勝利: プレイヤー合計値を敵へ
 * - 敵勝利: 敵合計値をプレイヤーへ
 * - プレイヤーバースト: プレイヤーのバースト合計値をプレイヤーへ（倍率なし）
 * - ブラックジャックで勝利: 1.5倍（端数切り捨て）
 * - 引き分け: 0
 */
export function computeDamage(result: RoundResult, rules: RuleSet): DamageInfo {
  if (result.outcome === 'push') return { attacker: null, damage: 0, blackjackBonus: false };

  if (result.outcome === 'enemyWin' && result.playerBust) {
    return { attacker: 'enemy', damage: result.playerTotal, blackjackBonus: false };
  }

  const playerWon = result.outcome === 'playerWin';
  const base = playerWon ? result.playerTotal : result.enemyTotal;
  const blackjack = playerWon ? result.playerBlackjack : result.enemyBlackjack;
  const damage = blackjack ? Math.floor(base * rules.blackjackMultiplier) : base;
  return { attacker: playerWon ? 'player' : 'enemy', damage, blackjackBonus: blackjack };
}
