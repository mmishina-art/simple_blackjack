import type { Relic } from '../../../relics/Relic';
import { reduceDamage } from '../../../relics/catalog';
import { DealerAI } from './ai/DealerAI';
import type { EnemyDef } from './EnemyDef';
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
  id: 'ultrasound', name: '超音波', icon: '音', description: '引き分けのとき、あなたに 3 ダメージ',
  apply({ bus, player, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.result.outcome === 'push' && p.attacker === null) {
        return { ...p, attacker: enemy, defender: player, damage: 3 };
      }
    });
  },
};

const CorpseThirst: Relic = {
  id: 'thirst', name: '屍の渇き', icon: '渇', description: '勝つたびに HP +4',
  apply({ bus, enemy }) {
    bus.on('onResolve', ({ attacker, damage }) => {
      if (attacker === enemy && damage > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + 4);
    });
  },
};

const DragonBreath: Relic = {
  id: 'breath', name: '竜の息吹', icon: '炎', description: '勝ったときのダメージ +3',
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === enemy && p.damage > 0) return { ...p, damage: p.damage + 3 };
    });
  },
};

export const Skeleton: EnemyDef = {
  id: 'skeleton', name: '骸骨兵', maxHp: 28, exp: 20, ai: new DealerAI(16),
  trait: '骨の鎧（受けるダメージ -2）', relics: [BoneArmor],
};

export const GiantBat: EnemyDef = {
  id: 'bat', name: '大蝙蝠', maxHp: 26, exp: 25, ai: new DealerAI(18),
  trait: '超音波（引き分けでダメージ）。18まで引く危険な賭け', relics: [Ultrasound],
};

export const Ghoul: EnemyDef = {
  id: 'ghoul', name: '屍食鬼', maxHp: 38, exp: 30, ai: new DealerAI(17),
  trait: '屍の渇き（勝つたびHP回復）', relics: [CorpseThirst],
};

export const BlackDragon: EnemyDef = {
  id: 'dragon', name: '黒竜', maxHp: 56, exp: 50, ai: new DealerAI(18),
  trait: '竜の息吹（勝利時ダメージ +3）', relics: [DragonBreath],
};

/** 冒険の敵の並び順。 */
export const ENEMY_LINEUP: readonly EnemyDef[] = [Slime, Skeleton, GiantBat, Ghoul, BlackDragon];
