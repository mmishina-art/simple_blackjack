import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';

export const Slime: EnemyDef = {
  id: 'slime',
  name: 'スライム',
  maxHp: 40,
  ai: new DealerAI(17),
};
