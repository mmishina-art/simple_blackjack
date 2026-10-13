import type { Entity } from '../../Entity';
import type { RuleSet } from '../../../rules/RuleSet';

export type AIDecision = 'hit' | 'stand';

/** 敵の行動ルーチン。敵ごとに差し替え可能。 */
export interface EnemyAI {
  /** 「この合計値以上になるまで必ず引く」という個性があるときの、その値。これ未満の合計では、手札が確定しない。 */
  readonly standOn?: number;
  decide(self: Entity, opponent: Entity, rules: RuleSet): AIDecision;
}
