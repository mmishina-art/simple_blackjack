import type { EventBus } from '../core/events/EventBus';
import type { RuleSet } from '../core/rules/RuleSet';

/**
 * レリック（ルール改変アイテム）。MVP では実装なし。
 * バトル開始時に apply が呼ばれ、フック登録や RuleSet の書き換えを行う。
 */
export interface Relic {
  readonly id: string;
  readonly name: string;
  apply(bus: EventBus, rules: RuleSet): void;
}
