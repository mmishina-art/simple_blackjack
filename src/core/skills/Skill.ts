import type { Rarity } from '../rarity';

/** スキルの効果。判別共用体なので、バフやドロー等を後から追加できる。 */
export type SkillEffect =
  /** 基本攻撃力（ATK）を基準にしたダメージ: floor(ATK × mult) + add。 */
  | { type: 'attack'; mult: number; add?: number }
  | { type: 'heal'; amount: number }
  | { type: 'block'; amount: number };

export type SkillId = string;

export interface SkillDef {
  id: SkillId;
  name: string;
  /** スロット表に表示する1文字。 */
  icon: string;
  effects: SkillEffect[];
  /** レア度。省略時はコモン。 */
  rarity?: Rarity;
}

/** 合計値スロット。キー 11 は「11以下」を表す。 */
export const SLOT_MIN = 11;
export const SLOT_MAX = 21;
export type SlotKey = number;
export type SlotTable = Partial<Record<SlotKey, SkillId>>;

export const SLOT_KEYS: readonly SlotKey[] = Array.from({ length: SLOT_MAX - SLOT_MIN + 1 }, (_, i) => SLOT_MIN + i);

/** 合計値 → スロットキー（11以下は 11 に丸める）。バースト（22以上）は呼び出し側で除外すること。 */
export function slotKeyOf(total: number): SlotKey {
  return Math.max(SLOT_MIN, Math.min(total, SLOT_MAX));
}

export function slotLabel(key: SlotKey): string {
  return key === SLOT_MIN ? '≤11' : String(key);
}

/** [from, to, skillId] の範囲指定からスロット表を作る（両端を含む）。 */
export function slotsFromRanges(spec: ReadonlyArray<readonly [number, number, SkillId]>): SlotTable {
  const table: SlotTable = {};
  for (const [from, to, id] of spec) {
    for (let k = Math.max(from, SLOT_MIN); k <= Math.min(to, SLOT_MAX); k++) table[k] = id;
  }
  return table;
}

const registry = new Map<SkillId, SkillDef>();

export function defineSkill(def: SkillDef): SkillDef {
  registry.set(def.id, def);
  return def;
}

export function getSkill(id: SkillId): SkillDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown skill: ${id}`);
  return def;
}

/** 登録済みスキルのレア度をまとめて設定する。 */
export function assignRarity(ids: readonly SkillId[], rarity: Rarity): void {
  for (const id of ids) getSkill(id).rarity = rarity;
}

export function rarityOfSkill(skill: SkillDef): Rarity {
  return skill.rarity ?? 'common';
}

/** 空スロット（= 通常攻撃）を表すアイコン。 */
export const BASIC_ICON = '攻';

/** スロット未設定（空スロット）のときの表記。空スロット = 通常攻撃。 */
export function fallbackLabel(skill: SkillDef): string {
  return skill.id === 'basic_attack' ? '通常攻撃' : `通常攻撃（${skill.name}）`;
}

export function hasSkill(id: SkillId): boolean {
  return registry.has(id);
}

export function hasAttack(skill: SkillDef): boolean {
  return skill.effects.some((e) => e.type === 'attack');
}

/** 攻撃効果のダメージ: floor(ATK × 倍率) + 加算。 */
export function attackValue(effect: { mult: number; add?: number }, atk: number): number {
  const value = Math.floor(atk * effect.mult) + (effect.add ?? 0);
  // 攻撃スキルは、最低でも 1 ダメージ（基本攻撃力が 1 のスロットで、小攻撃が 0 にならないように）
  return effect.mult > 0 ? Math.max(1, value) : value;
}

/** 「ATK×3+2」のような計算式の表記。 */
export function attackFormula(effect: { mult: number; add?: number }): string {
  const mult = effect.mult === 1 ? 'ATK' : `ATK×${effect.mult}`;
  return effect.add ? `${mult}+${effect.add}` : mult;
}

/** 範囲つきの要約。攻撃は「攻撃 ATK×3＝6〜30」のように、基本攻撃力が atkMin〜atkMax のときの実数値を示す（スロットが決まっていないとき用）。 */
export function describeSkillRange(skill: SkillDef, atkMin: number, atkMax: number): string {
  return skill.effects
    .map((e) => {
      if (e.type === 'attack') return `攻撃 ${attackFormula(e)}＝${attackValue(e, atkMin)}〜${attackValue(e, atkMax)}`;
      return e.type === 'block' ? `Block ${e.amount}` : `回復 ${e.amount}`;
    })
    .join(' + ');
}

/** 「攻撃 ATK×3+2＝14」「Block 6」のような効果の要約。atk を渡すと実数値も併記する。 */
export function describeSkill(skill: SkillDef, atk?: number): string {
  return skill.effects
    .map((e) => {
      if (e.type === 'attack') return `攻撃 ${attackFormula(e)}${atk !== undefined ? `＝${attackValue(e, atk)}` : ''}`;
      return e.type === 'block' ? `Block ${e.amount}` : `回復 ${e.amount}`;
    })
    .join(' + ');
}
