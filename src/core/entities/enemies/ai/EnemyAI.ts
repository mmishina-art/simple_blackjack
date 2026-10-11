import type { Entity } from '../../Entity';
import type { RuleSet } from '../../../rules/RuleSet';

export type AIDecision = 'hit' | 'stand';

/** 敵の行動ルーチン。敵ごとに差し替え可能。 */
export interface EnemyAI {
  decide(self: Entity, opponent: Entity, rules: RuleSet): AIDecision;
}
