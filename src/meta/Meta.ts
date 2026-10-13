import { ARMOR_POOL, ITEM_POOL, SKILL_POOL } from '../core/skills/catalog';
import type { SkillId } from '../core/skills/Skill';
import { RELIC_POOL } from '../relics/catalog';

/**
 * メタ進行（周回をまたいで残るデータ）。
 *  - 魂片: 冒険が終わるたびに（負けても）得られる通貨。祭壇で恒久強化に使う
 *  - 図鑑: 入手したスキル・レリックの記録。報酬に出やすくなり、スキルは次回の初期スロットに置ける
 */
export interface MetaState {
  version: 1;
  shards: number;
  /** 祭壇の強化レベル（強化ID → レベル）。 */
  upgrades: Record<string, number>;
  codex: { skills: SkillId[]; relics: string[] };
  /** 出撃時に最初から置くスキル（空きスロットのキー → スキルID）。 */
  stats: { runs: number; clears: number; bestRow: number };
}

export const META_KEY = 'bj-meta-v1';

/** 廃止した強化「初期装備枠」の、レベルごとのコスト（買っていた分の返金に使う）。 */
const REMOVED_KIT_COSTS = [50, 100];

export function emptyMeta(): MetaState {
  return { version: 1, shards: 0, upgrades: {}, codex: { skills: [], relics: [] }, stats: { runs: 0, clears: 0, bestRow: 0 } };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumRecord = (v: unknown): v is Record<string, number> =>
  !!v && typeof v === 'object' && Object.values(v as object).every((x) => typeof x === 'number' && Number.isFinite(x));

/** 保存データを読み込む。壊れている・使えない場合は初期状態から始める。 */
export function loadMeta(storage: StorageLike | null = defaultStorage()): MetaState {
  const meta = emptyMeta();
  try {
    const raw = storage?.getItem(META_KEY);
    if (!raw) return meta;
    const d = JSON.parse(raw) as Partial<MetaState>;
    if (d.version !== 1) return meta;
    if (typeof d.shards === 'number' && d.shards >= 0) meta.shards = Math.floor(d.shards);
    if (isNumRecord(d.upgrades)) meta.upgrades = { ...d.upgrades };
    // 廃止した強化「初期装備枠」（出撃準備の廃止に伴う）: 買った分の魂片を返して、記録から消す（保存キーは変えない）
    const kit = meta.upgrades.kit ?? 0;
    if (kit > 0) meta.shards += REMOVED_KIT_COSTS.slice(0, kit).reduce((a, b) => a + b, 0);
    delete meta.upgrades.kit;
    if (d.codex && isStringArray(d.codex.skills)) meta.codex.skills = [...new Set(d.codex.skills)];
    if (d.codex && isStringArray(d.codex.relics)) meta.codex.relics = [...new Set(d.codex.relics)];
    if (d.stats && isNumRecord(d.stats)) meta.stats = { ...meta.stats, ...d.stats };
  } catch {
    /* 壊れたデータは無視して初期状態から */
  }
  return meta;
}

export function saveMeta(meta: MetaState, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* 保存できない環境でも遊べるようにする */
  }
}

// ---- 祭壇の強化 ----
export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** 各レベルの購入コスト（魂片）。長さ = 最大レベル。 */
  costs: readonly number[];
  /** 現在のレベルでの効果の説明。 */
  describe(level: number): string;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'vitality', name: '強き肉体', icon: '体', costs: [12, 20, 30, 45, 60], describe: (l) => `初期 HP +${l * 5}` },
  { id: 'might', name: '研ぎ澄まされた刃', icon: '刃', costs: [40, 80, 140], describe: (l) => `初期 POW +${l}` },
  { id: 'ward', name: '守りの心得', icon: '護', costs: [25, 45, 70], describe: (l) => `戦闘開始時のブロック +${l * 2}` },
  { id: 'rest', name: '安らぎの心得', icon: '休', costs: [20, 40, 70], describe: (l) => `宿屋の回復量 +${l * 10}%` },
  { id: 'insight', name: '見る目', icon: '眼', costs: [90], describe: (l) => `敵撃破の報酬スキルの選択肢 +${l}` },
];

export function upgradeLevel(meta: MetaState, id: string): number {
  return meta.upgrades[id] ?? 0;
}

export function upgradeDef(id: string): UpgradeDef {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}

/** 次のレベルのコスト。最大レベルなら null。 */
export function nextCost(meta: MetaState, id: string): number | null {
  return upgradeDef(id).costs[upgradeLevel(meta, id)] ?? null;
}

export function canBuy(meta: MetaState, id: string): boolean {
  const cost = nextCost(meta, id);
  return cost !== null && meta.shards >= cost;
}

export function buyUpgrade(meta: MetaState, id: string): boolean {
  const cost = nextCost(meta, id);
  if (cost === null || meta.shards < cost) return false;
  meta.shards -= cost;
  meta.upgrades[id] = upgradeLevel(meta, id) + 1;
  return true;
}

/** 冒険の開始時に適用される強化の合計。 */
export interface RunBonus {
  maxHp: number;
  attack: number;
  startBlock: number;
  innHeal: number;
  extraChoices: number;
}

export const NO_BONUS: RunBonus = { maxHp: 0, attack: 0, startBlock: 0, innHeal: 0, extraChoices: 0 };

export function computeBonus(meta: MetaState): RunBonus {
  const l = (id: string) => upgradeLevel(meta, id);
  return {
    maxHp: l('vitality') * 5,
    attack: l('might'),
    startBlock: l('ward') * 2,
    innHeal: l('rest') * 0.1,
    extraChoices: l('insight'),
  };
}

// ---- 魂片の獲得 ----
export interface RunSummary {
  /** 到達したマスの段（スタート=0）。 */
  maxRow: number;
  enemiesDefeated: number;
  cleared: boolean;
  /** 倒したボスの数のうち、最後の階層より前のもの（階層を踏破した数）。 */
  stagesCleared?: number;
}

export const SHARD_PER_ROW = 2;
export const SHARD_PER_ENEMY = 4;
export const SHARD_CLEAR_BONUS = 40;
/** 最後の階層より前の階層を踏破するたびの魂片。 */
export const SHARD_STAGE_BONUS = 12;

export function computeShards(s: RunSummary): number {
  return s.maxRow * SHARD_PER_ROW + s.enemiesDefeated * SHARD_PER_ENEMY + (s.stagesCleared ?? 0) * SHARD_STAGE_BONUS + (s.cleared ? SHARD_CLEAR_BONUS : 0);
}

/** 冒険の終了処理（負けても魂片が入る）。獲得量を返す。 */
export function finishRun(meta: MetaState, s: RunSummary): number {
  const gained = computeShards(s);
  meta.shards += gained;
  meta.stats.runs++;
  if (s.cleared) meta.stats.clears++;
  meta.stats.bestRow = Math.max(meta.stats.bestRow, s.maxRow);
  return gained;
}

// ---- 図鑑 ----
/** 最初から図鑑に載っているスキル（初期スロットのスキル）。 */
export const STARTER_SKILLS: readonly SkillId[] = ['small_attack', 'herb', 'big_attack', 'ace_strike'];

export function isSkillDiscovered(meta: MetaState, id: SkillId): boolean {
  return STARTER_SKILLS.includes(id) || meta.codex.skills.includes(id);
}

export function isRelicDiscovered(meta: MetaState, id: string): boolean {
  return meta.codex.relics.includes(id);
}

/** 図鑑に登録する。新規登録なら true。 */
export function discoverSkill(meta: MetaState, id: SkillId): boolean {
  if (isSkillDiscovered(meta, id)) return false;
  meta.codex.skills.push(id);
  return true;
}

export function discoverRelic(meta: MetaState, id: string): boolean {
  if (isRelicDiscovered(meta, id)) return false;
  meta.codex.relics.push(id);
  return true;
}

/** 図鑑のスキルの総数（道具は別に数える）。 */
export const CODEX_SKILL_TOTAL = new Set<SkillId>([...STARTER_SKILLS, ...SKILL_POOL].filter((id) => !ITEM_POOL.includes(id))).size;
/** 図鑑の道具の総数。 */
export const CODEX_ITEM_TOTAL = ITEM_POOL.length;
/** 図鑑の防具の総数。 */
export const CODEX_ARMOR_TOTAL = ARMOR_POOL.length;
export const CODEX_RELIC_TOTAL = RELIC_POOL.length;

/** 記録をすべて消して、最初の状態に戻す（魂片・祭壇の強化・図鑑・初期装備・戦績）。meta オブジェクトはそのまま使い続けられる。 */
export function resetAllMeta(meta: MetaState): void {
  Object.assign(meta, emptyMeta());
}
