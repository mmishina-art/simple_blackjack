import { getSkill, rarityOfSkill, type SkillId } from '../core/skills/Skill';
import type { RunState } from './Run';

export interface InventoryEntry {
  id: SkillId;
  /** 同じスキルを持っている数。 */
  count: number;
}

const RARITY_ORDER = { legend: 0, rare: 1, common: 2 } as const;

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
