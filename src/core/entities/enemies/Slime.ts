import { ENEMY_SLOTS } from '../../skills/catalog';
import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';

export const Slime: EnemyDef = {
  id: 'slime',
  name: 'スライム',
  size: 'small',
  maxHp: 14,
  attack: 3,
  weakness: 'fire',
  attackElement: 'ice',
  ai: new DealerAI(14),
  slots: ENEMY_SLOTS.slime,
  fallbackSkill: 'slime_touch',
};
