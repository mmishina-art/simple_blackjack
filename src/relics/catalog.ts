import { getSkill, type SkillDef } from '../core/skills/Skill';
import type { Relic } from './Relic';

/** ダメージが正のときだけ軽減する（最低1）。0 のダメージは増やさない。 */
export const reduceDamage = (damage: number, by: number): number => (damage > 0 ? Math.max(1, damage - by) : damage);

export const Whetstone: Relic = {
  id: 'whetstone', rarity: 'rare', name: '血塗れの砥石', icon: '砥',
  description: '基本パワー（POW）+1（すべての攻撃スキルに効く）',
  apply({ player }) {
    player.attack += 1;
  },
};

export const Breastplate: Relic = {
  id: 'breastplate', rarity: 'rare', name: '鋼の胸当て', icon: '胸',
  description: '受ける攻撃ダメージ -1（最低1）',
  apply({ bus, player }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.defender === player) return { ...p, damage: reduceDamage(p.damage, 1) };
    });
  },
};

export const VampireFang: Relic = {
  id: 'fang', rarity: 'rare', name: '吸血の牙', icon: '牙',
  description: '敵の HP を削るたび、HP +1',
  apply({ bus, player }) {
    bus.on('onDamageDealt', ({ attacker, hpLoss }) => {
      if (attacker === player && hpLoss > 0) player.hp = Math.min(player.maxHp, player.hp + 1);
    });
  },
};

export const ScapegoatDoll: Relic = {
  id: 'doll', rarity: 'rare', name: '身代わりの人形', icon: '偶',
  description: '各バトルで最初にバーストしたとき、敵も行動しない',
  apply({ bus }) {
    let used = false;
    bus.on('onInitiativeDecided', (p) => {
      if (!used && p.playerBust && p.turn.mode === 'bustSkip') {
        used = true;
        return { ...p, turn: { mode: 'none', first: null, second: null } };
      }
    });
  },
};

export const FateRing: Relic = {
  id: 'ring', rarity: 'rare', name: '運命の指輪', icon: '輪',
  description: '合計値が同値で同時攻撃になったラウンド、与える攻撃ダメージ +8',
  apply({ bus, player }) {
    let simultaneous = false;
    bus.on('onInitiativeDecided', (p) => {
      simultaneous = p.turn.mode === 'simultaneous';
    }, 10);
    bus.on('onDamageCalculated', (p) => {
      if (simultaneous && p.attacker === player && p.damage > 0) return { ...p, damage: p.damage + 8 };
    });
  },
};

export const Boots: Relic = {
  id: 'boots', rarity: 'rare', name: '疾風の靴', icon: '靴',
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
  id: 'shield', rarity: 'common', name: '堅牢の盾', icon: '盾',
  description: '獲得する Block +3',
  apply({ bus, player }) {
    bus.on('onBlockGained', (p) => {
      if (p.entity === player) return { ...p, amount: p.amount + 3 };
    });
  },
};

export const LifeCandle: Relic = {
  id: 'candle', rarity: 'common', name: '命の蝋燭', icon: '燭',
  description: '各バトルの開始時に HP +3',
  apply({ bus, player }) {
    bus.on('onBattleStart', () => {
      player.hp = Math.min(player.maxHp, player.hp + 3);
    });
  },
};

export const OverlordOrb: Relic = {
  id: 'orb', rarity: 'legend', name: '覇王の宝珠', icon: '珠',
  description: '会心の一撃（21）が POW×1.5 から「覇王の一撃」（POW×2 + Block 8）に変わる',
  apply({ bus, player }) {
    bus.on('onSkillActivated', (p) => {
      if (p.user === player && p.skill?.id === 'ace_strike') return { ...p, skill: getSkill('overlord_strike') };
    });
  },
};

export const SealKey: Relic = {
  id: 'key', rarity: 'legend', name: '封印の鍵', icon: '鍵', unlocksSlots: [21],
  description: 'スロット21の封印が解け、好きなスキルを付け替えられる',
  apply() {},
};

/** 発動するスキルの効果をレリックで書き換える（スロットのスキルは同じまま、効果だけが変わる）。 */
function reshapeSkill(bus: Parameters<Relic['apply']>[0]['bus'], player: Parameters<Relic['apply']>[0]['player'], skillId: string, reshape: (s: SkillDef) => SkillDef): void {
  bus.on('onSkillActivated', (p) => {
    if (p.user === player && p.skill?.id === skillId) return { ...p, skill: reshape(p.skill) };
  });
}

export const Bracer: Relic = {
  id: 'bracer', rarity: 'rare', name: '剛力の腕輪', icon: '腕',
  description: '大攻撃（剛）が「POW+5」から「POW×2+5」に変わる',
  apply({ bus, player }) {
    reshapeSkill(bus, player, 'big_attack', (s) => ({ ...s, effects: [{ type: 'attack', mult: 2, add: 5 }] }));
  },
};

export const TitanBlood: Relic = {
  id: 'titan', rarity: 'rare', name: '巨人の血', icon: '巨',
  description: '小攻撃（11以下）が「POW×0.5」から「POW×2+10」に変わる',
  apply({ bus, player }) {
    reshapeSkill(bus, player, 'small_attack', (s) => ({ ...s, effects: [{ type: 'attack', mult: 2, add: 10 }] }));
  },
};

export const Lockpick: Relic = {
  id: 'lockpick', rarity: 'rare', name: '解錠の鍵', icon: '錠', unlocksSlots: [11],
  description: 'スロット11以下の封印が解け、好きなスキルを付け替えられる（外すと通常攻撃になる）',
  apply() {},
};

/** 道具（効果が固定のもの）だけを強化するレリック。スキルには効かない。 */
export const HerbalistBag: Relic = {
  id: 'herbalist', rarity: 'rare', name: '薬師の鞄', icon: '鞄',
  description: '道具の回復量 +5（薬草 8 → 13 など）',
  apply({ bus, player }) {
    bus.on('onHealed', (p) => {
      if (p.entity === player && p.skill?.kind === 'item') return { ...p, amount: p.amount + 5 };
    });
  },
};

export const ArtisanTools: Relic = {
  id: 'artisan', rarity: 'rare', name: '匠の工具', icon: '工',
  description: '道具のダメージ +4（爆弾 10 → 14）。防具の被ダメージ上限 −1（鉄の盾 5 → 4）',
  apply({ bus, rules, player }) {
    player.armorCap = Math.max(1, (player.armorCap ?? rules.defendCap) - 1);
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === player && p.skill?.kind === 'item' && p.damage > 0) return { ...p, damage: p.damage + 4 };
    });
  },
};


// ---- 第2・第3階層から出るレリック ----
export const DefenderCharm: Relic = {
  id: 'defender', rarity: 'common', name: '守りの護符', icon: '護',
  description: '防御したとき、HP +6',
  apply({ bus, player }) {
    bus.on('onSurrender', ({ entity }) => {
      if (entity !== player) return;
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + 6);
      if (player.hp > before) bus.emit('onHealApplied', { entity: player, amount: player.hp - before });
    });
  },
};

export const LuckyDice: Relic = {
  id: 'dice', rarity: 'common', name: '幸運の賽', icon: '賽',
  description: '合計がちょうど 21 で Stand したとき、Block +8',
  apply({ bus, player, rules }) {
    bus.on('onStand', ({ entity }) => {
      if (entity === player && player.hand.total(rules) === rules.blackjackScore) {
        player.block += 8;
        bus.emit('onBlockApplied', { entity: player, amount: 8 });
      }
    });
  },
};

export const ThornMail: Relic = {
  id: 'thorn', rarity: 'rare', name: '棘の鎧', icon: '棘',
  description: '敵から HP を削られたとき、その 1/3（切り上げ）のダメージを敵にも与える',
  apply({ bus, player, enemy }) {
    bus.on('onDamageDealt', ({ defender, hpLoss }) => {
      if (defender === player && hpLoss > 0 && !enemy.isDead) enemy.hp = Math.max(0, enemy.hp - Math.ceil(hpLoss / 3));
    });
  },
};

export const TriumphCup: Relic = {
  id: 'cup', rarity: 'rare', name: '凱旋の杯', icon: '杯',
  description: '敵に勝つたび、HP +5',
  apply({ bus, player }) {
    bus.on('onBattleEnd', ({ winner }) => {
      if (winner === player) player.hp = Math.min(player.maxHp, player.hp + 5);
    });
  },
};

export const Bloodlust: Relic = {
  id: 'bloodlust', rarity: 'rare', name: '血の渇き', icon: '渇',
  description: '敵がバーストしたラウンド、与える攻撃ダメージ +6',
  apply({ bus, player, enemy, rules }) {
    bus.on('onDamageCalculated', (p) => {
      if (p.attacker === player && p.damage > 0 && enemy.hand.total(rules) > rules.bustLimit) return { ...p, damage: p.damage + 6 };
    });
  },
};

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

/** 報酬として出現するレリックの一覧。 */
export const RELIC_POOL: readonly Relic[] = [
  Whetstone, Breastplate, VampireFang, ScapegoatDoll, FateRing, Boots, SturdyShield, LifeCandle, OverlordOrb, SealKey, Lockpick, Bracer, TitanBlood, HerbalistBag, ArtisanTools,
  DefenderCharm, LuckyDice, ThornMail, TriumphCup, Bloodlust, Unyielding,
];
