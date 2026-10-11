import type { Card } from '../cards/Card';
import type { Entity } from '../entities/Entity';
import type { RoundResult } from '../rules/judge';
import type { DamageInfo } from '../rules/damage';

/**
 * フックのペイロード定義。
 * ハンドラはペイロードを直接書き換えるか、新しいペイロードを return することで値を改変できる
 * （例: onCardDrawn で card.value を変える / onDamageCalculated で damage を増減する）。
 * 通知だけしたい場合は何も return しなければよい。
 */
export interface BattleEvents {
  onBattleStart: { player: Entity; enemy: Entity };
  onRoundStart: { round: number };
  onDealt: { player: Entity; enemy: Entity };
  /** カードを引いた直後（手札に加わる前）。card の差し替え・書き換えが可能。 */
  onCardDrawn: { entity: Entity; card: Card };
  onStand: { entity: Entity };
  /** バーストした直後。 */
  onBust: { entity: Entity };
  /** ダメージ計算直後（HP 反映前）。damage の書き換えが可能。 */
  onDamageCalculated: { attacker: Entity | null; defender: Entity | null; damage: number; info: DamageInfo };
  onResolve: { result: RoundResult; damage: number };
  onRoundEnd: { round: number };
  onBattleEnd: { winner: Entity };
}

export type BattleEventName = keyof BattleEvents;
