import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import {
  Breastplate, FateRing, GamblerCoin, LifeCandle, Mark22, ScapegoatDoll, VampireFang, Whetstone,
} from '../src/relics/catalog';
import {
  applyVictory, battleRelics, createRun, expForNextLevel, levelForExp, offerPerks, offerRelics,
} from '../src/run/Run';
import { ENEMY_SPRITES } from '../src/ui/components/enemySprites';
import { PERKS } from '../src/run/perks';
import type { Relic } from '../src/relics/Relic';
import { calcResolve as calcResolveAsync } from './helpers';

const rng = seededRng(1);

describe('敵ラインナップ', () => {
  it('5体で、全員にスプライトがあり、経験値とHPが正', () => {
    expect(ENEMY_LINEUP).toHaveLength(5);
    for (const e of ENEMY_LINEUP) {
      expect(ENEMY_SPRITES[e.id], e.id).toBeTruthy();
      expect(e.exp).toBeGreaterThan(0);
      expect(e.maxHp).toBeGreaterThan(0);
    }
    expect(new Set(ENEMY_LINEUP.map((e) => e.id)).size).toBe(5);
  });
});

describe('レベルアップ', () => {
  it('累計経験値からレベルが決まる', () => {
    expect(levelForExp(0)).toBe(1);
    expect(levelForExp(14)).toBe(1);
    expect(levelForExp(15)).toBe(2);
    expect(levelForExp(75)).toBe(4);
    expect(expForNextLevel(1)).toBe(15);
  });

  it('勝利で経験値が入り、レベルアップ数と回復量が返る', () => {
    const run = createRun();
    run.hp = 20;
    const v = applyVictory(run, ENEMY_LINEUP[0]);
    expect(v.gainedExp).toBe(15);
    expect(v.levelsGained).toBe(1);
    expect(run.level).toBe(2);
    expect(run.hp).toBe(20 + Math.ceil(60 * 0.35));
    expect(v.healed).toBe(21);
  });

  it('休息回復は最大HPを超えない', () => {
    const run = createRun();
    run.hp = 59;
    applyVictory(run, ENEMY_LINEUP[0]);
    expect(run.hp).toBe(run.maxHp);
  });

  it('強化の選択肢は3つで重複しない。効果が反映される', () => {
    const perks = offerPerks(rng);
    expect(perks).toHaveLength(3);
    expect(new Set(perks.map((p) => p.id)).size).toBe(3);
    const run = createRun();
    PERKS.find((p) => p.id === 'vitality')!.apply(run);
    expect(run.maxHp).toBe(72);
    expect(run.hp).toBe(72);
    PERKS.find((p) => p.id === 'might')!.apply(run);
    expect(run.damageBonus).toBe(2);
  });

  it('報酬レリックは所持済みを除いて最大3つ', () => {
    const run = createRun();
    expect(offerRelics(run, rng)).toHaveLength(3);
    run.relics.push(Whetstone);
    expect(offerRelics(run, rng).some((r) => r.id === 'whetstone')).toBe(false);
  });
});

describe('レリックの効果', () => {
  const calcResolve = calcResolveAsync;
  const R = (...c: Rank[]) => c;

  it('砥石: 与えるダメージ+3', async () => {
    const base = await calcResolve(R('K', '9'), R('K', '8'), []);
    const boosted = await calcResolve(R('K', '9'), R('K', '8'), [Whetstone]);
    expect(boosted.damage).toBe(base.damage + 3);
  });

  it('胸当て: 受けるダメージ-2、最低1', async () => {
    expect((await calcResolve(R('K', '6'), R('K', '8'), [Breastplate])).damage).toBe(16);
    expect((await calcResolve(R('K', '6'), R('A'), [Breastplate])).damage).toBeGreaterThanOrEqual(1);
  });

  it('身代わり人形: 最初のバーストのダメージが0', async () => {
    const r = await calcResolve(R('K', 'Q', '5'), R('K', '8'), [ScapegoatDoll]);
    expect(r.damage).toBe(0);
  });

  it('運命の指輪: 引き分けで敵に4ダメージ', async () => {
    const r = await calcResolve(R('K', '8'), R('9', '9'), [FateRing]);
    expect(r.damage).toBe(4);
    expect(r.defender).toBe('enemy');
  });

  it('金貨: ブラックジャック倍率2倍', async () => {
    const r = await calcResolve(R('A', 'K'), R('K', '9'), [GamblerCoin]);
    expect(r.damage).toBe(42);
  });

  it('二十二の刻印: バースト上限+1。蝋燭: 開始時回復。牙: 与ダメで回復', () => {
    const m = new BattleMachine({
      enemy: ENEMY_LINEUP[0], playerMaxHp: 50, playerHp: 30, rng: seededRng(3),
      relics: [Mark22, LifeCandle, VampireFang],
    });
    expect(m.ctx.rules.bustLimit).toBe(22);
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.player.hp).toBe(38);
    m.bus.emit('onResolve', { result: {} as never, damage: 5, attacker: m.ctx.player, defender: m.ctx.enemy });
    expect(m.ctx.player.hp).toBe(41);
  });

  it('レベルアップ強化(statsRelic)が与ダメ・被ダメに反映される', async () => {
    const run = createRun();
    run.damageBonus = 2;
    run.damageReduction = 1;
    expect((await calcResolve(R('K', '9'), R('K', '8'), battleRelics(run))).damage).toBe(21);
    expect((await calcResolve(R('K', '6'), R('K', '8'), battleRelics(run))).damage).toBe(17);
  });
});

describe('敵の特性', () => {
  const calcResolve = calcResolveAsync;
  const R = (...c: Rank[]) => c;
  const enemy = (id: string) => ENEMY_LINEUP.find((e) => e.id === id)!;

  it('骸骨兵: 受けるダメージ-2', async () => {
    expect((await calcResolve(R('K', '9'), R('K', '8'), [], enemy('skeleton'))).damage).toBe(17);
  });
  it('大蝙蝠: 引き分けでプレイヤーに3ダメージ', async () => {
    const r = await calcResolve(R('K', '8'), R('9', '9'), [], enemy('bat'));
    expect(r.damage).toBe(3);
    expect(r.defender).toBe('player');
  });
  it('黒竜: 勝利時ダメージ+3', async () => {
    expect((await calcResolve(R('K', '6'), R('K', '8'), [], enemy('dragon'))).damage).toBe(21);
  });
  it('屍食鬼: 勝つたびHP+4', () => {
    const m = new BattleMachine({ enemy: enemy('ghoul'), rng: seededRng(1) });
    m.ctx.enemy.hp = 10;
    m.bus.emit('onResolve', { result: {} as never, damage: 8, attacker: m.ctx.enemy, defender: m.ctx.player });
    expect(m.ctx.enemy.hp).toBe(14);
  });
});

it('Relic は全て説明とアイコンを持つ', () => {
  const all: Relic[] = [Whetstone, Breastplate, VampireFang, Mark22, GamblerCoin, ScapegoatDoll, FateRing, LifeCandle];
  for (const r of all) {
    expect(r.icon).toHaveLength(1);
    expect(r.description.length).toBeGreaterThan(3);
  }
  expect(makeCard('A', 'S').value).toBe(1);
});
