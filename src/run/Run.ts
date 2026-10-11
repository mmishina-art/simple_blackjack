import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { getEnemy } from '../core/entities/enemies/catalog';
import { DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS, SKILL_POOL, START_ATTACK } from '../core/skills/catalog';
import type { SkillId, SlotKey, SlotTable } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { STAGE_1 } from '../map/stage1';
import { nextTiles, tileOf, type StageMap, type TileDef } from '../map/StageMap';
import { RELIC_POOL } from '../relics/catalog';
import type { Relic } from '../relics/Relic';

/**
 * 1回の冒険の状態。マップ上の位置・HP・スロット（装備スキル）・持ち物・レリックを持つ。
 * 永続強化はスロットとレリックのみ（レベル・経験値はない）。
 */
export interface RunState {
  map: StageMap;
  /** 駒のいるマス。 */
  position: string;
  /** 効果を使い切ったマス（戦闘に勝った敵・開けた宝箱・使った宿屋/祠）。 */
  cleared: string[];
  maxHp: number;
  hp: number;
  /** 基本攻撃力（ATK）。攻撃スキルのダメージの基準。 */
  baseAttack: number;
  /** 合計値スロットにセットされたスキル。 */
  slots: SlotTable;
  /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
  fallbackSkill: SkillId;
  /** スロットにセットしていない所持スキル。 */
  inventory: SkillId[];
  relics: Relic[];
}

export const START_MAX_HP = 60;
/** 固定スロット。11以下は小攻撃、21 は会心の一撃で固定。21 だけは封印の鍵で解除できる。 */
export const FIXED_SLOTS: readonly SlotKey[] = [11, 21];
export const KEY_SLOT: SlotKey = 21;

export function createRun(map: StageMap = STAGE_1): RunState {
  return {
    map, position: map.start, cleared: [],
    maxHp: START_MAX_HP, hp: START_MAX_HP, baseAttack: START_ATTACK,
    slots: { ...DEFAULT_PLAYER_SLOTS }, fallbackSkill: DEFAULT_PLAYER_FALLBACK,
    inventory: [], relics: [],
  };
}

export function currentTile(run: RunState): TileDef {
  return tileOf(run.map, run.position);
}

export function reachableTiles(run: RunState): TileDef[] {
  return nextTiles(run.map, run.position);
}

export function isCleared(run: RunState, id: string): boolean {
  return run.cleared.includes(id);
}

export function enemyOfTile(tile: TileDef): EnemyDef {
  if (!tile.enemyId) throw new Error(`Tile ${tile.id} has no enemy`);
  return getEnemy(tile.enemyId);
}

/** 1マス進む。隣接していないマスへは進めない。 */
export function moveTo(run: RunState, id: string): TileDef {
  const target = reachableTiles(run).find((t) => t.id === id);
  if (!target) throw new Error(`Cannot move ${run.position} -> ${id}`);
  run.position = id;
  return target;
}

export function markCleared(run: RunState, id: string): void {
  if (!isCleared(run, id)) run.cleared.push(id);
}

export function isSlot21Unlocked(run: RunState): boolean {
  return run.relics.some((r) => r.unlocksSlot21);
}

export function isSlotLocked(run: RunState, key: SlotKey): boolean {
  if (key === KEY_SLOT) return !isSlot21Unlocked(run);
  return FIXED_SLOTS.includes(key);
}

/** 持ち物のスキルをスロットにセットする。元のスキルは持ち物に戻る。 */
export function equipSkill(run: RunState, key: SlotKey, skillId: SkillId): boolean {
  const idx = run.inventory.indexOf(skillId);
  if (idx < 0 || isSlotLocked(run, key)) return false;
  const previous = run.slots[key];
  run.inventory.splice(idx, 1);
  run.slots[key] = skillId;
  if (previous) run.inventory.push(previous);
  return true;
}

/** スロットのスキルを外して持ち物に戻す。 */
export function unequipSlot(run: RunState, key: SlotKey): boolean {
  const id = run.slots[key];
  if (!id || isSlotLocked(run, key)) return false;
  delete run.slots[key];
  run.inventory.push(id);
  return true;
}

function pickRandom<T>(pool: readonly T[], count: number, rng: Rng): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length > 0) {
    out.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  }
  return out;
}

/** 敵撃破の報酬スキル（3択）。 */
export function offerSkills(rng: Rng): SkillId[] {
  return pickRandom(SKILL_POOL, 3, rng);
}

/** 宝箱のレリック（3択）。所持済みは出ない。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  return pickRandom(RELIC_POOL.filter((r) => !owned.has(r.id)), 3, rng);
}
