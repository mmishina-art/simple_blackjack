import type { Relic } from './Relic';

/** 与えるダメージが正のときだけ補正する。0 のダメージを増やさない。 */
const reduce = (damage: number, by: number): number => (damage > 0 ? Math.max(1, damage - by) : damage);

export const Whetstone: Relic = {
  id: 'whetstone',
  name: '血塗れの砥石',
  icon: '砥',
  description: '敵に与えるダメージ +3',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === player && p.damage > 0) return { ...p, damage: p.damage + 3 };
    });
  },
};

export const Breastplate: Relic = {
  id: 'breastplate',
  name: '鋼の胸当て',
  icon: '胸',
  description: '受けるダメージ -2（最低1）',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === player) return { ...p, damage: reduce(p.damage, 2) };
    });
  },
};

export const VampireFang: Relic = {
  id: 'fang',
  name: '吸血の牙',
  icon: '牙',
  description: '敵にダメージを与えるたび HP +3',
  apply({ bus, player }) {
    bus.on('onResolve', ({ attacker, damage }) => {
      if (attacker === player && damage > 0) player.hp = Math.min(player.maxHp, player.hp + 3);
    });
  },
};

export const Mark22: Relic = {
  id: 'mark22',
  name: '二十二の刻印',
  icon: '刻',
  description: 'バーストの上限が22になる（敵にも適用）',
  apply({ rules }) {
    rules.bustLimit += 1;
  },
};

export const GamblerCoin: Relic = {
  id: 'coin',
  name: '賭博師の金貨',
  icon: '貨',
  description: 'ブラックジャック勝利の倍率が 2 倍になる',
  apply({ rules }) {
    rules.blackjackMultiplier = Math.max(rules.blackjackMultiplier, 2);
  },
};

export const ScapegoatDoll: Relic = {
  id: 'doll',
  name: '身代わりの人形',
  icon: '偶',
  description: '各バトルで最初のバーストのダメージを 0 にする',
  apply({ bus }) {
    let used = false;
    bus.on('onDamageCalculated', (p) => {
      if (!used && p.result.playerBust && p.damage > 0) {
        used = true;
        return { ...p, damage: 0 };
      }
    });
  },
};

export const FateRing: Relic = {
  id: 'ring',
  name: '運命の指輪',
  icon: '輪',
  description: '引き分けのとき、敵に 4 ダメージ',
  apply({ bus, player, enemy }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.result.outcome === 'push' && p.attacker === null) {
        return { ...p, attacker: player, defender: enemy, damage: 4 };
      }
    });
  },
};

export const LifeCandle: Relic = {
  id: 'candle',
  name: '命の蝋燭',
  icon: '燭',
  description: '各バトルの開始時に HP +8',
  apply({ bus, player }) {
    bus.on('onBattleStart', () => {
      player.hp = Math.min(player.maxHp, player.hp + 8);
    });
  },
};

/** 報酬として出現するレリックの一覧。 */
export const RELIC_POOL: readonly Relic[] = [
  Whetstone, Breastplate, VampireFang, Mark22, GamblerCoin, ScapegoatDoll, FateRing, LifeCandle,
];

export { reduce as reduceDamage };
