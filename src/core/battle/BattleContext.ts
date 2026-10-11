import type { Deck } from '../cards/Deck';
import type { Entity, EntityId } from '../entities/Entity';
import type { EnemyDef } from '../entities/enemies/EnemyDef';
import type { EventBus } from '../events/EventBus';
import type { TurnInfo } from '../rules/initiative';
import type { RuleSet } from '../rules/RuleSet';
import type { SkillDef } from '../skills/Skill';
import type { PlayerInput } from './types';

/** 各ステートが共有するバトルの状態と、ステートから使うサービス群。 */
export interface BattleContext {
  readonly rules: RuleSet;
  readonly bus: EventBus;
  readonly deck: Deck;
  readonly player: Entity;
  readonly enemy: Entity;
  readonly enemyDef: EnemyDef;
  round: number;
  /** 現ラウンドの行動順。Initiative で決まる。 */
  turn: TurnInfo | null;
  /** 行動順の決定後に発動が確定したスキル（後攻の Block を先に付与するため、先攻の行動時にまとめて宣言する）。 */
  plan: Partial<Record<EntityId, SkillDef | null>>;
  /** このラウンドでプレイヤーがサレンダー（防御）を選んだ。 */
  playerSurrendered: boolean;
  winner: Entity | null;

  entityOf(id: EntityId): Entity;
  /** バトルログに1行追加。 */
  log(text: string): void;
  /** 画面更新を促す。 */
  notify(): void;
  /** 演出用ウェイト。 */
  wait(ms: number): Promise<void>;
  /** プレイヤー入力を待つ（PlayerAction 専用）。 */
  waitForInput(): Promise<PlayerInput>;
  /** 1枚引いて手札に加える（onCardDrawn / onBust フックを発火）。 */
  draw(entity: Entity, opts?: { faceDown?: boolean }): void;
}
