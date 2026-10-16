import type { AIDecision, EnemyAI } from './EnemyAI';
import type { Entity } from '../../Entity';
import type { RuleSet } from '../../../rules/RuleSet';

/**
 * 人間のように状況を見て判断する AI（彷徨う賭博師など）。
 * - standOn（既定 15）未満なら必ず Hit。
 * - ソフトハンド（A を 11 として数えている 17 以下）なら、バーストしないため必ず Hit して高目を狙う。
 * - HP が減っている（最大 HP の 60% 以下）かつ相手がブロックを固めていないときは、15〜16 の立て直しスロット（ブロック・回復）で堅実に Stand。
 * - HP に余裕があるときや、相手がブロック（4 以上）を固めているときは、15〜16 では止まらず 17 以上の強攻撃を狙って Hit。
 */
export class SmartAI implements EnemyAI {
  constructor(
    readonly standOn = 15,
    readonly aggressiveStandOn = 17,
  ) {}

  decide(self: Entity, opponent: Entity, rules: RuleSet): AIDecision {
    const total = self.hand.total(rules);
    if (total < this.standOn) return 'hit';
    if (self.hand.isSoft(rules) && total <= this.aggressiveStandOn) return 'hit';
    const injured = self.hp <= self.maxHp * 0.6;
    const oppGuarded = opponent.block >= 4;
    if (injured && !oppGuarded) return 'stand';
    return total >= this.aggressiveStandOn ? 'stand' : 'hit';
  }
}

