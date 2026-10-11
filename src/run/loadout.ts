import { sortByRarity } from '../meta/prep';
import type { SkillId } from '../core/skills/Skill';
import type { RunState } from './Run';

export interface InventoryEntry {
  id: SkillId;
  /** 同じスキルを持っている数。 */
  count: number;
}

/** 持ち物のスキルを、種類ごとにまとめて（個数つき）レア度の高い順に並べる。 */
export function inventoryEntries(run: RunState): InventoryEntry[] {
  const counts = new Map<SkillId, number>();
  for (const id of run.inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
  return sortByRarity([...counts.keys()]).map((id) => ({ id, count: counts.get(id)! }));
}
