import type { Rarity } from '../core/rarity';
import type { EventBus } from '../core/events/EventBus';
import type { Entity } from '../core/entities/Entity';
import type { RuleSet } from '../core/rules/RuleSet';

/** レリックが触れるバトルの世界。 */
export interface RelicEnv {
  bus: EventBus;
  rules: RuleSet;
  player: Entity;
  enemy: Entity;
}

/**
 * レリック（ルール改変アイテム）。バトル開始時に apply が呼ばれ、
 * フックの登録や RuleSet の書き換えでルールを改変する。敵の特性にも同じ仕組みを使う。
 */
export interface Relic {
  readonly id: string;
  readonly name: string;
  /** メダリオンに表示する1文字。 */
  readonly icon: string;
  readonly description: string;
  /** レア度。省略時はコモン（敵の特性など）。 */
  readonly rarity?: Rarity;
  /** 封印が解けて付け替え可能になる固定スロット（11以下・21）。 */
  readonly unlocksSlots?: readonly number[];
  apply(env: RelicEnv): void;
}
