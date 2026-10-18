import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { enemyLevel } from '../core/entities/enemies/level';
import { pickWeighted, tierWeights, type Rarity } from '../core/rarity';
import { armorPoolFor, ITEM_POOL } from '../core/skills/catalog';
import { getSkill, isArmor, isItem, rarityOfSkill, type SkillId } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { ALL_RELIC_POOL, relicPoolFor } from '../relics/catalog';
import type { Relic } from '../relics/Relic';
import { CODEX_BOOST, type RunState } from './Run';

/** 持てるゴールドの上限。 */
export const MAX_GOLD = 9999;

/** ゴールドを増やす（上限を超えない）。 */
export function addGold(run: RunState, amount: number): void {
  run.gold = Math.min(MAX_GOLD, run.gold + amount);
}

/** 売値は、買値のこの割合（切り捨て）。 */
export const SELL_RATIO = 0.5;

const SKILL_PRICE: Record<Rarity, number> = { common: 30, rare: 70, legend: 150 };
const ITEM_PRICE: Record<Rarity, number> = { common: 15, rare: 35, legend: 80 };
const ARMOR_PRICE: Record<Rarity, number> = { common: 30, rare: 80, legend: 160 };
const RELIC_PRICE: Record<Rarity, number> = { common: 60, rare: 110, legend: 200 };

/** スキル・道具・防具の買値（レア度と種類で決まる）。 */
export function priceOfSkill(id: SkillId): number {
  const sk = getSkill(id);
  const table = isArmor(sk) ? ARMOR_PRICE : isItem(sk) ? ITEM_PRICE : SKILL_PRICE;
  return table[rarityOfSkill(sk)];
}

export function priceOfRelic(relic: Relic): number {
  return RELIC_PRICE[relic.rarity ?? 'common'];
}

/** 持ち物を売るときの値段。 */
export function sellPrice(id: SkillId): number {
  return Math.floor(priceOfSkill(id) * SELL_RATIO);
}

/** 敵を倒したときにもらえるゴールド: 強い敵ほど多い（LV×4 + 14）。goldMultiplier（ミミックの 3 倍など）やボス（2.5 倍）を掛ける。 */
export function enemyGold(def: EnemyDef, boss = false): number {
  return Math.round((enemyLevel(def) * 4 + 14) * (def.goldMultiplier ?? 1) * (boss ? 2.5 : 1));
}

/** 敵を倒した報酬で、スキルの代わりにゴールドを選んだときの倍率（スキルをあきらめる分の見返り）。 */
export const REWARD_GOLD_CHOICE_RATE = 2;

/** 敵を倒した報酬で、ゴールドを選んだときの額（ふつうの敵。ボスは遺物の報酬で、ゴールドは自動で入る）。 */
export function rewardGoldChoice(run: RunState, def: EnemyDef): number {
  return rewardGold(run, def) * REWARD_GOLD_CHOICE_RATE;
}

/** 実際に得るゴールド: 敵ごとの量に、祭壇の「商人の心得」の割合を掛ける。 */
export function rewardGold(run: RunState, def: EnemyDef, boss = false): number {
  return Math.round(enemyGold(def, boss) * (1 + run.bonus.goldRate));
}

export interface ShopOffer {
  /** skill = スキル・道具・防具（持ち物に入る）/ relic = レリック（すぐ効く）。 */
  type: 'skill' | 'relic';
  id: string;
  price: number;
  sold: boolean;
}

/** 階層ごとの品揃え。階層が進むほど品数が増え、レジェンドが並ぶのは第 2 階層から。 */
export interface ShopTier {
  items: number;
  /** 防具（いま装備しているより硬いものから）の最大数。 */
  armors: number;
  relics: number;
  /** この階層のショップに並ぶ最高のレア度。 */
  maxRarity: Rarity;
}
export const SHOP_TIERS: readonly ShopTier[] = [
  { items: 2, armors: 1, relics: 1, maxRarity: 'rare' },   // 第 1 階層: 少なめ。レジェンドは買えない
  { items: 3, armors: 1, relics: 2, maxRarity: 'legend' }, // 第 2 階層
  { items: 4, armors: 2, relics: 3, maxRarity: 'legend' }, // 第 3 階層: 品数が最も多い
];
export const shopTier = (stage: number): ShopTier => SHOP_TIERS[Math.max(0, Math.min(stage, SHOP_TIERS.length) - 1)];

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, legend: 2 };

/**
 * ショップの品揃え（階層ごとに `SHOP_TIERS`）: 道具 + 防具（いま装備しているより硬いもの）+ 遺物。**スキルは売らない**（スキルは敵を倒して手に入れる）。
 * 道具・防具は、ここでしか買えない。持っている遺物は並ばない。第 1 階層ではレジェンドは並ばない。
 */
export function generateShop(run: RunState, rng: Rng): ShopOffer[] {
  const tier = shopTier(run.stage);
  const allowed = (rarity: Rarity): boolean => RARITY_RANK[rarity] <= RARITY_RANK[tier.maxRarity];
  const rarityOf = (id: SkillId) => rarityOfSkill(getSkill(id));
  const favored = new Set(run.favored);
  const boost = (id: SkillId): number => (favored.has(id) ? CODEX_BOOST : 1);
  const itemPool = ITEM_POOL.filter((id) => allowed(rarityOf(id)));
  const itemW = tierWeights(itemPool, rarityOf, run.stage);
  const items = pickWeighted(itemPool, tier.items, rng, (id) => itemW(id) * boost(id));

  const curCap = getSkill(run.armor).damageCap ?? Infinity;
  const armorPool = armorPoolFor(run.character).filter((id) => (getSkill(id).damageCap ?? Infinity) < curCap && allowed(rarityOf(id)));
  const armors = pickWeighted(armorPool, Math.min(tier.armors, armorPool.length), rng, tierWeights(armorPool, rarityOf, run.stage));

  const owned = new Set(run.relics.map((r) => r.id));
  const relicPool = relicPoolFor(run.character).filter((r) => !owned.has(r.id) && allowed(r.rarity ?? 'common'));
  const relics = pickWeighted(relicPool, tier.relics, rng, tierWeights(relicPool, (r) => r.rarity ?? 'common', run.stage));

  return [
    ...items.map((id): ShopOffer => ({ type: 'skill', id, price: priceOfSkill(id), sold: false })),
    ...armors.map((id): ShopOffer => ({ type: 'skill', id, price: priceOfSkill(id), sold: false })),
    ...relics.map((r): ShopOffer => ({ type: 'relic', id: r.id, price: priceOfRelic(r), sold: false })),
  ];
}

/** 買う。ゴールドが足りない・売り切れなら false。スキル・道具・防具は持ち物に入り、レリックはすぐ手に入る。 */
export function buyOffer(run: RunState, offer: ShopOffer): boolean {
  if (offer.sold || run.gold < offer.price) return false;
  if (offer.type === 'relic') {
    const relic = ALL_RELIC_POOL.find((r) => r.id === offer.id);
    if (!relic || run.relics.some((r) => r.id === relic.id)) return false;
    run.relics.push(relic);
  } else {
    run.inventory.push(offer.id);
  }
  run.gold -= offer.price;
  offer.sold = true;
  return true;
}

/** 持ち物（セットしていないスキル・道具・防具）を 1 つ売る。売った値段を返す。持っていなければ null。 */
export function sellFromInventory(run: RunState, id: SkillId): number | null {
  const idx = run.inventory.indexOf(id);
  if (idx < 0) return null;
  run.inventory.splice(idx, 1);
  const gold = sellPrice(id);
  addGold(run, gold);
  return gold;
}

/** 祠のバージョンアップの代金（「＋」にする）: レア度ごと。会心の一撃・大魔導の系統は、段階ごと（1段階目 40 G、2段階目 80 G）。 */
export const PLUS_COST: Record<Rarity, number> = { common: 30, rare: 50, legend: 80 };
export const ACE_UPGRADE_COST: Record<SkillId, number> = {
  ace_strike: 40, overlord_strike: 80,
  arch_magic: 40, astral_magic: 80,
};

export function upgradeCost(id: SkillId): number | null {
  const sk = getSkill(id);
  if (!sk.upgradesTo) return null;
  return ACE_UPGRADE_COST[id] ?? PLUS_COST[rarityOfSkill(sk)];
}
