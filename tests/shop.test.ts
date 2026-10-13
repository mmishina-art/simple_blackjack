import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import { stageRows } from '../src/map/stages';
import { STAGES } from '../src/map/stages';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { createRun } from '../src/run/Run';
import { noWait } from './helpers';
import { POUCH_SIZE, stashInPouch } from '../src/run/loadout';
import { addGold, MAX_GOLD, upgradeCost, buyOffer, enemyGold, generateShop, priceOfSkill, sellFromInventory, sellPrice } from '../src/run/shop';

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

  it('品揃え: 道具4・防具（硬いものから最大2）・遺物2。重複なし、持っている遺物は並ばない', () => {
    const run = createRun();
    const offers = generateShop(run, seededRng(1));
    expect(offers.filter((o) => o.type === 'skill')).toHaveLength(6); // 道具 4 + 防具 2（鋼の盾・ミスリルの盾）
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

  it('道具袋は 1 つ: 袋に入れると、いまの袋の中身は売られる（空なら何も売らない）', () => {
    expect(POUCH_SIZE).toBe(1);
    const run = createRun();
    run.inventory.push('jab');
    expect(stashInPouch(run, 'jab')).toEqual({ sold: [], gold: 0 });
    expect(run.inventory).toEqual(['jab']);
    run.inventory.push('big_attack'); // 袋がいっぱいのところへ、新しく得た物
    const r = stashInPouch(run, 'big_attack')!;
    expect(r.sold).toEqual(['jab']);
    expect(r.gold).toBe(sellPrice('jab'));
    expect(run.inventory).toEqual(['big_attack']);
    expect(run.gold).toBe(sellPrice('jab'));
    expect(stashInPouch(run, 'smash')).toBeNull(); // 持っていない物は入れられない
  });

  it('同じスキルを 2 つ持っているときも、1 つだけ残す', () => {
    const run = createRun();
    run.inventory.push('jab', 'jab');
    stashInPouch(run, 'jab');
    expect(run.inventory).toEqual(['jab']);
  });

  it('ゴールドは 9999 が上限（増えても超えない）', () => {
    const run = createRun();
    run.gold = MAX_GOLD - 5;
    addGold(run, 100);
    expect(run.gold).toBe(MAX_GOLD);
  });
});

describe('デバッグ: すぐに勝つ', () => {
  it('入力待ちで debugWin() すると、そのラウンドの終わりに、敵を倒したことになる（プレイヤーが倒れても勝ち）', async () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], rng: seededRng(3), pace: noWait });
    const done = m.run();
    for (let i = 0; i < 200 && !m.canAct; i++) await new Promise((r) => setTimeout(r, 0));
    expect(m.canAct).toBe(true);
    m.ctx.player.hp = 1;
    m.debugWin();
    await done;
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.enemy.isDead).toBe(true);
    expect(m.ctx.player.hp).toBeGreaterThan(0);
  });
});
