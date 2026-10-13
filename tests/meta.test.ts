import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import { INN_HEAL_RATIO, useInn } from '../src/map/events';
import {
  buyUpgrade, canBuy, CODEX_SKILL_TOTAL, computeBonus, computeShards, discoverRelic, discoverSkill,
  emptyMeta, finishRun, resetAllMeta, isSkillDiscovered, loadMeta, META_KEY, nextCost, saveMeta,
  UPGRADES,
} from '../src/meta/Meta';
import { inventoryEntries } from '../src/run/loadout';
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
    expect(run.maxHp).toBe(40);
    expect(run.hp).toBe(40);
    expect(run.baseAttack).toBe(6);
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerBlock: run.bonus.startBlock, pace: noWait });
    expect(m.ctx.player.block).toBe(6);
    run.hp = 10;
    expect(useInn(run)).toBe(Math.ceil(40 * (INN_HEAL_RATIO + 0.2)));
    expect(offerSkills(seededRng(1), run)).toHaveLength(4);
  });

  it('強化なしなら今までどおり', () => {
    const run = createRun(undefined, emptyMeta());
    expect([run.maxHp, run.baseAttack, run.bonus.startBlock, run.bonus.extraChoices]).toEqual([30, 5, 0, 0]); // 初期の最大 HP は 30
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

describe('編成画面の持ち物の表示用ロジック', () => {
  it('inventoryEntries: 種類ごとに個数をまとめ、レア度の高い順に並べる', () => {
    const run = createRun();
    run.inventory.push('jab', 'smash', 'jab', 'heavy', 'jab');
    expect(inventoryEntries(run)).toEqual([
      { id: 'smash', count: 1 }, { id: 'heavy', count: 1 }, { id: 'jab', count: 3 },
    ]);
  });

  it('持ち物が空なら空配列', () => {
    expect(inventoryEntries(createRun())).toEqual([]);
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

describe('記録のすべての初期化（設定）', () => {
  it('魂片・祭壇・図鑑・戦績がすべて最初の状態に戻る（同じ meta オブジェクトのまま）', () => {
    const meta = emptyMeta();
    meta.shards = 80;
    meta.upgrades = { hp: 3 };
    meta.codex.skills.push('slash');
    meta.codex.relics.push('fang');
    meta.stats = { runs: 5, clears: 1, bestRow: 7 };
    const same = meta;
    resetAllMeta(meta);
    expect(meta).toBe(same);
    expect(meta).toEqual(emptyMeta());
  });

  it('保存しても、読み込み直すと最初の状態（保存先が使えなくても落ちない）', () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    const meta = emptyMeta();
    meta.shards = 10;
    saveMeta(meta, storage);
    resetAllMeta(meta);
    saveMeta(meta, storage);
    expect(loadMeta(storage)).toEqual(emptyMeta());
  });
});

describe('廃止した強化「初期装備枠」（出撃準備の廃止）の、保存データの移行', () => {
  it('買っていた分の魂片を返し、記録から消す。ほかの強化は変えない', () => {
    const st = new FakeStorage();
    st.setItem(META_KEY, JSON.stringify({
      version: 1, shards: 10, upgrades: { vitality: 2, kit: 2 }, codex: { skills: [], relics: [] },
      startingSkills: { 13: 'slash' }, stats: { runs: 3, clears: 0, bestRow: 4 },
    }));
    const meta = loadMeta(st);
    expect(meta.shards).toBe(10 + 50 + 100); // 初期装備枠 2 レベル分（50 + 100）
    expect(meta.upgrades).toEqual({ vitality: 2 });
    expect(meta).not.toHaveProperty('startingSkills'); // 廃止した保存項目は読み込まない
    expect(meta.stats.runs).toBe(3);
  });

  it('1 レベルだけ買っていたら 50 を返す。買っていなければ何も変わらない。2回読み込んでも二重に返さない', () => {
    const st = new FakeStorage();
    st.setItem(META_KEY, JSON.stringify({ version: 1, shards: 5, upgrades: { kit: 1 }, codex: { skills: [], relics: [] }, stats: {} }));
    const once = loadMeta(st);
    expect(once.shards).toBe(55);
    saveMeta(once, st);
    expect(loadMeta(st).shards).toBe(55); // 保存し直したあとは、もう返金されない
    st.setItem(META_KEY, JSON.stringify({ version: 1, shards: 5, upgrades: {}, codex: { skills: [], relics: [] }, stats: {} }));
    expect(loadMeta(st).shards).toBe(5);
  });

  it('祭壇の強化に「初期装備枠」はない', () => {
    expect(UPGRADES.map((u) => u.id)).not.toContain('kit');
  });
});
