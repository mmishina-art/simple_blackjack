import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { enemyLevel } from '../core/entities/enemies/level';
import { pickWeighted, tierWeights, type Rarity } from '../core/rarity';
import { ARMOR_POOL, ITEM_POOL, SKILL_POOL } from '../core/skills/catalog';
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
const ITEM_PRICE: Record<Rarity, number> = { common: 20, rare: 50, legend: 110 };
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
  return Math.round((enemyLevel(def) * 2 + 6) * (boss ? 2.5 : 1));
}

export interface ShopOffer {
  /** skill = スキル・道具・防具（持ち物に入る）/ relic = レリック（すぐ効く）。 */
  type: 'skill' | 'relic';
  id: string;
  price: number;
  sold: boolean;
}

export const SHOP_SKILLS = 3;
export const SHOP_ITEMS = 2;
export const SHOP_RELICS = 2;

/** ショップの品揃え: スキル 3 + 道具・防具 2 + レリック 2。レア度の割合は階層ごと。持っているレリック・いまより柔らかい防具は並ばない。 */
export function generateShop(run: RunState, rng: Rng): ShopOffer[] {
  const rarityOf = (id: SkillId) => rarityOfSkill(getSkill(id));
  const favored = new Set(run.favored);
  const boost = (id: SkillId): number => (favored.has(id) ? CODEX_BOOST : 1);
  const skillW = tierWeights(SKILL_POOL, rarityOf, run.stage);
  const skills = pickWeighted(SKILL_POOL, SHOP_SKILLS, rng, (id) => skillW(id) * boost(id));

  const cur = getSkill(run.armor);
  const better = (id: SkillId): boolean => {
    const c = getSkill(id);
    const cap = c.damageCap ?? Infinity;
    const curCap = cur.damageCap ?? Infinity;
    return cap < curCap || (cap === curCap && (c.defendHeal ?? 0) > (cur.defendHeal ?? 0));
  };
  const itemPool = [...ITEM_POOL, ...ARMOR_POOL.filter(better)];
  const itemW = tierWeights(itemPool, rarityOf, run.stage);
  const items = pickWeighted(itemPool, SHOP_ITEMS, rng, itemW);

  const owned = new Set(run.relics.map((r) => r.id));
  const relicPool = RELIC_POOL.filter((r) => !owned.has(r.id));
  const relics = pickWeighted(relicPool, SHOP_RELICS, rng, tierWeights(relicPool, (r) => r.rarity ?? 'common', run.stage));

  return [
    ...skills.map((id): ShopOffer => ({ type: 'skill', id, price: priceOfSkill(id), sold: false })),
    ...items.map((id): ShopOffer => ({ type: 'skill', id, price: priceOfSkill(id), sold: false })),
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
