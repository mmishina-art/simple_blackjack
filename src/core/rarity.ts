import type { Rng } from './util/Rng';

export type Rarity = 'common' | 'rare' | 'legend';

export const RARITY_LABEL: Record<Rarity, string> = { common: 'コモン', rare: 'レア', legend: 'レジェンド' };

/** 報酬の抽選での出やすさ。 */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, rare: 3, legend: 1 };

/** 階層が進むほど、レアが出やすくなる（1階層: 6:3:1、2階層: 4:4:2、3階層: 3:4:3）。 */
export function rarityWeights(stage: number): Record<Rarity, number> {
  if (stage >= 3) return { common: 3, rare: 4, legend: 3 };
  if (stage === 2) return { common: 4, rare: 4, legend: 2 };
  return RARITY_WEIGHT;
}

/** 重み付きで重複なしに count 個選ぶ。 */
export function pickWeighted<T>(pool: readonly T[], count: number, rng: Rng, weightOf: (item: T) => number): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length > 0) {
    const total = rest.reduce((sum, item) => sum + weightOf(item), 0);
    let roll = rng.next() * total;
    let idx = rest.findIndex((item) => (roll -= weightOf(item)) < 0);
    if (idx < 0) idx = rest.length - 1;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}
