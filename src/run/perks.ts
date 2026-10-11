import type { RunState } from './Run';

/** レベルアップ時に選ぶ恒久強化。 */
export interface Perk {
  id: string;
  name: string;
  icon: string;
  description: string;
  apply(run: RunState): void;
}

export const PERKS: readonly Perk[] = [
  {
    id: 'vitality', name: '生命の祝福', icon: '命', description: '最大HP +12（同じ量だけ回復）',
    apply(run) { run.maxHp += 12; run.hp += 12; },
  },
  {
    id: 'might', name: '剛腕', icon: '腕', description: '与えるダメージ +2',
    apply(run) { run.damageBonus += 2; },
  },
  {
    id: 'bulwark', name: '鉄壁', icon: '壁', description: '受けるダメージ -1（最低1）',
    apply(run) { run.damageReduction += 1; },
  },
  {
    id: 'prayer', name: '癒やしの祈り', icon: '祈', description: 'HP を全回復する',
    apply(run) { run.hp = run.maxHp; },
  },
];
