import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { enemyLevel } from '../core/entities/enemies/level';
import { pickWeighted, tierWeights, type Rarity } from '../core/rarity';
import { ARMOR_POOL, ITEM_POOL } from '../core/skills/catalog';
import { getSkill, isArmor, isItem, rarityOfSkill, type SkillId } from '../core/skills/Skill';
import type { Rng } from '../core/util/Rng';
import { RELIC_POOL } from '../relics/catalog';
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

/** 敵を倒したときにもらえるゴールド: 強い敵ほど多い（LV×2 + 6）。ボスは 2.5 倍。 */
export function enemyGold(def: EnemyDef, boss = false): number {
  return Math.round((enemyLevel(def) * 4 + 14) * (boss ? 2.5 : 1));
}

export interface ShopOffer {
  /** skill = スキル・道具・防具（持ち物に入る）/ relic = レリック（すぐ効く）。 */
  type: 'skill' | 'relic';
  id: string;
  price: number;
  sold: boolean;
}

export const SHOP_ITEMS = 4;
export const SHOP_ARMORS = 2;
export const SHOP_RELICS = 2;

/**
 * ショップの品揃え: 道具 3 + 防具（いま装備しているより硬いものから最大 2）+ 遺物 2。**スキルは売らない**（スキルは敵を倒して手に入れる）。
 * 道具・防具は、ここでしか買えない。レア度の割合は階層ごと。持っている遺物は並ばない。
 */
export function generateShop(run: RunState, rng: Rng): ShopOffer[] {
  const rarityOf = (id: SkillId) => rarityOfSkill(getSkill(id));
  const favored = new Set(run.favored);
  const boost = (id: SkillId): number => (favored.has(id) ? CODEX_BOOST : 1);
  const itemW = tierWeights(ITEM_POOL, rarityOf, run.stage);
  const items = pickWeighted(ITEM_POOL, SHOP_ITEMS, rng, (id) => itemW(id) * boost(id));

  const curCap = getSkill(run.armor).damageCap ?? Infinity;
  const armorPool = ARMOR_POOL.filter((id) => (getSkill(id).damageCap ?? Infinity) < curCap);
  const armors = pickWeighted(armorPool, Math.min(SHOP_ARMORS, armorPool.length), rng, tierWeights(armorPool, rarityOf, run.stage));

  const owned = new Set(run.relics.map((r) => r.id));
  const relicPool = RELIC_POOL.filter((r) => !owned.has(r.id));
  const relics = pickWeighted(relicPool, SHOP_RELICS, rng, tierWeights(relicPool, (r) => r.rarity ?? 'common', run.stage));

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
    const relic = RELIC_POOL.find((r) => r.id === offer.id);
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

/** 祠のバージョンアップの代金: 強化先と今のスキルの買値の差（コモン→レア 40 G、レア→レジェンド 80 G）。強化先がなければ null。 */
export function upgradeCost(id: SkillId): number | null {
  const to = getSkill(id).upgradesTo;
  if (!to) return null;
  return priceOfSkill(to) - priceOfSkill(id);
}
