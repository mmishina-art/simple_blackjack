import type { Rarity } from '../rarity';

/** スキルの効果。判別共用体なので、バフやドロー等を後から追加できる。 */
export type SkillEffect =
  /** 基本パワー（POW）を基準にしたダメージ: floor(POW × mult) + add。pierce なら相手の Block を無視して、その Block を破壊する（会心の一撃）。 */
  | { type: 'attack'; mult: number; add?: number; pierce?: boolean }
  /**
   * 回復・Block も基本パワーが基準: floor(POW × mult) + amount。上位のスキルほど amount（固定の上乗せ）が大きい（例: +1 / +3 / +5）。
   * mult を省略すると固定量（敵のスキルなど）で、amount のまま。
   */
  | { type: 'heal'; amount: number; mult?: number }
  | { type: 'block'; amount: number; mult?: number };

export type SkillId = string;

export interface SkillDef {
  /**
   * 'skill'（省略時）= 基本パワー（POW）が基準で、スロットが高いほど強い。
   * 'item'（道具）= POW に関係なく、効果は固定。レリックで強化できるものもある。スロットに置く。
   * 'armor'（防具）= 防御スロットに置く。防御したラウンドの被ダメージの上限（damageCap）を決める。
   */
  kind?: 'skill' | 'item' | 'armor';
  id: SkillId;
  name: string;
  /** スロット表に表示する1文字。 */
  icon: string;
  effects: SkillEffect[];
  /** レア度。省略時はコモン。 */
  rarity?: Rarity;
  /** 防具の効果: 防御したラウンドに受けるダメージ（HP の減少）の上限。 */
  damageCap?: number;
  /** 防具の効果: 防御したときに回復する HP。 */
  defendHeal?: number;
  /** 祠のバージョンアップで変わる先（コモン→レア、レア→レジェンド）。ないスキル・道具は強化できない。 */
  upgradesTo?: SkillId;
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

/** 道具（効果が基本パワーに関係なく固定）か。 */
export function isItem(skill: SkillDef): boolean {
  return skill.kind === 'item';
}

/** 防具か。 */
export function isArmor(skill: SkillDef): boolean {
  return skill.kind === 'armor';
}

export type SkillKind = 'skill' | 'item' | 'armor';

export function kindOfSkill(skill: SkillDef): SkillKind {
  return skill.kind ?? 'skill';
}

/** 種類の表示名（札・見出し）。 */
export const KIND_LABEL: Record<SkillKind, string> = { skill: 'スキル', item: '道具', armor: '防具' };

export function hasSkill(id: SkillId): boolean {
  return registry.has(id);
}

export function hasAttack(skill: SkillDef): boolean {
  return skill.effects.some((e) => e.type === 'attack');
}

/** 攻撃効果のダメージ: floor(POW × 倍率) + 加算。 */
export function attackValue(effect: { mult: number; add?: number }, atk: number): number {
  const value = Math.floor(atk * effect.mult) + (effect.add ?? 0);
  // 攻撃スキルは、最低でも 1 ダメージ（基本パワーが 1 のスロットで、小攻撃が 0 にならないように）
  return effect.mult > 0 ? Math.max(1, value) : value;
}

/** 「POW×3+2」のような計算式の表記。 */
export function attackFormula(effect: { mult: number; add?: number }): string {
  if (!effect.mult) return String(effect.add ?? 0); // 固定ダメージ（道具）
  const mult = effect.mult === 1 ? 'POW' : `POW×${effect.mult}`;
  return effect.add ? `${mult}+${effect.add}` : mult;
}

/** Block・回復の量: floor(POW × mult) + amount（mult を省略した固定量は amount のまま）。 */
export function supportValue(effect: { amount: number; mult?: number }, atk: number): number {
  return Math.max(0, Math.floor(atk * (effect.mult ?? 0)) + effect.amount);
}

/** 「POW+3」「POW×0.5+2」のような表記。固定量は数字だけ。 */
export function supportFormula(effect: { amount: number; mult?: number }): string {
  if (!effect.mult) return String(effect.amount);
  const mult = effect.mult === 1 ? 'POW' : `POW×${effect.mult}`;
  return effect.amount ? `${mult}+${effect.amount}` : mult;
}

/** 効果の要約。atk を渡すと実数値（＝16）も併記する。 */
function describeEffects(skill: SkillDef, atk?: number): string {
  if (skill.damageCap !== undefined) return `防御: 被ダメージ最大 ${skill.damageCap}${skill.defendHeal ? `・HP +${skill.defendHeal}` : ''}`;
  const value = (v: (atk: number) => number): string => (atk === undefined ? '' : `＝${v(atk)}`);
  return skill.effects
    .map((e) => {
      if (e.type === 'attack') return `攻撃 ${attackFormula(e)}${e.mult ? value((a) => attackValue(e, a)) : ''}${e.pierce ? '（Block無視・破壊）' : ''}`;
      const label = e.type === 'block' ? 'Block' : '回復';
      // 固定量（mult なし）は、基本パワーに関係ないので、数字だけ
      return e.mult ? `${label} ${supportFormula(e)}${value((a) => supportValue(e, a))}` : `${label} ${e.amount}`;
    })
    .join(' + ');
}

/** 基本パワーに対する上乗せの表記: 「+5」「×1.5+3」。倍率が 1 で上乗せがなければ「+0」。 */
function bonusFormula(mult: number, add: number): string {
  if (mult === 1) return `+${add}`;
  return add ? `×${mult}+${add}` : `×${mult}`;
}

/**
 * スロットが決まっていない一覧（報酬・持ち物・バナー）用の短い説明。基本パワーはスロットで変わるので、幅（「7〜15」）では示さず、
 * 基本パワーに対する上乗せだけを示す（「攻撃 +5」「Block +3」「回復 +3」「攻撃 ×1.5+3」）。固定量は数字のまま。
 */
export function describeSkillBonus(skill: SkillDef): string {
  if (skill.damageCap !== undefined) return `防御: 被ダメージ最大 ${skill.damageCap}${skill.defendHeal ? `・HP +${skill.defendHeal}` : ''}`;
  return skill.effects
    .map((e) => {
      if (e.type === 'attack') return `攻撃 ${e.mult ? bonusFormula(e.mult, e.add ?? 0) : (e.add ?? 0)}${e.pierce ? '（Block無視・破壊）' : ''}`;
      const label = e.type === 'block' ? 'Block' : '回復';
      return e.mult ? `${label} ${bonusFormula(e.mult, e.amount)}` : `${label} ${e.amount}`;
    })
    .join(' + ');
}

/** 「攻撃 POW×3+2＝14」「Block POW+3＝8」のような効果の要約。atk を渡すと実数値も併記する。 */
export function describeSkill(skill: SkillDef, atk?: number): string {
  return describeEffects(skill, atk);
}

/**
 * スロット表の右側に出す、短い効果表示（種類と値だけ）。例: `攻撃 15` / `Block 6` / `攻撃 6×2`（2回攻撃）/ `攻撃 8 + 回復 5`。
 * 計算式は describeSkill（マウスを乗せたときの詳細）にある。atk は、そのスロットの基本パワー。
 */
export function describeSkillShort(skill: SkillDef, atk: number): string {
  if (skill.damageCap !== undefined) return `被ダメージ最大 ${skill.damageCap}${skill.defendHeal ? ` + 回復 ${skill.defendHeal}` : ''}`;
  const parts: { label: string; value: number; count: number }[] = [];
  for (const e of skill.effects) {
    const label = e.type === 'attack' ? '攻撃' : e.type === 'block' ? 'Block' : '回復';
    const value = e.type === 'attack' ? attackValue(e, atk) : supportValue(e, atk);
    const last = parts[parts.length - 1];
    if (last && last.label === label && last.value === value) last.count++;
    else parts.push({ label, value, count: 1 });
  }
  return parts.map((p) => `${p.label} ${p.value}${p.count > 1 ? `×${p.count}` : ''}`).join(' + ');
}

/** ①〜⑳、㉑〜㉟ の丸数字（スロットの基本値の表示）。範囲外は「(n)」。 */
export function circledNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) return `(${n})`;
  if (n <= 20) return String.fromCharCode(0x2460 + n - 1);
  if (n <= 35) return String.fromCharCode(0x3251 + n - 21);
  return `(${n})`;
}

export interface EffectTotals { attack: number; block: number; heal: number }

/** スキルの効果を、種類ごとの合計にする（攻撃は複数回の合計）。ビフォーアフターの比較に使う。atk は、そのスロットの基本パワー。 */
export function effectTotals(skill: SkillDef, atk: number): EffectTotals {
  const t: EffectTotals = { attack: 0, block: 0, heal: 0 };
  for (const e of skill.effects) {
    if (e.type === 'attack') t.attack += attackValue(e, atk);
    else if (e.type === 'block') t.block += supportValue(e, atk);
    else t.heal += supportValue(e, atk);
  }
  return t;
}

/**
 * ビフォーアフターの差分の行。例: `攻撃 5 → 8（+3）` / `回復 8 → なし（−8）` / `Block なし → 6（+6）`。
 * どちらにもない種類は出さない。ぜんぶ同じなら「効果は変わらない」。色だけに頼らず、符号と文字でも増減が分かる。
 */
export function diffLines(before: EffectTotals, after: EffectTotals): string[] {
  const lines: string[] = [];
  for (const [key, label] of [['attack', '攻撃'], ['block', 'Block'], ['heal', '回復']] as const) {
    const b = before[key];
    const a = after[key];
    if (b === 0 && a === 0) continue;
    const show = (v: number): string => (v === 0 ? 'なし' : String(v));
    const delta = a - b === 0 ? '変わらない' : `${a > b ? '+' : '−'}${Math.abs(a - b)}`;
    lines.push(`${label} ${show(b)} → ${show(a)}（${delta}）`);
  }
  return lines.length > 0 ? lines : ['効果は変わらない'];
}

/**
 * レア度ごとの、置けるスロットの下限（合計値）。コモン=どこでも / レア=15 以上 / レジェンド=18 以上。
 * スキルと道具に適用する（防具は防御スロット専用）。強いものほど、高い合計値でしか発動できない。
 */
export const RARITY_MIN_SLOT: Record<Rarity, number> = { common: SLOT_MIN, rare: 15, legend: 18 };

/** そのスキル・道具が置ける、いちばん小さいスロット。 */
export function minSlotOf(skill: SkillDef): number {
  return RARITY_MIN_SLOT[rarityOfSkill(skill)];
}

/** そのスロットに置けるか（レア度の制限。防具は、スロットには置けない）。 */
export function canPlaceAt(skill: SkillDef, key: SlotKey): boolean {
  return !isArmor(skill) && key >= minSlotOf(skill);
}

/** 置ける場所の説明（制限がなければ空）。例: `18 以上のスロットにだけ置ける`。 */
export function placementNote(skill: SkillDef): string {
  const min = minSlotOf(skill);
  return min > SLOT_MIN && !isArmor(skill) ? `${min} 以上のスロットにだけ置ける` : '';
}
