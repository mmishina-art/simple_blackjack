import type { Rarity } from '../core/rarity';
import type { EventBus } from '../core/events/EventBus';
import type { Entity } from '../core/entities/Entity';
import type { RuleSet } from '../core/rules/RuleSet';
import type { SlotTable } from '../core/skills/Skill';

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
  /**
   * いま効果が出ているか（条件つきのレリックだけ。省略時は、常に出ている）。出ていないときは、画面でグレーに表示する。
   * 判断に使えるのは、スロットの中身だけ（戦闘中の状況は含めない）。
   */
  isActive?(slots: SlotTable): boolean;
  apply(env: RelicEnv): void;
}

/** そのレリックの効果が、いま出ているか。 */
export const relicActive = (relic: Relic, slots: SlotTable): boolean => relic.isActive?.(slots) ?? true;
