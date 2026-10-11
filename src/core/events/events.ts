import type { Card } from '../cards/Card';
import type { Entity } from '../entities/Entity';
import type { TurnInfo } from '../rules/initiative';
import type { SkillDef } from '../skills/Skill';

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
  /** 行動順の決定直後。turn を書き換えて、先攻・後攻・クリティカルを改変できる。 */
  onInitiativeDecided: { turn: TurnInfo; playerTotal: number; enemyTotal: number; playerBust: boolean; enemyBust: boolean };
  /** スキル発動直前。skill を別のものに差し替える、null にして不発にする、crit を変える、が可能。 */
  onSkillActivated: { user: Entity; skill: SkillDef | null; crit: boolean };
  /** 攻撃のダメージ計算直後（Block・HP への反映前）。damage の書き換えが可能。 */
  onDamageCalculated: {
    attacker: Entity | null;
    defender: Entity;
    damage: number;
    skill: SkillDef | null;
    crit: boolean;
  };
  /** ダメージが実際に反映された後。 */
  onDamageDealt: {
    attacker: Entity | null;
    defender: Entity;
    damage: number;
    absorbed: number;
    hpLoss: number;
    skill: SkillDef | null;
    crit: boolean;
  };
  /** Block 獲得直前。amount の書き換えが可能。 */
  onBlockGained: { entity: Entity; amount: number };
  /** 回復直前。amount の書き換えが可能。 */
  onHealed: { entity: Entity; amount: number };
  onSurrender: { entity: Entity };
  onRoundEnd: { round: number };
  onBattleEnd: { winner: Entity };
}

export type BattleEventName = keyof BattleEvents;
