import { ENEMY_SLOTS } from '../../skills/catalog';
import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';

export const Slime: EnemyDef = {
  id: 'slime',
  name: 'スライム',
  maxHp: 16,
  attack: 3,
  ai: new DealerAI(17),
  slots: ENEMY_SLOTS.slime,
  fallbackSkill: 'slime_touch',
};
