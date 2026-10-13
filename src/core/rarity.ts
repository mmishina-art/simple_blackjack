import type { Rng } from './util/Rng';

export type Rarity = 'common' | 'rare' | 'legend';

export const RARITY_LABEL: Record<Rarity, string> = { common: 'コモン', rare: 'レア', legend: 'レジェンド' };

/**
 * 報酬・宝箱・祠で、どのレア度が出るかの割合（階層ごと）。階層が進むほど、レアとレジェンドが出やすくなる。
 * 「レア度ごとの割合」なので、そのレア度のものが何個あっても、割合は変わらない（個数の多いレア度が出やすくなったりしない）。
 */
export const RARITY_RATE: Record<1 | 2 | 3, Record<Rarity, number>> = {
  1: { common: 70, rare: 27, legend: 3 },
  2: { common: 52, rare: 38, legend: 10 },
  3: { common: 38, rare: 47, legend: 15 },
};

export function rarityRates(stage: number): Record<Rarity, number> {
  return RARITY_RATE[Math.max(1, Math.min(3, Math.floor(stage))) as 1 | 2 | 3];
}

/**
 * 抽選の重み: そのレア度の割合を、候補の中の同じレア度の個数で割る（レア度ごとの割合が、個数に左右されない）。
 * 候補にないレア度は出ない（その分は、ほかのレア度に回る）。
 */
export function tierWeights<T>(pool: readonly T[], rarityOf: (item: T) => Rarity, stage: number): (item: T) => number {
  const rates = rarityRates(stage);
  const count: Record<Rarity, number> = { common: 0, rare: 0, legend: 0 };
  for (const item of pool) count[rarityOf(item)]++;
  return (item) => rates[rarityOf(item)] / count[rarityOf(item)];
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
