import type { Entity } from '../entities/Entity';
import type { RuleSet } from './RuleSet';

/**
 * バーストした側が受ける攻撃ダメージの倍率。バーストしていなければ 1。
 * 伏せカードがあるうちは 1（予測表示が、まだ見えない敵のバーストを漏らさないため）。
 */
export function damageTakenMultiplier(defender: Entity, rules: RuleSet): number {
  const { hand } = defender;
  return !defender.bustPenaltyFree && !hand.hasHidden && hand.isBust(rules) ? rules.bustDamageMultiplier : 1;
}

/** バーストの不利の説明（画面・ログ用）。倍率が 1（または、そのバーストが倍率を受けない側）なら、スキル不発だけを伝える。 */
export function bustPenaltyText(rules: RuleSet, bust?: Entity): string {
  return rules.bustDamageMultiplier === 1 || bust?.bustPenaltyFree ? 'スキル不発' : `スキル不発・受けるダメージ${rules.bustDamageMultiplier}倍`;
}
