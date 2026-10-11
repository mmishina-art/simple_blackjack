/** 乱数源。Core は Math.random を直接使わず、これを注入して使う（テスト・リプレイ用）。 */
export interface Rng {
  /** [0, 1) */
  next(): number;
}

export const defaultRng: Rng = { next: () => Math.random() };

/** シード固定の乱数（mulberry32）。 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
