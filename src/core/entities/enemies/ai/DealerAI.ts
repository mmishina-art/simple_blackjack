import type { AIDecision, EnemyAI } from './EnemyAI';
import type { Entity } from '../../Entity';
import type { RuleSet } from '../../../rules/RuleSet';

/** 標準ディーラー: 合計が standOn 以上になるまで Hit し続ける（ソフト17も Stand）。 */
export class DealerAI implements EnemyAI {
  constructor(private readonly standOn = 17) {}

  decide(self: Entity, _opponent: Entity, rules: RuleSet): AIDecision {
    return self.hand.total(rules) >= this.standOn ? 'stand' : 'hit';
  }
}
