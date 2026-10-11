import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { hasSkill, SLOT_KEYS } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import {
  Boots, Breastplate, FateRing, LifeCandle, RELIC_POOL, ScapegoatDoll, SturdyShield, VampireFang, Whetstone,
} from '../src/relics/catalog';
import { applyRest, createRun, offerRelics } from '../src/run/Run';
import { ENEMY_SPRITES } from '../src/ui/components/enemySprites';
import { noWait, playRound } from './helpers';

describe('敵ラインナップ', () => {
  it('5体で、全員にスプライトがあり、スロットのスキルが全て実在する', () => {
    expect(ENEMY_LINEUP).toHaveLength(5);
    expect(new Set(ENEMY_LINEUP.map((e) => e.id)).size).toBe(5);
    for (const e of ENEMY_LINEUP) {
      expect(ENEMY_SPRITES[e.id], e.id).toBeTruthy();
      expect(hasSkill(e.fallbackSkill), `${e.id} fallback`).toBe(true);
      for (const [key, id] of Object.entries(e.slots)) {
        expect(SLOT_KEYS).toContain(Number(key));
        expect(hasSkill(id!), `${e.id}:${key}`).toBe(true);
      }
    }
  });
});

describe('冒険の状態（レベル・経験値は廃止）', () => {
  it('RunState に exp / level を持たない', () => {
    const run = createRun() as unknown as Record<string, unknown>;
    expect(run).not.toHaveProperty('exp');
    expect(run).not.toHaveProperty('level');
    expect(run).not.toHaveProperty('damageBonus');
    expect(Object.keys(run).sort()).toEqual(['fallbackSkill', 'hp', 'maxHp', 'relics', 'slots', 'stage']);
  });

  it('休息は最大HPの35%回復し、最大HPを超えない', () => {
    const run = createRun();
    run.hp = 20;
    expect(applyRest(run)).toBe(21);
    expect(run.hp).toBe(41);
    run.hp = 59;
    applyRest(run);
    expect(run.hp).toBe(60);
  });

  it('報酬レリックは所持済みを除いて3つ', () => {
    const run = createRun();
    expect(offerRelics(run, seededRng(1))).toHaveLength(3);
    run.relics.push(Whetstone);
    expect(offerRelics(run, seededRng(1)).some((r) => r.id === 'whetstone')).toBe(false);
    expect(RELIC_POOL).toHaveLength(8);
  });

  it('持ち越したスロットとHPがバトルに反映される', () => {
    const run = createRun();
    run.hp = 33;
    run.slots = { 13: 'guard' };
    const m = new BattleMachine({
      enemy: ENEMY_LINEUP[0], playerMaxHp: run.maxHp, playerHp: run.hp,
      playerSlots: run.slots, playerFallback: run.fallbackSkill, pace: noWait,
    });
    expect(m.ctx.player.hp).toBe(33);
    expect(m.ctx.player.slots[13]).toBe('guard');
  });
});

describe('レリックの効果', () => {
  it('砥石: 与える攻撃ダメージ +3', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Whetstone] });
    expect(m.ctx.enemy.hp).toBe(40 - 17);
  });

  it('胸当て: 受ける攻撃ダメージ -2', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Breastplate] });
    expect(m.ctx.player.hp).toBe(60 - 6); // 溶解8 - 2
  });

  it('吸血の牙: 敵のHPを削るたびHP+3', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, playerHp: 50, relics: [VampireFang] });
    expect(m.ctx.player.hp).toBe(50 + 3 - 8);
  });

  it('身代わりの人形: 最初のバーストで敵のクリティカルが消える', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], relics: [ScapegoatDoll] });
    expect(m.ctx.player.hp).toBe(60 - 8);
  });

  it('運命の指輪: 同時攻撃のとき自分の攻撃がクリティカル', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 40, relics: [FateRing] });
    expect(m.ctx.enemy.hp).toBe(40 - 21);
  });

  it('疾風の靴: 同値でも先攻になる', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 10, relics: [Boots] });
    expect(m.ctx.turn?.mode).toBe('sequential');
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(60); // 敵は行動できなかった
  });

  it('堅牢の盾: 獲得する Block +3', async () => {
    const m = await playRound({
      player: ['7', '8'], enemyHand: ['6', '8'], relics: [SturdyShield], stopAt: ['CheckDeath'],
    }); // 15 vs 14: 先攻でシールド
    expect(m.ctx.player.block).toBe(6 + 3 - 5); // 敵の酸5は吸収される
  });

  it('命の蝋燭: 戦闘開始時にHP+8', () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerHp: 30, relics: [LifeCandle], pace: noWait });
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.player.hp).toBe(38);
  });
});

describe('敵の特性', () => {
  const enemy = (id: string) => ENEMY_LINEUP.find((e) => e.id === id)!;

  it('骸骨兵: 骨の鎧（受けるダメージ -2）', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemy: enemy('skeleton') });
    expect(m.ctx.enemy.hp).toBe(28 - 12);
  });

  it('大蝙蝠: 同値なら必ず敵が先攻', async () => {
    const m = await playRound({ player: ['K', 'Q'], enemyHand: ['K', 'K'], enemy: enemy('bat') });
    expect(m.ctx.turn).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });

  it('屍食鬼: HPを削るたびHP+4', async () => {
    const m = await playRound({ player: ['9', '9'], enemyHand: ['K', 'K'], enemy: enemy('ghoul'), enemyHp: 20 });
    // 18 vs 20: 敵先攻。貪り喰う14 → HP+4、その後プレイヤーの回復+6
    expect(m.ctx.enemy.hp).toBe(24);
    expect(m.ctx.player.hp).toBe(60 - 14 + 6);
  });

  it('黒竜: 攻撃ダメージ +3', async () => {
    const m = await playRound({ player: ['9', '9'], enemyHand: ['K', 'K'], enemy: enemy('dragon') });
    expect(m.ctx.player.hp).toBe(60 - (17 + 3) + 6); // 業火17 + 息吹3、その後プレイヤーの回復+6
  });
});
