import { getSkill } from '../core/skills/Skill';
import type { Relic } from './Relic';

/** ダメージが正のときだけ軽減する（最低1）。0 のダメージは増やさない。 */
export const reduceDamage = (damage: number, by: number): number => (damage > 0 ? Math.max(1, damage - by) : damage);

export const Whetstone: Relic = {
  id: 'whetstone', name: '血塗れの砥石', icon: '砥',
  description: '与える攻撃ダメージ +3',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === player && p.damage > 0) return { ...p, damage: p.damage + 3 };
    });
  },
};

export const Breastplate: Relic = {
  id: 'breastplate', name: '鋼の胸当て', icon: '胸',
  description: '受ける攻撃ダメージ -2（最低1）',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === player) return { ...p, damage: reduceDamage(p.damage, 2) };
    });
  },
};

export const VampireFang: Relic = {
  id: 'fang', name: '吸血の牙', icon: '牙',
  description: '敵の HP を削るたび、HP +3',
  apply({ bus, player }) {
    bus.on('onDamageDealt', ({ attacker, hpLoss }) => {
      if (attacker === player && hpLoss > 0) player.hp = Math.min(player.maxHp, player.hp + 3);
    });
  },
};

export const ScapegoatDoll: Relic = {
  id: 'doll', name: '身代わりの人形', icon: '偶',
  description: '各バトルで最初にバーストしたとき、敵のクリティカルを無効にする',
  apply({ bus }) {
    let used = false;
    bus.on('onInitiativeDecided', (p) => {
      if (!used && p.playerBust && p.turn.crit.enemy) {
        used = true;
        return { ...p, turn: { ...p.turn, crit: { ...p.turn.crit, enemy: false } } };
      }
    });
  },
};

export const FateRing: Relic = {
  id: 'ring', name: '運命の指輪', icon: '輪',
  description: '合計値が同値で同時攻撃になったとき、自分の攻撃がクリティカルになる',
  apply({ bus }) {
    bus.on('onInitiativeDecided', (p) => {
      if (p.turn.mode === 'simultaneous') return { ...p, turn: { ...p.turn, crit: { ...p.turn.crit, player: true } } };
    });
  },
};

export const Boots: Relic = {
  id: 'boots', name: '疾風の靴', icon: '靴',
  description: '合計値が同値のとき、必ず先攻になる（同時攻撃にならない）',
  apply({ bus }) {
    bus.on('onInitiativeDecided', (p) => {
      if (p.turn.mode === 'simultaneous') {
        return { ...p, turn: { ...p.turn, mode: 'sequential', first: 'player', second: 'enemy' } };
      }
    });
  },
};

export const SturdyShield: Relic = {
  id: 'shield', name: '堅牢の盾', icon: '盾',
  description: '獲得する Block +3',
  apply({ bus, player }) {
    bus.on('onBlockGained', (p) => {
      if (p.entity === player) return { ...p, amount: p.amount + 3 };
    });
  },
};

export const LifeCandle: Relic = {
  id: 'candle', name: '命の蝋燭', icon: '燭',
  description: '各バトルの開始時に HP +8',
  apply({ bus, player }) {
    bus.on('onBattleStart', () => {
      player.hp = Math.min(player.maxHp, player.hp + 8);
    });
  },
};

export const OverlordOrb: Relic = {
  id: 'orb', name: '覇王の宝珠', icon: '珠',
  description: '会心の一撃が「覇王の一撃」（攻撃16・必ず会心 + Block 8）に変わる',
  apply({ bus, player }) {
    bus.on('onSkillActivated', (p) => {
      if (p.user === player && p.skill?.id === 'critical_strike') return { ...p, skill: getSkill('overlord_strike') };
    });
  },
};

export const SealKey: Relic = {
  id: 'key', name: '封印の鍵', icon: '鍵', unlocksSlot21: true,
  description: 'スロット21の封印が解け、好きなスキルを付け替えられる',
  apply() {},
};

/** 報酬として出現するレリックの一覧。 */
export const RELIC_POOL: readonly Relic[] = [
  Whetstone, Breastplate, VampireFang, ScapegoatDoll, FateRing, Boots, SturdyShield, LifeCandle, OverlordOrb, SealKey,
];
