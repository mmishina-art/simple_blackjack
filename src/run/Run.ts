import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { getEnemy } from '../core/entities/enemies/catalog';
import { DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS, SKILL_POOL, START_ATTACK } from '../core/skills/catalog';
import { pickWeighted, RARITY_WEIGHT } from '../core/rarity';
import { getSkill, rarityOfSkill, type SkillId, type SlotKey, type SlotTable } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { NO_BONUS, computeBonus, validStartingSkills, type MetaState, type RunBonus } from '../meta/Meta';
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
  /** 祭壇の強化による、この冒険のボーナス。 */
  bonus: RunBonus;
  /** 図鑑に載っているスキル（報酬に出やすい）。 */
  favored: SkillId[];
  /** 魂片の計算用の記録。 */
  stats: { maxRow: number; enemiesDefeated: number };
}

export const START_MAX_HP = 60;
/** 固定スロット。11以下は小攻撃、21 は会心の一撃で固定。レリック（解錠の鍵・封印の鍵）で解除できる。 */
export const FIXED_SLOTS: readonly SlotKey[] = [11, 21];

/** 新しい冒険を始める。meta を渡すと、祭壇の強化・初期スキル・図鑑が反映される。 */
export function createRun(map: StageMap = STAGE_1, meta?: MetaState): RunState {
  const bonus = meta ? computeBonus(meta) : { ...NO_BONUS };
  const maxHp = START_MAX_HP + bonus.maxHp;
  const slots = { ...DEFAULT_PLAYER_SLOTS, ...(meta ? validStartingSkills(meta) : {}) };
  return {
    map, position: map.start, cleared: [],
    maxHp, hp: maxHp, baseAttack: START_ATTACK + bonus.attack,
    slots, fallbackSkill: DEFAULT_PLAYER_FALLBACK,
    inventory: [], relics: [], bonus,
    favored: meta ? [...meta.codex.skills] : [],
    stats: { maxRow: 0, enemiesDefeated: 0 },
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
  run.stats.maxRow = Math.max(run.stats.maxRow, target.row);
  return target;
}

export function markCleared(run: RunState, id: string): void {
  if (!isCleared(run, id)) run.cleared.push(id);
}

/** 固定スロットがレリックで解錠されているか。 */
export function isSlotUnlockedByRelic(run: RunState, key: SlotKey): boolean {
  return run.relics.some((r) => r.unlocksSlots?.includes(key));
}

export function isSlotLocked(run: RunState, key: SlotKey): boolean {
  return FIXED_SLOTS.includes(key) && !isSlotUnlockedByRelic(run, key);
}

/** 持ち物のスキルをスロットにセットする。元のスキルは持ち物に戻る。 */
export function equipSkill(run: RunState, key: SlotKey, skillId: SkillId): boolean {
  // 通常攻撃（空スロット）はスキルとしてセットも外しもできない
  if (skillId === run.fallbackSkill) return false;
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

/** 図鑑に載っているスキルは出やすい（重み ×2）。 */
export const CODEX_BOOST = 2;

/** 敵撃破の報酬スキル（3択 + 祭壇の「見る目」）。レア度が高いほど出にくい。 */
export function offerSkills(rng: Rng, run?: RunState): SkillId[] {
  const favored = new Set(run?.favored ?? []);
  const count = 3 + (run?.bonus.extraChoices ?? 0);
  return pickWeighted(SKILL_POOL, count, rng, (id) => RARITY_WEIGHT[rarityOfSkill(getSkill(id))] * (favored.has(id) ? CODEX_BOOST : 1));
}

/** 宝箱のレリック（3択）。所持済みは出ない。レア度が高いほど出にくい。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  return pickWeighted(RELIC_POOL.filter((r) => !owned.has(r.id)), 3, rng, (r) => RARITY_WEIGHT[r.rarity ?? 'common']);
}
