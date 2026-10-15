import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { getEnemy } from '../core/entities/enemies/catalog';
import { dropsOf } from './drops';
import { DEFAULT_ARMOR_ID, DEFAULT_PLAYER_FALLBACK, DEFAULT_PLAYER_SLOTS, isPlusSkill, SKILL_POOL, START_ATTACK } from '../core/skills/catalog';
import { RARITY_ORDER } from './loadout';
import { pickWeighted, tierWeights } from '../core/rarity';
import { canPlaceAt, getSkill, isArmor, rarityOfSkill, SLOT_KEYS, type SkillId, type SlotKey, type SlotTable } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { NO_BONUS, computeBonus, type MetaState, type RunBonus } from '../meta/Meta';
import { STAGES, stageRowOffset } from '../map/stages';
import { nextTiles, type StageMap, type TileDef } from '../map/StageMap';
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
  /** 基本パワー（POW）。攻撃スキルのダメージの基準。 */
  baseAttack: number;
  /** 合計値スロットにセットされたスキル。 */
  slots: SlotTable;
  /** 防御スロットに装備している防具（防御したラウンドの被ダメージ上限を決める）。上書きのみ。 */
  armor: SkillId;
  /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
  fallbackSkill: SkillId;
  /** スロットにセットしていない所持スキル。 */
  inventory: SkillId[];
  /** 所持ゴールド。敵を倒すともらえ、ショップで使う。持ち物を売っても増える。 */
  gold: number;
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
/** 固定スロット。11以下は小攻撃、21 は会心の一撃で固定。レリックで解除できる（いまは該当するレリックなし）。 */
export const FIXED_SLOTS: readonly SlotKey[] = [11, 21];

/** 新しい冒険を始める。meta を渡すと、祭壇の強化・初期スキル・図鑑が反映される。 */
export function createRun(map: StageMap = STAGES[0], meta?: MetaState): RunState {
  const bonus = meta ? computeBonus(meta) : { ...NO_BONUS };
  const maxHp = START_MAX_HP + bonus.maxHp;
  const slots = { ...DEFAULT_PLAYER_SLOTS };
  return {
    map, stage: Math.max(1, STAGES.findIndex((m) => m.id === map.id) + 1), position: map.start, cleared: [],
    maxHp, hp: maxHp, baseAttack: START_ATTACK + bonus.attack,
    slots, armor: DEFAULT_ARMOR_ID, fallbackSkill: DEFAULT_PLAYER_FALLBACK,
    inventory: [], gold: 0, relics: [], bonus,
    favored: meta ? [...meta.codex.skills] : [],
    stats: { maxRow: 0, enemiesDefeated: 0 },
  };
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
  run.stats.maxRow = Math.max(run.stats.maxRow, stageRowOffset(run.stage) + target.row); // 階層をまたいで通算
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
export const STAGE_CLEAR_HEAL = 0.7;
/** 階層を踏破するたびに増える最大 HP（その分、HP も増える）。 */
export const STAGE_CLEAR_MAX_HP = 12;

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
  if (idx < 0 || isSlotLocked(run, key) || !canPlaceAt(getSkill(skillId), key)) return false; // レア度の制限もある
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
  // 入れ替えたあとの場所が、レア度の制限に合っているか
  if ((ia && !canPlaceAt(getSkill(ia), b)) || (ib && !canPlaceAt(getSkill(ib), a))) return false;
  if (ib) run.slots[a] = ib; else delete run.slots[a];
  if (ia) run.slots[b] = ia; else delete run.slots[b];
  return true;
}

/** 入れ替えの場所: スキルのスロット / 道具袋 / 防御スロット（防具）。 */
export type Spot = { kind: 'slot'; key: SlotKey } | { kind: 'pouch' } | { kind: 'armor' };

export function spotItem(run: RunState, spot: Spot): SkillId | null {
  if (spot.kind === 'slot') return run.slots[spot.key] ?? null;
  if (spot.kind === 'pouch') return run.inventory[0] ?? null;
  return run.armor;
}

function setSpot(run: RunState, spot: Spot, id: SkillId | null): void {
  if (spot.kind === 'slot') {
    if (id) run.slots[spot.key] = id; else delete run.slots[spot.key];
  } else if (spot.kind === 'pouch') {
    run.inventory = id ? [id] : [];
  } else if (id) run.armor = id;
}

const sameSpot = (a: Spot, b: Spot): boolean => a.kind === b.kind && (a.kind !== 'slot' || a.key === (b as { key: SlotKey }).key);

/** その場所に、この中身（なければ空）を置いてよいか。固定スロット・レア度の制限・防具は防具の場所だけ、防御スロットは空にできない。 */
function fits(run: RunState, spot: Spot, id: SkillId | null, loose = false): boolean {
  if (spot.kind === 'pouch') return true;
  if (spot.kind === 'armor') return !!id && isArmor(getSkill(id));
  if (isSlotLocked(run, spot.key)) return false;
  return !id || (!isArmor(getSkill(id)) && (loose || canPlaceAt(getSkill(id), spot.key)));
}

/** レア度の制限に合っていないスロット（祠の入れ替えの「仮置き」が残っている場所）。空なら、そのまま進める。 */
export function placementViolations(run: RunState): SlotKey[] {
  return SLOT_KEYS.filter((k) => { const id = run.slots[k]; return !!id && !canPlaceAt(getSkill(id), k); });
}

/** 2 つの場所の中身を入れ替えられるか（空きとの入れ替えは移動）。 */
export function canSwapSpots(run: RunState, a: Spot, b: Spot, opts: { tentative?: boolean } = {}): boolean {
  if (sameSpot(a, b)) return false;
  const ia = spotItem(run, a);
  const ib = spotItem(run, b);
  if (!ia && !ib) return false;
  if (a.kind === 'slot' && isSlotLocked(run, a.key)) return false;
  if (b.kind === 'slot' && isSlotLocked(run, b.key)) return false;
  return fits(run, a, ib, opts.tentative) && fits(run, b, ia, opts.tentative);
}

/** 祠の入れ替え: スロット・道具袋・防御スロットの間で、中身を入れ替える（何度でもできる。回数の制限はない）。tentative なら、レア度の制限に合わない場所にも仮置きできる（placementViolations が空になるまで画面を閉じられない）。 */
export function swapSpots(run: RunState, a: Spot, b: Spot, opts: { tentative?: boolean } = {}): boolean {
  if (!canSwapSpots(run, a, b, opts)) return false;
  const ia = spotItem(run, a);
  const ib = spotItem(run, b);
  setSpot(run, a, ib);
  setSpot(run, b, ia);
  return true;
}

/** 祠のバージョンアップで一度に出す候補の数。 */
export const SHRINE_UPGRADE_CHOICES = 3;

/**
 * 祠のバージョンアップで選べるスロット: 21 の会心の一撃の系統だけ（会心の一撃 → 覇王の一撃 → 終焉の一撃）。
 * ほかのスキルの「＋」は、祠ではなく、同じスキルの合成で作る（canMergeAt / mergeSkill）。終焉の一撃まで育ったら、候補はない。
 */
export function shrineUpgradeChoices(run: RunState, _rng?: Rng, max = SHRINE_UPGRADE_CHOICES): SlotKey[] {
  return SLOT_KEYS.filter((k) => {
    const id = run.slots[k];
    const to = id ? getSkill(id).upgradesTo : undefined;
    return !!to && !isPlusSkill(to);
  }).slice(0, max);
}

/**
 * 合成: 手に入れたスキル（報酬・ショップ・道具袋から出したもの）と同じスキルが、そのスロットにある。
 * 2 つを合わせて、スロットのスキルを「＋」にできる（＋は 1 段階だけ。道具・防具・会心の一撃は合成できない）。
 */
export function canMergeAt(run: RunState, key: SlotKey, id: SkillId): boolean {
  if (run.slots[key] !== id || isSlotLocked(run, key) || !run.inventory.includes(id)) return false;
  const to = getSkill(id).upgradesTo;
  return !!to && isPlusSkill(to);
}

/** 合成する: 手持ちの 1 つを使って、スロットのスキルを「＋」にする。合成できなければ null。 */
export function mergeSkill(run: RunState, key: SlotKey, id: SkillId): SkillId | null {
  if (!canMergeAt(run, key, id)) return null;
  run.inventory.splice(run.inventory.indexOf(id), 1);
  const to = getSkill(id).upgradesTo!;
  run.slots[key] = to;
  return to;
}

/** そのスキルを手に入れたら、合成できるスロットがあるか（報酬の選択肢に「合成で＋」と出す）。 */
export function hasMergeTarget(run: RunState, id: SkillId): boolean {
  const to = getSkill(id).upgradesTo;
  return !!to && isPlusSkill(to) && SLOT_KEYS.some((k) => run.slots[k] === id && !isSlotLocked(run, k));
}

/** バージョンアップできるスロットか（スキルが入っていて、強化先がある。道具は強化先がない）。固定スロット（21 の会心の一撃）も、バージョンアップだけはできる。 */
export function canUpgradeSlot(run: RunState, key: SlotKey): boolean {
  const id = run.slots[key];
  if (!id) return false;
  const to = getSkill(id).upgradesTo;
  return !!to && canPlaceAt(getSkill(to), key); // 強化先が、そのスロットに置けること（レア度は同じなので、ふつうは置ける）
}

/** 祠のバージョンアップ: スロットのスキルを、一段階強いスキル（「＋」。会心の一撃は次の段階）に変える。レア度は変わらない。 */
export function upgradeSlot(run: RunState, key: SlotKey): SkillId | null {
  if (!canUpgradeSlot(run, key)) return null;
  const to = getSkill(run.slots[key]!).upgradesTo!;
  run.slots[key] = to;
  return to;
}

/** 図鑑に載っているスキルは出やすい（重み ×2）。 */
export const CODEX_BOOST = 2;

/**
 * 敵撃破の報酬（3択 + 祭壇の「見る目」）。**スキルだけ**（道具・防具は出ない。ショップでだけ買える）。
 * 倒した敵に合わせて、その敵の落とし物（`ENEMY_DROPS`）から count - 1 個 + 全体から 1 個。敵が分からなければ、全体から。
 * レア度が高いほど出にくい（割合は階層ごと）。図鑑に載っているスキルは出やすい。
 */
export function offerSkills(rng: Rng, run?: RunState, enemyId?: string): SkillId[] {
  const favored = new Set(run?.favored ?? []);
  const stage = run?.stage ?? 1;
  const rarityOf = (id: SkillId) => rarityOfSkill(getSkill(id));
  const boost = (id: SkillId): number => (favored.has(id) ? CODEX_BOOST : 1);
  const weight = tierWeights(SKILL_POOL, rarityOf, stage);
  const w = (id: SkillId): number => weight(id) * boost(id);
  const count = 3 + (run?.bonus.extraChoices ?? 0);
  const themed = dropsOf(enemyId).filter((id) => SKILL_POOL.includes(id));
  const fromTheme = themed.length > 0 ? pickWeighted(themed, Math.min(count - 1, themed.length), rng, w) : [];
  const rest = SKILL_POOL.filter((id) => !fromTheme.includes(id));
  return [...fromTheme, ...pickWeighted(rest, count - fromTheme.length, rng, w)];
}

/**
 * 敵の落とし物のなかでの、出やすさの割合（%の整数。レア度の高い順、同じなら割合の高い順）。
 * 落とし物からの抽選（offerSkills の fromTheme）と同じ重み（レア度の割合 × 図鑑のブースト）で、落とし物だけの中で割る。
 */
export function dropChances(run: RunState, enemyId: string): { id: SkillId; percent: number }[] {
  const favored = new Set(run.favored ?? []);
  const rarityOf = (id: SkillId) => rarityOfSkill(getSkill(id));
  const weight = tierWeights(SKILL_POOL, rarityOf, run.stage);
  const w = (id: SkillId): number => weight(id) * (favored.has(id) ? CODEX_BOOST : 1);
  const themed = dropsOf(enemyId).filter((id) => SKILL_POOL.includes(id));
  const total = themed.reduce((sum, id) => sum + w(id), 0);
  return themed
    .map((id) => ({ id, percent: total > 0 ? Math.round((w(id) / total) * 100) : 0 }))
    .sort((a, b) => RARITY_ORDER[rarityOf(a.id)] - RARITY_ORDER[rarityOf(b.id)] || b.percent - a.percent);
}

/** 宝箱のレリック（3択）。所持済みは出ない。レア度が高いほど出にくい。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  const pool = RELIC_POOL.filter((r) => !owned.has(r.id));
  return pickWeighted(pool, 3, rng, tierWeights(pool, (r) => r.rarity ?? 'common', run.stage));
}
