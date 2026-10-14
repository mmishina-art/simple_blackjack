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

/**
 * 攻撃する側の倍率。敵の合計値がちょうど 21 なら、敵の攻撃ダメージが enemy21Multiplier 倍（「BUST or DIE」の DIE）。
 * total は攻撃する側の合計値（予測表示では、そのスロットの合計値）。
 */
export function damageDealtMultiplier(attacker: Entity, total: number, rules: RuleSet): number {
  return attacker.id === 'enemy' && total === rules.blackjackScore ? rules.enemy21Multiplier : 1;
}

/**
 * 「BUST or DIE」の予告: 敵が引き終えた手札（伏せ札を含む）が、ちょうど 21 か、バーストか。
 * どちらなのかは伏せ札しだいで、画面には「21 か、バーストか」だけを出す（中身は漏らさない）。
 */
export function isBustOrDie(enemy: Entity, rules: RuleSet): boolean {
  return enemy.hand.size > 0 && enemy.hand.total(rules) >= rules.blackjackScore;
}
