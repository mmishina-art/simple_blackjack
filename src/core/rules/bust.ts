import type { Entity } from '../entities/Entity';
import type { RuleSet } from './RuleSet';

/**
 * バーストした側が受ける攻撃ダメージの倍率。バーストしていなければ 1。
 * 伏せカードがあるうちは 1（予測表示が、まだ見えない敵のバーストを漏らさないため）。
 */
export function damageTakenMultiplier(defender: Entity, rules: RuleSet): number {
  const { hand } = defender;
  return !hand.hasHidden && hand.isBust(rules) ? rules.bustDamageMultiplier : 1;
}

/** バーストの不利の説明（画面・ログ用）。倍率が 1 なら、スキル不発だけを伝える。 */
export function bustPenaltyText(rules: RuleSet): string {
  return rules.bustDamageMultiplier === 1 ? 'スキル不発' : `スキル不発・受けるダメージ${rules.bustDamageMultiplier}倍`;
}
