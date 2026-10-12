import { SLOT_KEYS, SLOT_MIN, slotKeyOf, type SlotKey } from '../core/skills/Skill';

/**
 * 表示するスロット。敵が「minTotal 以上になるまで必ず引く」なら、それ未満の合計では手札が確定しないので出さない
 * （例: 17まで引く敵は 17〜21 だけ。表を見るだけで、その敵の個性が分かる）。キー 11 は「11以下」。
 */
export function gaugeKeys(minTotal?: number): SlotKey[] {
  const from = Math.max(minTotal ?? SLOT_MIN, SLOT_MIN);
  return SLOT_KEYS.filter((k) => k >= from);
}

/**
 * メーターの点灯。合計値までの左側のスロットがすべて点灯し（たまっていく）、いちばん右の点灯が tip（いま発動するスロット）。
 * 合計が不明（敵の伏せカード）・バーストなら、何も点灯しない。表示するスロットの最小値に届かないうちも点灯しない。
 */
export function gaugeState(keys: readonly SlotKey[], total: number, known: boolean, bust: boolean): { lit: ReadonlySet<SlotKey>; tip: SlotKey | null } {
  if (!known || bust) return { lit: new Set(), tip: null };
  const reach = slotKeyOf(total);
  const lit = new Set(keys.filter((k) => k <= reach));
  return { lit, tip: lit.has(reach) ? reach : null };
}
