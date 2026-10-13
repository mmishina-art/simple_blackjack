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
  /** 行動順の決定直後。turn を書き換えて、先攻・後攻を改変できる。 */
  onInitiativeDecided: { turn: TurnInfo; playerTotal: number; enemyTotal: number; playerBust: boolean; enemyBust: boolean };
  /** スキル発動直前。skill を別のものに差し替える、null にして不発にする、が可能。 */
  onSkillActivated: { user: Entity; skill: SkillDef | null };
  /** 攻撃のダメージ計算直後（ブロック・HP への反映前）。damage の書き換えが可能。 */
  onDamageCalculated: {
    attacker: Entity | null;
    defender: Entity;
    damage: number;
    skill: SkillDef | null;
  };
  /** ダメージが実際に反映された後。 */
  onDamageDealt: {
    attacker: Entity | null;
    defender: Entity;
    damage: number;
    absorbed: number;
    hpLoss: number;
    /** ブロックを無視する攻撃（会心の一撃）が、相手のブロックを破壊した量。 */
    broken?: number;
    /** 防御の上限（防具）で軽減された量。 */
    reduced?: number;
    skill: SkillDef | null;
  };
  /** ブロック 獲得直前。amount の書き換えが可能。 */
  onBlockGained: { entity: Entity; amount: number; /** 発動したスキル・道具（降伏のブロック などは null）。道具だけを強化するレリックが見分けるために使う。 */ skill?: SkillDef | null };
  /** 回復直前。amount の書き換えが可能。 */
  onHealed: { entity: Entity; amount: number; skill?: SkillDef | null };
  /**
   * ブロック・回復が実際に反映された後（通知のみ）。onBlockGained / onHealed は、スロット表や予測表示が効果を計算するときにも
   * 発火するので、効果音のように「本当に起きたとき」だけ反応したいものは、こちらを使う。
   */
  /** スキルが実際に発動した（通知のみ。予測表示では発火しない）。画面にスキル名を出すために使う。 */
  onSkillUsed: { user: Entity; skill: SkillDef };
  onBlockApplied: { entity: Entity; amount: number };
  onHealApplied: { entity: Entity; amount: number };
  /** 敵の伏せカードがめくられた（通知のみ）。 */
  onCardsRevealed: { entity: Entity };
  onSurrender: { entity: Entity };
  onRoundEnd: { round: number };
  onBattleEnd: { winner: Entity };
}

export type BattleEventName = keyof BattleEvents;
