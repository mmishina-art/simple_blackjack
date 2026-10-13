import { ALL_POOL } from '../core/skills/catalog';
import { pickWeighted, tierWeights } from '../core/rarity';
import { getSkill, rarityOfSkill } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { RELIC_POOL } from '../relics/catalog';
import type { RunState } from '../run/Run';

export const INN_HEAL_RATIO = 0.5;

/** 宿屋: 最大HPの50%回復。回復量を返す。 */
export function useInn(run: RunState): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * (INN_HEAL_RATIO + run.bonus.innHeal)));
  return run.hp - before;
}

export interface ShrineResult {
  id: string;
  title: string;
  text: string;
}

interface ShrineEffect {
  id: string;
  weight: number;
  /** 適用して結果を返す。条件を満たさず発動できない場合は null。 */
  apply(run: RunState, rng: Rng): ShrineResult | null;
}

const SHRINE_EFFECTS: ShrineEffect[] = [
  {
    id: 'spring', weight: 3,
    apply(run) {
      run.maxHp += 8;
      run.hp += 8;
      return { id: 'spring', title: '生命の泉', text: '最大 HP が 8 増えた。' };
    },
  },
  {
    id: 'might', weight: 2,
    apply(run) {
      run.baseAttack += 1;
      return { id: 'might', title: '力の祠', text: '基本攻撃力（ATK）が 1 上がった。' };
    },
  },
  {
    id: 'light', weight: 3,
    apply(run) {
      run.hp = run.maxHp;
      return { id: 'light', title: '癒やしの光', text: 'HP が全回復した。' };
    },
  },
  {
    id: 'old-art', weight: 3,
    apply(run, rng) {
      const id = pickWeighted(ALL_POOL, 1, rng, tierWeights(ALL_POOL, (sid) => rarityOfSkill(getSkill(sid)), run.stage))[0];
      run.inventory.push(id);
      return { id: 'old-art', title: '古き技の記憶', text: `「${getSkill(id).name}」を授かった。（持ち物に入った）` };
    },
  },
  {
    id: 'pact', weight: 2,
    apply(run, rng) {
      const owned = new Set(run.relics.map((r) => r.id));
      const pool = RELIC_POOL.filter((r) => !owned.has(r.id));
      if (pool.length === 0) return null;
      const relic = pickWeighted(pool, 1, rng, tierWeights(pool, (r) => r.rarity ?? 'common', run.stage))[0];
      const cost = Math.min(10, run.hp - 1);
      run.hp -= cost;
      run.relics.push(relic);
      return { id: 'pact', title: '血の契約', text: `HP を ${cost} 捧げ、「${relic.name}」を得た。` };
    },
  },
  {
    id: 'curse', weight: 2,
    apply(run) {
      const loss = Math.min(10, run.hp - 1);
      run.hp -= loss;
      return { id: 'curse', title: '呪いの囁き', text: `HP が ${loss} 失われた…` };
    },
  },
  {
    id: 'silence', weight: 2,
    apply() {
      return { id: 'silence', title: '静寂', text: '祠は何も応えなかった。' };
    },
  },
];

/** 祠: 重み付きランダムで効果が1つ発動する（発動できない効果は引き直し）。 */
export function resolveShrine(run: RunState, rng: Rng): ShrineResult {
  const effects = [...SHRINE_EFFECTS];
  while (effects.length > 0) {
    const total = effects.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng.next() * total;
    const idx = effects.findIndex((e) => (roll -= e.weight) < 0);
    const effect = effects[Math.max(0, idx)];
    const result = effect.apply(run, rng);
    if (result) return result;
    effects.splice(effects.indexOf(effect), 1);
  }
  return { id: 'silence', title: '静寂', text: '祠は何も応えなかった。' };
}
