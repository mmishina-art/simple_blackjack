import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import { INN_HEAL_RATIO, useInn } from '../src/map/events';
import {
  buyUpgrade, canBuy, CODEX_SKILL_TOTAL, computeBonus, computeShards, discoverRelic, discoverSkill, emptyMeta, finishRun,
  isSkillDiscovered, loadMeta, META_KEY, nextCost, saveMeta, selectableStartingSkills, setStartingSkill,
  startingCapacity, UPGRADES, validStartingSkills, type MetaState,
} from '../src/meta/Meta';
import { createRun, offerSkills } from '../src/run/Run';
import { noWait } from './helpers';

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('魂片の獲得（負けても得られる）', () => {
  it('到達した段・倒した敵・クリアで増える', () => {
    expect(computeShards({ maxRow: 0, enemiesDefeated: 0, cleared: false })).toBe(0);
    expect(computeShards({ maxRow: 5, enemiesDefeated: 3, cleared: false })).toBe(5 * 2 + 3 * 4);
    expect(computeShards({ maxRow: 8, enemiesDefeated: 5, cleared: true })).toBe(16 + 20 + 40);
  });

  it('finishRun: 負けても魂片が入り、統計が更新される', () => {
    const meta = emptyMeta();
    const gained = finishRun(meta, { maxRow: 4, enemiesDefeated: 2, cleared: false });
    expect(gained).toBe(16);
    expect(meta.shards).toBe(16);
    expect(meta.stats).toEqual({ runs: 1, clears: 0, bestRow: 4 });
    finishRun(meta, { maxRow: 2, enemiesDefeated: 0, cleared: false });
    expect(meta.stats.bestRow).toBe(4);
  });

  it('冒険の記録（到達段・撃破数）が RunState に溜まる', async () => {
    const run = createRun();
    const { moveTo } = await import('../src/run/Run');
    moveTo(run, 'A');
    moveTo(run, 'R1');
    expect(run.stats.maxRow).toBe(2);
  });
});

describe('祭壇の強化（魂片で恒久強化）', () => {
  it('魂片が足りなければ買えない。買うとコストが引かれレベルが上がる', () => {
    const meta = emptyMeta();
    expect(canBuy(meta, 'vitality')).toBe(false);
    expect(buyUpgrade(meta, 'vitality')).toBe(false);
    meta.shards = 100;
    expect(buyUpgrade(meta, 'vitality')).toBe(true);
    expect(meta.shards).toBe(88);
    expect(meta.upgrades.vitality).toBe(1);
    expect(nextCost(meta, 'vitality')).toBe(20);
  });

  it('最大レベルを超えて買えない', () => {
    const meta = emptyMeta();
    meta.shards = 9999;
    for (let i = 0; i < 10; i++) buyUpgrade(meta, 'insight');
    expect(meta.upgrades.insight).toBe(1);
    expect(nextCost(meta, 'insight')).toBeNull();
    expect(canBuy(meta, 'insight')).toBe(false);
  });

  it('全ての強化は段階的にコストが上がる', () => {
    for (const u of UPGRADES) for (let i = 1; i < u.costs.length; i++) expect(u.costs[i]).toBeGreaterThan(u.costs[i - 1]);
  });

  it('強化が冒険の初期状態に反映される（HP・ATK・戦闘開始 Block・宿屋・報酬の選択肢）', () => {
    const meta = emptyMeta();
    meta.upgrades = { vitality: 2, might: 1, ward: 3, rest: 2, insight: 1 };
    expect(computeBonus(meta)).toEqual({ maxHp: 10, attack: 1, startBlock: 6, innHeal: 0.2, extraChoices: 1 });
    const run = createRun(undefined, meta);
    expect(run.maxHp).toBe(70);
    expect(run.hp).toBe(70);
    expect(run.baseAttack).toBe(6);
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerBlock: run.bonus.startBlock, pace: noWait });
    expect(m.ctx.player.block).toBe(6);
    run.hp = 10;
    expect(useInn(run)).toBe(Math.ceil(70 * (INN_HEAL_RATIO + 0.2)));
    expect(offerSkills(seededRng(1), run)).toHaveLength(4);
  });

  it('強化なしなら今までどおり', () => {
    const run = createRun(undefined, emptyMeta());
    expect([run.maxHp, run.baseAttack, run.bonus.startBlock, run.bonus.extraChoices]).toEqual([60, 5, 0, 0]);
  });
});

describe('図鑑', () => {
  it('初期スキルは最初から載っている。新しく入手すると登録され、重複登録はしない', () => {
    const meta = emptyMeta();
    expect(isSkillDiscovered(meta, 'big_attack')).toBe(true);
    expect(isSkillDiscovered(meta, 'smash')).toBe(false);
    expect(discoverSkill(meta, 'smash')).toBe(true);
    expect(discoverSkill(meta, 'smash')).toBe(false);
    expect(discoverSkill(meta, 'big_attack')).toBe(false);
    expect(discoverRelic(meta, 'orb')).toBe(true);
    expect(discoverRelic(meta, 'orb')).toBe(false);
    expect(CODEX_SKILL_TOTAL).toBeGreaterThan(10);
  });

  it('図鑑に載っているスキルは報酬に出やすい（重み ×2）', () => {
    const run = createRun();
    const base: Record<string, number> = {};
    const boosted: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) {
      offerSkills(seededRng(i), run).forEach((id) => (base[id] = (base[id] ?? 0) + 1));
      offerSkills(seededRng(i), { ...run, favored: ['jab'] }).forEach((id) => (boosted[id] = (boosted[id] ?? 0) + 1));
    }
    expect(boosted.jab).toBeGreaterThan(base.jab * 1.2);
  });

  it('run.favored は開始時の図鑑のスキルを引き継ぐ', () => {
    const meta = emptyMeta();
    discoverSkill(meta, 'slash');
    expect(createRun(undefined, meta).favored).toEqual(['slash']);
  });
});

describe('初期スキル（図鑑から出撃時に置く）', () => {
  const withCodex = (): MetaState => {
    const meta = emptyMeta();
    for (const id of ['slash', 'heavy', 'smash']) discoverSkill(meta, id);
    return meta;
  };

  it('図鑑のスキルだけ置ける。枠数（初期1）を超えては置けない', () => {
    const meta = withCodex();
    expect(selectableStartingSkills(meta)).toContain('slash');
    expect(selectableStartingSkills(meta)).not.toContain('jab');
    expect(setStartingSkill(meta, 13, 'jab')).toBe(false);
    expect(startingCapacity(meta)).toBe(1);
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(setStartingSkill(meta, 14, 'heavy')).toBe(false);
    expect(setStartingSkill(meta, 13, 'heavy')).toBe(true); // 同じスロットの入れ替えは可
  });

  it('初期スキル枠を強化すると枠が増える。置けるのは空きスロット（12〜14,16,17,19）だけ', () => {
    const meta = withCodex();
    meta.shards = 200;
    buyUpgrade(meta, 'kit');
    expect(startingCapacity(meta)).toBe(2);
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(setStartingSkill(meta, 17, 'heavy')).toBe(true);
    expect(setStartingSkill(meta, 15, 'smash')).toBe(false); // 15 は初期スロット（シールド）
    expect(setStartingSkill(meta, 11, 'smash')).toBe(false);
  });

  it('冒険の初期スロットに反映される。外せる', () => {
    const meta = withCodex();
    setStartingSkill(meta, 13, 'slash');
    const run = createRun(undefined, meta);
    expect(run.slots[13]).toBe('slash');
    expect(run.slots[15]).toBe('guard');
    setStartingSkill(meta, 13, null);
    expect(createRun(undefined, meta).slots[13]).toBeUndefined();
  });

  it('無効になった保存値（図鑑にない・枠超過）は無視される', () => {
    const meta = withCodex();
    meta.startingSkills = { 13: 'slash', 14: 'heavy', 16: 'nothing' };
    expect(Object.keys(validStartingSkills(meta))).toEqual(['13']);
  });
});

describe('セーブデータ', () => {
  it('保存して読み込める', () => {
    const st = new FakeStorage();
    const meta = emptyMeta();
    meta.shards = 42;
    meta.upgrades = { vitality: 2 };
    discoverSkill(meta, 'smash');
    discoverRelic(meta, 'orb');
    meta.startingSkills = { 13: 'smash' };
    saveMeta(meta, st);
    expect(loadMeta(st)).toEqual(meta);
  });

  it('保存がない・壊れている・バージョン違いなら初期状態で始める', () => {
    const st = new FakeStorage();
    expect(loadMeta(st)).toEqual(emptyMeta());
    st.setItem(META_KEY, '{broken');
    expect(loadMeta(st)).toEqual(emptyMeta());
    st.setItem(META_KEY, JSON.stringify({ version: 99, shards: 5 }));
    expect(loadMeta(st)).toEqual(emptyMeta());
    st.setItem(META_KEY, JSON.stringify({ version: 1, shards: -5, upgrades: { a: 'x' } }));
    expect(loadMeta(st).shards).toBe(0);
    expect(loadMeta(null)).toEqual(emptyMeta());
  });

  it('ストレージが使えなくても例外にならない', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(() => saveMeta(emptyMeta(), bad)).not.toThrow();
    expect(loadMeta(bad)).toEqual(emptyMeta());
  });
});
