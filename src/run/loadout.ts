import { getSkill, rarityOfSkill, type SkillId } from '../core/skills/Skill';
import type { RunState } from './Run';
import { sellFromInventory } from './shop';

/** 道具袋に入れておける数。 */
export const POUCH_SIZE = 1;

export interface InventoryEntry {
  id: SkillId;
  /** 同じスキルを持っている数。 */
  count: number;
}

export const RARITY_ORDER = { legend: 0, rare: 1, common: 2 } as const;

/** スキルをレア度の高い順に並べる（同じレア度は元の順）。 */
export function sortByRarity(ids: readonly SkillId[]): SkillId[] {
  return ids
    .map((id, index) => ({ id, index, order: RARITY_ORDER[rarityOfSkill(getSkill(id))] }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((x) => x.id);
}

/** 持ち物のスキルを、種類ごとにまとめて（個数つき）レア度の高い順に並べる。 */
export function inventoryEntries(run: RunState): InventoryEntry[] {
  const counts = new Map<SkillId, number>();
  for (const id of run.inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
  return sortByRarity([...counts.keys()]).map((id) => ({ id, count: counts.get(id)! }));
}

/**
 * 道具袋に入れる: 袋にはこれ 1 つだけを残し、ほかの持ち物は売る。売った分のゴールドと、売ったスキルを返す。
 * （ふだんの持ち物は 1 つまで。取得した直後だけ、いまの袋の中身と合わせて 2 つになる）
 */
export function stashInPouch(run: RunState, id: SkillId): { sold: SkillId[]; gold: number } | null {
  if (!run.inventory.includes(id)) return null;
  const others = run.inventory.filter((x, i) => !(x === id && i === run.inventory.indexOf(id)));
  let gold = 0;
  for (const other of others) gold += sellFromInventory(run, other) ?? 0;
  return { sold: others, gold };
}
