import type { EnemyAI } from './ai/EnemyAI';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  ai: EnemyAI;
}
