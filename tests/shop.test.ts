import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import { stageRows } from '../src/map/stages';
import { STAGES } from '../src/map/stages';
import { createRun } from '../src/run/Run';
import { upgradeCost, buyOffer, enemyGold, generateShop, priceOfSkill, sellFromInventory, sellPrice } from '../src/run/shop';

describe('ゴールドとショップ', () => {
  it('冒険は 0 G で始まり、敵を倒すほど多くもらえる（ボスは 2.5 倍）', () => {
    expect(createRun().gold).toBe(0);
    const golds = ENEMY_LINEUP.map((e) => enemyGold(e));
    expect(Math.min(...golds)).toBeGreaterThan(0);
    expect(enemyGold(ENEMY_LINEUP[0], true)).toBe(Math.round(enemyGold(ENEMY_LINEUP[0]) * 2.5));
  });

  it('売値は買値の半分（切り捨て）。持っていないものは売れない', () => {
    const run = createRun();
    run.inventory.push('jab');
    expect(sellPrice('jab')).toBe(Math.floor(priceOfSkill('jab') / 2));
    expect(sellFromInventory(run, 'jab')).toBe(sellPrice('jab'));
    expect(run.gold).toBe(sellPrice('jab'));
    expect(run.inventory).not.toContain('jab');
    expect(sellFromInventory(run, 'jab')).toBeNull();
  });

  it('品揃え: スキル3・道具/防具2・遺物2。重複なし、持っている遺物は並ばない', () => {
    const run = createRun();
    const offers = generateShop(run, seededRng(1));
    expect(offers.filter((o) => o.type === 'skill')).toHaveLength(5);
    const relics = offers.filter((o) => o.type === 'relic');
    expect(relics).toHaveLength(2);
    expect(new Set(relics.map((o) => o.id)).size).toBe(2);
    const owned = relics[0].id;
    run.relics.push({ id: owned } as never);
    expect(generateShop(run, seededRng(1)).filter((o) => o.type === 'relic').map((o) => o.id)).not.toContain(owned);
  });

  it('買う: ゴールドが足りなければ買えない。買うと引かれ、持ち物に入り、売り切れになる', () => {
    const run = createRun();
    const offer = generateShop(run, seededRng(2)).find((o) => o.type === 'skill')!;
    expect(buyOffer(run, offer)).toBe(false);
    run.gold = offer.price + 5;
    expect(buyOffer(run, offer)).toBe(true);
    expect(run.gold).toBe(5);
    expect(run.inventory).toContain(offer.id);
    expect(offer.sold).toBe(true);
    run.gold = 999;
    expect(buyOffer(run, offer)).toBe(false);
  });

  it('遺物を買うとすぐ手に入る', () => {
    const run = createRun();
    const offer = generateShop(run, seededRng(3)).find((o) => o.type === 'relic')!;
    run.gold = 999;
    expect(buyOffer(run, offer)).toBe(true);
    expect(run.relics.map((r) => r.id)).toContain(offer.id);
  });

  it('どの階層の地図にも、ショップのマスがある', () => {
    for (const stage of STAGES) {
      expect(Object.values(stage.tiles).some((t) => t.kind === 'shop')).toBe(true);
      expect(stageRows(stage)).toBeGreaterThan(0);
    }
  });

  it('祠のバージョンアップの代金は、買値の差（コモン→レア 40、レア→レジェンド 80）。強化先がなければ null', () => {
    expect(upgradeCost('big_attack')).not.toBeNull();
    expect(upgradeCost('fortress')).toBeNull();
    expect(upgradeCost('jab')).toBe(priceOfSkill('big_attack') - priceOfSkill('jab'));
    expect(upgradeCost('heavy')).toBe(priceOfSkill('smash') - priceOfSkill('heavy'));
  });
});
