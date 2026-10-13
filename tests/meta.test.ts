import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { seededRng } from '../src/core/util/Rng';
import { INN_HEAL_RATIO, useInn } from '../src/map/events';
import {
  buyUpgrade, canBuy, canCustomize, CODEX_SKILL_TOTAL, computeBonus, computeShards, customCount, discoverRelic, discoverSkill,
  emptyMeta, finishRun, resetAllMeta, resetStartingSkills, isSkillDiscovered, loadMeta, META_KEY, nextCost, saveMeta, selectableStartingSkills, setStartingSkill,
  startingCapacity, STARTING_SLOT_KEYS, UPGRADES, validStartingSkills, type MetaState,
} from '../src/meta/Meta';
import { getSkill, rarityOfSkill } from '../src/core/skills/Skill';
import { hasUnusedKitOpportunity, placedElsewhere, prepCandidates, prepSlots } from '../src/meta/prep';
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

describe('初期装備（出撃準備: 図鑑のスキルを出撃時に装備する）', () => {
  const withCodex = (): MetaState => {
    const meta = emptyMeta();
    for (const id of ['slash', 'heavy', 'smash']) discoverSkill(meta, id);
    return meta;
  };

  it('変えられるのは 12〜20。11以下（小攻撃）と 21（会心の一撃）は固定', () => {
    expect([...STARTING_SLOT_KEYS]).toEqual([12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const meta = withCodex();
    meta.shards = 999;
    buyUpgrade(meta, 'kit');
    expect(setStartingSkill(meta, 11, 'slash')).toBe(false);
    expect(setStartingSkill(meta, 21, 'slash')).toBe(false);
    expect(canCustomize(meta, 11)).toBe(false);
    expect(canCustomize(meta, 21)).toBe(false);
  });

  it('図鑑のスキルだけ置ける。枠数（初期1）を超えては置けないが、同じスロットの入れ替えはできる', () => {
    const meta = withCodex();
    expect(selectableStartingSkills(meta)).toContain('slash');
    expect(selectableStartingSkills(meta)).not.toContain('jab');
    expect(setStartingSkill(meta, 13, 'jab')).toBe(false);
    expect(startingCapacity(meta)).toBe(1);
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(customCount(meta)).toBe(1);
    expect(canCustomize(meta, 14)).toBe(false);
    expect(setStartingSkill(meta, 14, 'heavy')).toBe(false);
    expect(canCustomize(meta, 13)).toBe(true);
    expect(setStartingSkill(meta, 13, 'heavy')).toBe(true);
  });

  it('初期装備枠を強化すると枠が増える。初期スロット（15=シールド等）も置き換えられる', () => {
    const meta = withCodex();
    meta.shards = 200;
    buyUpgrade(meta, 'kit');
    expect(startingCapacity(meta)).toBe(2);
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(setStartingSkill(meta, 15, 'smash')).toBe(true); // シールドを置き換え
    expect(setStartingSkill(meta, 17, 'heavy')).toBe(false); // 枠がいっぱい
    expect(customCount(meta)).toBe(2);
  });

  it('初期装備と同じスキルを置く・null を渡すと「変更なし」に戻り、枠を消費しない', () => {
    const meta = withCodex();
    expect(setStartingSkill(meta, 20, 'smash')).toBe(true);
    expect(customCount(meta)).toBe(1);
    expect(setStartingSkill(meta, 20, 'big_attack')).toBe(true); // 初期装備と同じ → 変更なし
    expect(customCount(meta)).toBe(0);
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(setStartingSkill(meta, 13, null)).toBe(true);
    expect(customCount(meta)).toBe(0);
  });

  it('冒険の初期スロットに反映される。変更を戻すと初期装備に戻る', () => {
    const meta = withCodex();
    meta.shards = 200;
    buyUpgrade(meta, 'kit');
    setStartingSkill(meta, 13, 'slash');
    setStartingSkill(meta, 20, 'smash');
    const run = createRun(undefined, meta);
    expect(run.slots[13]).toBe('slash');
    expect(run.slots[20]).toBe('smash');
    expect(run.slots[15]).toBe('herb');
    expect(run.slots[18]).toBeUndefined(); // シールド・盾は初期装備ではない
    expect(run.slots[11]).toBe('small_attack');
    expect(run.slots[21]).toBe('ace_strike');
    setStartingSkill(meta, 20, null);
    expect(createRun(undefined, meta).slots[20]).toBe('big_attack');
    setStartingSkill(meta, 13, null);
    expect(createRun(undefined, meta).slots[13]).toBeUndefined();
  });

  it('無効になった保存値（図鑑にない・固定スロット・枠超過）は無視される', () => {
    const meta = withCodex();
    meta.startingSkills = { 11: 'smash', 13: 'slash', 14: 'heavy', 16: 'nothing', 21: 'smash' };
    expect(Object.keys(validStartingSkills(meta))).toEqual(['13']);
  });
});

describe('出撃準備の表示用ロジック', () => {
  const withCodex = (): MetaState => {
    const meta = emptyMeta();
    for (const id of ['slash', 'smash', 'jab']) discoverSkill(meta, id);
    return meta;
  };

  it('prepSlots: 全11スロットを返し、初期装備・変更後・実際に入るスキルを区別する', () => {
    const meta = withCodex();
    setStartingSkill(meta, 20, 'smash');
    const slots = prepSlots(meta);
    expect(slots).toHaveLength(11);
    const s20 = slots.find((s) => s.key === 20)!;
    expect(s20).toMatchObject({ defaultId: 'big_attack', customId: 'smash', effectiveId: 'smash', editable: true });
    const s13 = slots.find((s) => s.key === 13)!;
    expect(s13).toMatchObject({ defaultId: null, customId: null, effectiveId: null, editable: true });
    const s11 = slots.find((s) => s.key === 11)!;
    expect(s11).toMatchObject({ effectiveId: 'small_attack', editable: false, canChange: false });
    expect(slots.find((s) => s.key === 21)!.editable).toBe(false);
    expect(slots.find((s) => s.key === 18)!).toMatchObject({ effectiveId: null, customId: null }); // 初期装備にシールド・盾はない
  });

  it('枠がいっぱいのとき、変更済みでないスロットは canChange=false（選べない理由の表示に使う）', () => {
    const meta = withCodex();
    setStartingSkill(meta, 13, 'slash');
    const slots = prepSlots(meta);
    expect(slots.find((s) => s.key === 13)!.canChange).toBe(true);
    expect(slots.find((s) => s.key === 14)!.canChange).toBe(false);
  });

  it('prepCandidates: 図鑑のスキルがレア度の高い順（レジェンド → レア → コモン）に並ぶ', () => {
    const meta = withCodex();
    const ids = prepCandidates(meta);
    expect(ids).toContain('smash');
    expect(ids).not.toContain('heavy');
    const rank = (id: string) => ({ legend: 0, rare: 1, common: 2 })[rarityOfSkill(getSkill(id))];
    for (let i = 1; i < ids.length; i++) expect(rank(ids[i])).toBeGreaterThanOrEqual(rank(ids[i - 1]));
    expect(ids[0]).toBe('smash');
  });

  it('placedElsewhere: ほかのどのスロットに入る予定かを返す（自分のスロットは除く）', () => {
    const meta = withCodex();
    expect(placedElsewhere(meta, 'big_attack', 13)).toEqual([20]);
    expect(placedElsewhere(meta, 'big_attack', 20)).toEqual([]);
    expect(placedElsewhere(meta, 'herb', 13)).toEqual([15]);
  });

  it('hasUnusedKitOpportunity: 初期スキル以外が図鑑にあり、枠が余っているときだけ true', () => {
    const meta = emptyMeta();
    expect(hasUnusedKitOpportunity(meta)).toBe(false); // 図鑑に初期スキルしかない
    discoverSkill(meta, 'slash');
    expect(hasUnusedKitOpportunity(meta)).toBe(true);
    setStartingSkill(meta, 13, 'slash');
    expect(hasUnusedKitOpportunity(meta)).toBe(false); // 枠を使い切った
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

describe('スキルの初期化（出撃準備の初期装備を、素の状態に戻す）', () => {
  it('変えた初期装備がすべて戻り、魂片・祭壇・図鑑は変わらない', () => {
    const meta = emptyMeta();
    meta.shards = 100;
    meta.upgrades = { hp: 2, slots: 1 };
    meta.codex.skills.push('slash', 'heavy');
    expect(setStartingSkill(meta, 13, 'slash')).toBe(true);
    expect(customCount(meta)).toBe(1);
    expect(resetStartingSkills(meta)).toBe(1);
    expect(customCount(meta)).toBe(0);
    expect(meta.startingSkills).toEqual({});
    expect(meta.shards).toBe(100);
    expect(meta.upgrades).toEqual({ hp: 2, slots: 1 });
    expect(meta.codex.skills).toEqual(expect.arrayContaining(['slash', 'heavy']));
    expect(resetStartingSkills(meta)).toBe(0); // 何もなければ 0
  });
});

describe('記録のすべての初期化（設定）', () => {
  it('魂片・祭壇・図鑑・初期装備・戦績がすべて最初の状態に戻る（同じ meta オブジェクトのまま）', () => {
    const meta = emptyMeta();
    meta.shards = 80;
    meta.upgrades = { hp: 3 };
    meta.codex.skills.push('slash');
    meta.codex.relics.push('fang');
    meta.startingSkills = { 13: 'slash' };
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
