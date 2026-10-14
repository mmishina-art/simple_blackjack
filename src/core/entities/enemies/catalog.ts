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
  id: 'thirst', name: '屍の渇き', icon: '渇', description: 'HP を削るたびに HP +2',
  apply({ bus, enemy }) {
    bus.on('onDamageDealt', ({ attacker, hpLoss }) => {
      if (attacker === enemy && hpLoss > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + 2);
    });
  },
};

const BREATH_BONUS = 3;

const DragonBreath: Relic = {
  id: 'breath', name: '竜の息吹', icon: '炎', description: `攻撃ダメージ +${BREATH_BONUS}`,
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === enemy && p.damage > 0) return { ...p, damage: p.damage + BREATH_BONUS };
    });
  },
};


// ---- 第1階層のボス・第2階層・第3階層の敵の特性 ----
const IronClad: Relic = {
  id: 'ironclad', name: '重装', icon: '甲', description: '戦闘開始時にブロック 6',
  apply({ bus, enemy }) {
    bus.on('onBattleStart', () => { enemy.block += 6; });
  },
};

const Regeneration = (amount: number): Relic => ({
  id: 'regen', name: '再生', icon: '再', description: `ラウンドの初めに HP +${amount}`,
  apply({ bus, enemy }) {
    bus.on('onRoundStart', () => { enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount); });
  },
});

const StoneSkin = (by: number): Relic => ({
  id: 'stone', name: '石の肌', icon: '岩', description: `受けるダメージ -${by}`,
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === enemy) return { ...p, damage: reduceDamage(p.damage, by) };
    });
  },
});

/** 鋼鉄のゴーレム: ブロックを重ねる。ラウンドの初めにブロック +2、上限 14（積み上がりすぎて倒せなくならないように）。 */
const STEEL_BLOCK_CAP = 14;
const SteelGuard: Relic = {
  id: 'steelguard', name: '鋼の守り', icon: '鋼', description: `ラウンドの初めにブロック +2（上限 ${STEEL_BLOCK_CAP}）`,
  apply({ bus, enemy }) {
    bus.on('onRoundStart', () => { enemy.block = Math.min(STEEL_BLOCK_CAP, enemy.block + 2); });
    bus.on('onBlockApplied', ({ entity }) => { if (entity === enemy) enemy.block = Math.min(STEEL_BLOCK_CAP, enemy.block); });
  },
};

const Chill: Relic = {
  id: 'chill', name: '冷気', icon: '冷', description: 'ラウンドの初めに、あなたのブロックが 2 減る',
  apply({ bus, player }) {
    bus.on('onRoundStart', () => { player.block = Math.max(0, player.block - 2); });
  },
};

const Contract: Relic = {
  id: 'contract', name: '悪魔の取引', icon: '契', description: '合計値が同値のとき、必ず先攻になる',
  apply({ bus }) {
    bus.on('onInitiativeDecided', (p) => {
      if (p.turn.mode === 'simultaneous') {
        return { ...p, turn: { ...p.turn, mode: 'sequential', first: 'enemy', second: 'player' } };
      }
    });
  },
};

const Scorch: Relic = {
  id: 'scorch', name: '燃焼', icon: '燃', description: '攻撃ダメージ +2',
  apply({ bus, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === enemy && p.damage > 0) return { ...p, damage: p.damage + 2 };
    });
  },
};

export const Skeleton: EnemyDef = {
  id: 'skeleton', name: '骸骨兵', maxHp: 18, attack: 4, ai: new DealerAI(15), slots: ENEMY_SLOTS.skeleton, fallbackSkill: 'skel_stab',
  trait: '骨の鎧（受けるダメージ -2）', relics: [BoneArmor],
};

export const GiantBat: EnemyDef = {
  id: 'bat', name: '大蝙蝠', maxHp: 16, attack: 3, ai: new DealerAI(13), slots: ENEMY_SLOTS.bat, fallbackSkill: 'bat_nip',
  trait: '超音波（同値なら必ず先攻）。13で止まり、低い合計で急降下してくる', relics: [Ultrasound],
};

export const Ghoul: EnemyDef = {
  id: 'ghoul', name: '屍食鬼', maxHp: 18, attack: 4, ai: new DealerAI(16), slots: ENEMY_SLOTS.ghoul, fallbackSkill: 'ghoul_scratch',
  trait: '屍の渇き（HPを削るたびに HP +2）', relics: [CorpseThirst],
};

export const BlackDragon: EnemyDef = {
  id: 'dragon', name: '黒竜', maxHp: 90, attack: 6, attackBonus: BREATH_BONUS, ai: new DealerAI(18), slots: ENEMY_SLOTS.dragon, fallbackSkill: 'dragon_swipe',
  trait: '竜の息吹（攻撃ダメージ +3）', relics: [DragonBreath],
};


// ---- 第1階層のボス ----
export const GraveKnight: EnemyDef = {
  id: 'knight', name: '墓守の騎士', maxHp: 30, attack: 4, ai: new DealerAI(17), slots: ENEMY_SLOTS.knight, fallbackSkill: 'knight_slash',
  trait: '重装（戦闘開始時にブロック 6）', relics: [IronClad],
};

// ---- 第2階層: 沈んだ大聖堂 ----
export const Merman: EnemyDef = {
  id: 'merman', name: '沼の魚人', maxHp: 26, attack: 4, ai: new DealerAI(15), slots: ENEMY_SLOTS.merman, fallbackSkill: 'merman_jab',
  trait: '再生（ラウンドの初めに HP +1）', relics: [Regeneration(1)],
};

export const Gargoyle: EnemyDef = {
  id: 'gargoyle', name: 'ガーゴイル', maxHp: 26, attack: 4, ai: new DealerAI(16), slots: ENEMY_SLOTS.gargoyle, fallbackSkill: 'garg_claw',
  trait: '石の肌（受けるダメージ -3）', relics: [StoneSkin(3)],
};

export const Wraith: EnemyDef = {
  id: 'wraith', name: '亡霊', maxHp: 22, attack: 4, ai: new DealerAI(16), slots: ENEMY_SLOTS.wraith, fallbackSkill: 'wraith_touch',
  trait: '冷気（ラウンドの初めに、あなたのブロックが 2 減る）', relics: [Chill],
};

export const IronGolem: EnemyDef = {
  id: 'iron_golem', name: '鋼鉄のゴーレム', maxHp: 32, attack: 4, ai: new DealerAI(15), slots: ENEMY_SLOTS.iron_golem, fallbackSkill: 'ig_punch',
  trait: '鋼の守り（ラウンドの初めにブロック +2、上限 14）。ブロックを無視する攻撃や、一撃の重いスキルが効く', relics: [SteelGuard],
};

export const Serpent: EnemyDef = {
  id: 'serpent', name: '深淵の海蛇', maxHp: 48, attack: 5, ai: new DealerAI(18), slots: ENEMY_SLOTS.serpent, fallbackSkill: 'serpent_bite',
  trait: '再生（ラウンドの初めに HP +2）', relics: [Regeneration(2)],
};

// ---- 第3階層: 竜の巣 ----
export const FlameSpirit: EnemyDef = {
  id: 'flame', name: '炎の精霊', maxHp: 40, attack: 5, attackBonus: 2, ai: new DealerAI(17), slots: ENEMY_SLOTS.flame, fallbackSkill: 'flame_spark',
  trait: '燃焼（攻撃ダメージ +2）', relics: [Scorch],
};

export const LavaGolem: EnemyDef = {
  id: 'golem', name: '溶岩ゴーレム', maxHp: 46, attack: 5, ai: new DealerAI(15), slots: ENEMY_SLOTS.golem, fallbackSkill: 'golem_punch',
  trait: '石の肌（受けるダメージ -3）', relics: [StoneSkin(3)],
};

export const Imp: EnemyDef = {
  id: 'imp', name: '業火の悪魔', maxHp: 42, attack: 5, ai: new DealerAI(17), slots: ENEMY_SLOTS.imp, fallbackSkill: 'imp_stab',
  trait: '悪魔の取引（同値なら必ず先攻）', relics: [Contract],
};

/** 冒険の敵の一覧（階層ごとの並びは、各階層のマップが決める）。 */
export const ENEMY_LINEUP: readonly EnemyDef[] = [
  Slime, Skeleton, GiantBat, Ghoul, GraveKnight,
  Merman, Gargoyle, Wraith, IronGolem, Serpent,
  FlameSpirit, LavaGolem, Imp, BlackDragon,
];

export function getEnemy(id: string): EnemyDef {
  const e = ENEMY_LINEUP.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}
