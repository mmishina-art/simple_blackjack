import type { Relic } from '../../../relics/Relic';
import { reduceDamage } from '../../../relics/catalog';
import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';
import { ENEMY_SLOTS } from '../../skills/catalog';
import { Slime } from './Slime';

const BoneArmor: Relic = {
  id: 'bone-armor', name: '骨の鎧', icon: '骨', description: '受けるダメージ -2',
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === enemy) return { ...p, damage: reduceDamage(p.damage, 2) };
    });
  },
};

const Ultrasound: Relic = {
  id: 'ultrasound', name: '超音波', icon: '音', description: '合計値が同値のとき、必ず先攻になる',
  apply({ bus }) {
    bus.on('onInitiativeDecided', (p) => {
      if (p.turn.mode === 'simultaneous') {
        return { ...p, turn: { ...p.turn, mode: 'sequential', first: 'enemy', second: 'player' } };
      }
    });
  },
};

const CorpseThirst: Relic = {
  id: 'thirst', name: '屍の渇き', icon: '渇', description: 'HP を削るたびに HP +4',
  apply({ bus, enemy }) {
    bus.on('onDamageDealt', ({ attacker, hpLoss }) => {
      if (attacker === enemy && hpLoss > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + 4);
    });
  },
};

const DragonBreath: Relic = {
  id: 'breath', name: '竜の息吹', icon: '炎', description: '攻撃ダメージ +3',
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === enemy && p.damage > 0) return { ...p, damage: p.damage + 3 };
    });
  },
};

export const Skeleton: EnemyDef = {
  id: 'skeleton', name: '骸骨兵', maxHp: 28, ai: new DealerAI(16), slots: ENEMY_SLOTS.skeleton, fallbackSkill: 'skel_stab',
  trait: '骨の鎧（受けるダメージ -2）', relics: [BoneArmor],
};

export const GiantBat: EnemyDef = {
  id: 'bat', name: '大蝙蝠', maxHp: 26, ai: new DealerAI(18), slots: ENEMY_SLOTS.bat, fallbackSkill: 'bat_nip',
  trait: '超音波（同値なら必ず先攻）。18まで引く危険な賭け', relics: [Ultrasound],
};

export const Ghoul: EnemyDef = {
  id: 'ghoul', name: '屍食鬼', maxHp: 38, ai: new DealerAI(17), slots: ENEMY_SLOTS.ghoul, fallbackSkill: 'ghoul_scratch',
  trait: '屍の渇き（HPを削るたびに回復）', relics: [CorpseThirst],
};

export const BlackDragon: EnemyDef = {
  id: 'dragon', name: '黒竜', maxHp: 46, ai: new DealerAI(18), slots: ENEMY_SLOTS.dragon, fallbackSkill: 'dragon_swipe',
  trait: '竜の息吹（攻撃ダメージ +3）', relics: [DragonBreath],
};

/** 冒険の敵の並び順。 */
export const ENEMY_LINEUP: readonly EnemyDef[] = [Slime, Skeleton, GiantBat, Ghoul, BlackDragon];
