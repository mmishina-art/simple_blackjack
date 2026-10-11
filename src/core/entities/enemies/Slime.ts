import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';

export const Slime: EnemyDef = {
  id: 'slime',
  name: 'スライム',
  maxHp: 16,
  exp: 15,
  ai: new DealerAI(17),
};
