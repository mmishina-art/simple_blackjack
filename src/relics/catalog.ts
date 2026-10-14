import type { Relic } from './Relic';

/** ダメージが正のときだけ軽減する（最低1）。0 のダメージは増やさない。 */
export const reduceDamage = (damage: number, by: number): number => (damage > 0 ? Math.max(1, damage - by) : damage);

// ---- コモン ----
export const SturdyShield: Relic = {
  id: 'shield', rarity: 'common', name: '堅牢の盾', icon: '盾',
  description: '獲得するブロック +3',
  apply({ bus, player }) {
    bus.on('onBlockGained', (p) => {
      if (p.entity === player) return { ...p, amount: p.amount + 3 };
    });
  },
};

export const LifeCandle: Relic = {
  id: 'candle', rarity: 'common', name: '命の蝋燭', icon: '燭',
  description: '各バトルの開始時に HP +2',
  apply({ bus, player }) {
    bus.on('onBattleStart', () => {
      player.hp = Math.min(player.maxHp, player.hp + 2);
    });
  },
};

export const LuckyDice: Relic = {
  id: 'dice', rarity: 'common', name: '二十一の盾', icon: '賽',
  description: '合計がちょうど 21 で Stand したとき、ブロック +8',
  apply({ bus, player, rules }) {
    bus.on('onStand', ({ entity }) => {
      if (entity === player && player.hand.total(rules) === rules.blackjackScore) {
        player.block += 8;
        bus.emit('onBlockApplied', { entity: player, amount: 8 });
      }
    });
  },
};

/** 守りの護符が、1 バトルで受けるダメージを 0 にできる回数。 */
export const DEFENDER_CHARGES = 2;

export const DefenderCharm: Relic = {
  id: 'defender', rarity: 'common', name: '守りの護符', icon: '護',
  description: `防御（Guard）したとき、受けるダメージを 0 にする（各バトル ${DEFENDER_CHARGES} 回まで）`,
  apply({ bus, player }) {
    let used = 0;
    let guarding = false;
    bus.on('onSurrender', ({ entity }) => {
      if (entity === player && used < DEFENDER_CHARGES) { used++; guarding = true; }
    });
    bus.on('onDamageCalculated', (p) => {
      if (guarding && p.defender === player && p.damage > 0) return { ...p, damage: 0 };
    });
    bus.on('onRoundEnd', () => { guarding = false; });
  },
};

export const Boots: Relic = {
  id: 'boots', rarity: 'common', name: '疾風の靴', icon: '靴',
  description: '合計値が同値のとき、必ず先攻になる（同時攻撃にならない）',
  apply({ bus }) {
    bus.on('onInitiativeDecided', (p) => {
      if (p.turn.mode === 'simultaneous') {
        return { ...p, turn: { ...p.turn, mode: 'sequential', first: 'player', second: 'enemy' } };
      }
    });
  },
};

/** 道具（効果が固定のもの）を強化するレリック。スキルには効かない。 */
export const HerbalistBag: Relic = {
  id: 'herbalist', rarity: 'common', name: '薬師の鞄', icon: '鞄',
  description: '道具の回復量 +5（薬草 8 → 13 など）',
  apply({ bus, player }) {
    bus.on('onHealed', (p) => {
      if (p.entity === player && p.skill?.kind === 'item') return { ...p, amount: p.amount + 5 };
    });
  },
};

export const ArtisanTools: Relic = {
  id: 'artisan', rarity: 'common', name: '爆弾師の工具', icon: '工',
  description: '爆弾系（攻撃の道具）のダメージ 1.5 倍（爆弾 10 → 15、大爆弾 16 → 24）',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === player && p.skill?.kind === 'item' && p.damage > 0) return { ...p, damage: Math.floor(p.damage * 1.5) };
    });
  },
};

// ---- レア ----
export const Whetstone: Relic = {
  id: 'whetstone', rarity: 'rare', name: '血塗れの砥石', icon: '砥',
  description: '基本パワー（POW）+1（すべての攻撃スキルに効く）',
  apply({ player }) {
    player.attack += 1;
  },
};

export const ThornMail: Relic = {
  id: 'thorn', rarity: 'rare', name: '棘の鎧', icon: '棘',
  description: '敵から HP を削られたとき、その 20%（最低 1）のダメージを敵にも与える',
  apply({ bus, player, enemy }) {
    bus.on('onDamageDealt', ({ defender, hpLoss }) => {
      if (defender === player && hpLoss > 0 && !enemy.isDead) enemy.hp = Math.max(0, enemy.hp - Math.max(1, Math.floor(hpLoss * 0.2)));
    });
  },
};

/** 満杯の指輪が見る、12〜20 のスロット。 */
const FULL_RING_SLOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20];

export const FullRing: Relic = {
  id: 'fullring', rarity: 'rare', name: '満杯の指輪', icon: '満',
  description: '12〜20 のスロットがすべて埋まっていると、基本パワー（POW）+3（埋まっていないときは、グレーで表示）',
  isActive: (slots) => FULL_RING_SLOTS.every((k) => slots[k]),
  apply({ player }) {
    if (FullRing.isActive!(player.slots)) player.attack += 3;
  },
};

export const CounterStance: Relic = {
  id: 'counter', rarity: 'rare', name: '反撃の構え', icon: '反',
  description: '防御（Guard）した次のラウンド、与える攻撃ダメージ +30%',
  apply({ bus, player }) {
    let pending = false; // このラウンドに防御した
    let active = false; // このラウンドは、前のラウンドに防御した
    bus.on('onSurrender', ({ entity }) => { if (entity === player) pending = true; });
    bus.on('onDamageCalculated', (p) => {
      if (active && p.attacker === player && p.damage > 0) return { ...p, damage: Math.floor(p.damage * 1.3) };
    });
    bus.on('onRoundEnd', () => { active = pending; pending = false; });
  },
};

// ---- レジェンド ----
export const Unyielding: Relic = {
  id: 'unyielding', rarity: 'legend', name: '不屈の心', icon: '心',
  description: '各バトルで一度だけ、致命傷を HP 1 で耐える',
  apply({ bus, player }) {
    let used = false;
    bus.on('onDamageDealt', ({ defender }) => {
      if (defender === player && player.hp <= 0 && !used) {
        used = true;
        player.hp = 1;
      }
    });
  },
};

export const Breastplate: Relic = {
  id: 'breastplate', rarity: 'legend', name: '金剛の鎧', icon: '鎧', // 常時 -1 は効く回数が多く（実測でクリア率 +16 前後）、レジェンドに
  description: '受ける攻撃ダメージ -1（最低1）',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === player) return { ...p, damage: reduceDamage(p.damage, 1) };
    });
  },
};

export const TriumphCup: Relic = {
  id: 'cup', rarity: 'legend', name: '凱旋の杯', icon: '杯',
  description: '敵に勝つたび、最大 HP +1（現在の HP も +1）',
  apply({ bus, player }) {
    bus.on('onBattleEnd', ({ winner }) => {
      if (winner === player) { player.maxHp += 1; player.hp += 1; }
    });
  },
};

export const NoBustPenalty: Relic = {
  id: 'noburst', rarity: 'legend', name: '破滅の加護', icon: '破',
  description: 'バーストしても、受けるダメージが 1.5 倍にならない',
  apply({ player }) {
    player.bustPenaltyFree = true;
  },
};

/** 報酬として出現するレリックの一覧。 */
export const RELIC_POOL: readonly Relic[] = [
  SturdyShield, LifeCandle, LuckyDice, DefenderCharm, Boots, HerbalistBag, ArtisanTools,
  Whetstone, ThornMail, FullRing, CounterStance,
  Unyielding, Breastplate, TriumphCup, NoBustPenalty,
];
