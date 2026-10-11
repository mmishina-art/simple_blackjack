import { ENEMY_LINEUP } from '../core/entities/enemies/catalog';
import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS } from '../core/skills/catalog';
import type { SkillId, SlotTable } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { RELIC_POOL } from '../relics/catalog';
import type { Relic } from '../relics/Relic';

/**
 * 1回の冒険（連戦）の状態。バトルをまたいで持ち越す。
 * 永続強化はスロット（装備スキル）とレリックのみ。レベル・経験値はない。
 */
export interface RunState {
  /** 現在の戦闘番号（0始まり）。 */
  stage: number;
  maxHp: number;
  hp: number;
  /** 合計値スロットにセットされたスキル（将来は「装備スキル」で書き換える）。 */
  slots: SlotTable;
  /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
  fallbackSkill: SkillId;
  relics: Relic[];
}

export const START_MAX_HP = 60;
/** 勝利後の休息で回復する割合。 */
export const REST_HEAL_RATIO = 0.35;

export function createRun(): RunState {
  return {
    stage: 0, maxHp: START_MAX_HP, hp: START_MAX_HP,
    slots: { ...DEFAULT_PLAYER_SLOTS }, fallbackSkill: DEFAULT_PLAYER_FALLBACK, relics: [],
  };
}

export function currentEnemy(run: RunState): EnemyDef {
  return ENEMY_LINEUP[run.stage];
}

export function isLastStage(run: RunState): boolean {
  return run.stage >= ENEMY_LINEUP.length - 1;
}

/** 勝利後の休息による回復。HP は呼び出し側が戦闘結果で更新済みであること。回復量を返す。 */
export function applyRest(run: RunState): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * REST_HEAL_RATIO));
  return run.hp - before;
}

function pickRandom<T>(pool: readonly T[], count: number, rng: Rng): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length > 0) {
    out.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  }
  return out;
}

/** 報酬レリックの選択肢。所持済みは出ない。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  return pickRandom(RELIC_POOL.filter((r) => !owned.has(r.id)), 3, rng);
}
