import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { getEnemy } from '../core/entities/enemies/catalog';
import { ARMOR_POOL, DEFAULT_ARMOR_ID, DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS, ITEM_POOL, SKILL_POOL, START_ATTACK } from '../core/skills/catalog';
import { pickWeighted, rarityWeights } from '../core/rarity';
import { getSkill, isArmor, rarityOfSkill, type SkillId, type SlotKey, type SlotTable } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { NO_BONUS, computeBonus, validStartingSkills, type MetaState, type RunBonus } from '../meta/Meta';
import { STAGE_ROWS, STAGES } from '../map/stages';
import { nextTiles, tileOf, type StageMap, type TileDef } from '../map/StageMap';
import { RELIC_POOL } from '../relics/catalog';
import type { Relic } from '../relics/Relic';

/**
 * 1回の冒険の状態。マップ上の位置・HP・スロット（装備スキル）・持ち物・レリックを持つ。
 * 永続強化はスロットとレリックのみ（レベル・経験値はない）。
 */
export interface RunState {
  map: StageMap;
  /** いま何階層目か（1 始まり）。最後の階層のボスを倒すとクリア。 */
  stage: number;
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
  /** 防御スロットに装備している防具（防御したラウンドの被ダメージ上限を決める）。上書きのみ。 */
  armor: SkillId;
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

/** 冒険の初期の最大 HP（祭壇の強化が上乗せされる）。道具の回復（薬草など）で保つ。 */
export const START_MAX_HP = 30;
/** 固定スロット。11以下は小攻撃、21 は会心の一撃で固定。レリック（解錠の鍵・封印の鍵）で解除できる。 */
export const FIXED_SLOTS: readonly SlotKey[] = [11, 21];

/** 新しい冒険を始める。meta を渡すと、祭壇の強化・初期スキル・図鑑が反映される。 */
export function createRun(map: StageMap = STAGES[0], meta?: MetaState): RunState {
  const bonus = meta ? computeBonus(meta) : { ...NO_BONUS };
  const maxHp = START_MAX_HP + bonus.maxHp;
  const slots = { ...DEFAULT_PLAYER_SLOTS, ...(meta ? validStartingSkills(meta) : {}) };
  return {
    map, stage: Math.max(1, STAGES.findIndex((m) => m.id === map.id) + 1), position: map.start, cleared: [],
    maxHp, hp: maxHp, baseAttack: START_ATTACK + bonus.attack,
    slots, armor: DEFAULT_ARMOR_ID, fallbackSkill: DEFAULT_PLAYER_FALLBACK,
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
  run.stats.maxRow = Math.max(run.stats.maxRow, (run.stage - 1) * STAGE_ROWS + target.row); // 階層をまたいで通算
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

/** 最後の階層か（ここのボスを倒すとクリア）。 */
export function isFinalStage(run: RunState): boolean {
  return run.stage >= STAGES.length;
}

/** 階層の合間に回復する割合（最大 HP に対して）。 */
export const STAGE_CLEAR_HEAL = 0.5;
/** 階層を踏破するたびに増える最大 HP（その分、HP も増える）。 */
export const STAGE_CLEAR_MAX_HP = 10;

/** 次の階層へ進む。最大 HP が増え、HP が回復し、位置が新しい階層のスタートになる。最後の階層なら何もせず false。 */
export function advanceStage(run: RunState): boolean {
  if (isFinalStage(run)) return false;
  run.stage++;
  run.map = STAGES[run.stage - 1];
  run.position = run.map.start;
  run.cleared = [];
  run.maxHp += STAGE_CLEAR_MAX_HP;
  run.hp = Math.min(run.maxHp, run.hp + STAGE_CLEAR_MAX_HP + Math.ceil(run.maxHp * STAGE_CLEAR_HEAL));
  return true;
}

/**
 * 持ち物のスキルをスロットにセットする。**付け替えはできず、上書きのみ**:
 * 置き換えられた元のスキルは失われ、持ち物には戻らない（外して空きにすることもできない）。
 */
export function equipSkill(run: RunState, key: SlotKey, skillId: SkillId): boolean {
  // 通常攻撃（空スロット）はスキルとしてセットできない
  if (skillId === run.fallbackSkill || isArmor(getSkill(skillId))) return false;
  const idx = run.inventory.indexOf(skillId);
  if (idx < 0 || isSlotLocked(run, key)) return false;
  run.inventory.splice(idx, 1);
  run.slots[key] = skillId;
  return true;
}

/** 持ち物の防具を防御スロットに装備する。**上書きのみ**: 元の防具は失われ、持ち物には戻らない。 */
export function equipArmor(run: RunState, armorId: SkillId): boolean {
  const idx = run.inventory.indexOf(armorId);
  if (idx < 0 || !isArmor(getSkill(armorId))) return false;
  run.inventory.splice(idx, 1);
  run.armor = armorId;
  return true;
}

/** 装備中の防具の被ダメージ上限。 */
export function armorCap(run: RunState): number {
  return getSkill(run.armor).damageCap ?? 5;
}

/** 祠の入れ替え: 2つのスロットの中身を交換する（空きとの交換は移動）。固定スロットは動かせない。 */
export function swapSlots(run: RunState, a: SlotKey, b: SlotKey): boolean {
  if (a === b || isSlotLocked(run, a) || isSlotLocked(run, b)) return false;
  const ia = run.slots[a];
  const ib = run.slots[b];
  if (!ia && !ib) return false;
  if (ib) run.slots[a] = ib; else delete run.slots[a];
  if (ia) run.slots[b] = ia; else delete run.slots[b];
  return true;
}

/** バージョンアップできるスロットか（スキルが入っていて、強化先があり、固定でない。道具は強化先がない）。 */
export function canUpgradeSlot(run: RunState, key: SlotKey): boolean {
  const id = run.slots[key];
  return !!id && !isSlotLocked(run, key) && !!getSkill(id).upgradesTo;
}

/** 祠のバージョンアップ: スロットのスキルを1つ上のレア度のスキルに変える。 */
export function upgradeSlot(run: RunState, key: SlotKey): SkillId | null {
  if (!canUpgradeSlot(run, key)) return null;
  const to = getSkill(run.slots[key]!).upgradesTo!;
  run.slots[key] = to;
  return to;
}

/** 図鑑に載っているスキルは出やすい（重み ×2）。 */
export const CODEX_BOOST = 2;

/**
 * 敵撃破の報酬（3択 + 祭壇の「見る目」）。スキルと道具に分け、**道具を必ず1つ**含める（残りはスキル）。
 * 並びは、スキル → 道具。レア度が高いほど出にくい。
 */
export function offerSkills(rng: Rng, run?: RunState): SkillId[] {
  const favored = new Set(run?.favored ?? []);
  const w = rarityWeights(run?.stage ?? 1);
  const weight = (id: SkillId): number => w[rarityOfSkill(getSkill(id))] * (favored.has(id) ? CODEX_BOOST : 1);
  const count = 3 + (run?.bonus.extraChoices ?? 0);
  const skills = pickWeighted(SKILL_POOL, count - 1, rng, weight);
  // 道具の枠: 道具と、いま装備しているより硬い防具（同じか柔らかい防具は出さない）から1つ
  // いま装備しているより硬い防具（上限が小さい、または上限が同じで回復がある）だけを出す
  const better = (id: SkillId): boolean => {
    if (!run) return true;
    const cur = getSkill(run.armor);
    const cand = getSkill(id);
    return (cand.damageCap ?? Infinity) < (cur.damageCap ?? Infinity)
      || ((cand.damageCap ?? Infinity) === (cur.damageCap ?? Infinity) && (cand.defendHeal ?? 0) > (cur.defendHeal ?? 0));
  };
  const harder = ARMOR_POOL.filter(better);
  const items = pickWeighted([...ITEM_POOL, ...harder], 1, rng, weight);
  return [...skills, ...items];
}

/** 宝箱のレリック（3択）。所持済みは出ない。レア度が高いほど出にくい。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  return pickWeighted(RELIC_POOL.filter((r) => !owned.has(r.id)), 3, rng, (r) => rarityWeights(run.stage)[r.rarity ?? 'common']);
}
