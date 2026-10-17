import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { DEFAULT_PLAYER_SLOTS, ITEM_POOL, SKILL_POOL } from '../src/core/skills/catalog';
import { canPlaceAt, getSkill, hasSkill, minSlotOf, placementNote, RARITY_MIN_SLOT, rarityOfSkill, SLOT_KEYS } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { INN_HEAL_RATIO, resolveShrine, useInn } from '../src/map/events';
import { STAGES, stageRowOffset, stageRows } from '../src/map/stages';
import { RARITY_RATE, rarityRates, tierWeights } from '../src/core/rarity';
import { nextTiles, tileOf, type TileKind } from '../src/map/StageMap';
import {
  Boots, Breastplate, LifeCandle, RELIC_POOL, SturdyShield,
  Whetstone,
} from '../src/relics/catalog';
import {
  createRun, debugMoveTo, enemyOfTile, equipSkill, isCleared, isSlotLocked, markCleared, moveTo, offerRelics, offerSkills, reachableTiles,
  advanceStage, canSwapSpots, swapSpots, canUpgradeSlot, isFinalStage, STAGE_CLEAR_MAX_HP, STAGE_CLEAR_HEAL, swapSlots, upgradeSlot, placementViolations, shrineUpgradeChoices, canMergeAt, mergeSkill, hasMergeTarget,
} from '../src/run/Run';
import { ENEMY_SPRITES } from '../src/ui/components/enemySprites';
import { upgradeCost } from '../src/run/shop';
import { noWait, playRound, reshapeRelic, unlockRelic, WITH_BLOCKS } from './helpers';

describe('敵', () => {
  it('全員にスプライトがあり、スロットのスキルが全て実在する', () => {
    expect(new Set(ENEMY_LINEUP.map((e) => e.id)).size).toBe(ENEMY_LINEUP.length);
    expect(ENEMY_LINEUP).toHaveLength(20); // 既存 16 種 + 重装の盾兵・貪欲なミミック・彷徨う賭博師・腐肉の巨兵
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

describe.each(STAGES.map((m, i) => [i + 1, m] as const))('第%i階層のマップ', (_n, STAGE_1) => {
  const tiles = Object.values(STAGE_1.tiles);
  const boss = tiles.find((t) => t.kind === 'boss')!;

  it('スタートは1つ、ボス（行き止まり）は1つ', () => {
    expect(tiles.filter((t) => t.kind === 'start')).toHaveLength(1);
    expect(tiles.filter((t) => t.kind === 'boss')).toHaveLength(1);
    expect(boss.next).toEqual([]);
    expect(STAGE_1.start).toBe(tiles.find((t) => t.kind === 'start')!.id);
  });

  it('すべての道は上向きに1段ずつ進み、行き止まりはボスだけ', () => {
    for (const t of tiles) {
      for (const n of t.next) expect(tileOf(STAGE_1, n).row).toBe(t.row + 1);
      if (t.next.length === 0) expect(t.kind).toBe('boss');
    }
  });

  it('全マスがスタートから到達でき、全マスからボスに辿り着ける', () => {
    const reach = new Set<string>();
    const walk = (id: string) => { if (!reach.has(id)) { reach.add(id); nextTiles(STAGE_1, id).forEach((t) => walk(t.id)); } };
    walk(STAGE_1.start);
    expect(reach.size).toBe(tiles.length);
    const toBoss = (id: string): boolean => id === boss.id || nextTiles(STAGE_1, id).some((t) => toBoss(t.id));
    expect(tiles.every((t) => toBoss(t.id))).toBe(true);
  });

  it('途中に分岐があり、全種類のマスが存在する', () => {
    expect(tiles.some((t) => t.next.length >= 2)).toBe(true);
    const kinds = new Set<TileKind>(tiles.map((t) => t.kind));
    for (const k of ['start', 'enemy', 'chest', 'inn', 'shrine', 'boss'] as TileKind[]) expect(kinds.has(k)).toBe(true);
  });

  it('敵・ボスのマスは実在する敵を指す', () => {
    for (const t of tiles.filter((x) => x.kind === 'enemy' || x.kind === 'boss')) {
      expect(enemyOfTile(t).id).toBe(t.enemyId);
    }
  });
});

describe('階層の構成', () => {
  it('3つの階層があり、ボスは 墓守の騎士 → 深淵の海蛇 → 黒竜', () => {
    expect(STAGES).toHaveLength(3);
    expect(STAGES.map((m) => Object.values(m.tiles).find((t) => t.kind === 'boss')!.enemyId)).toEqual(['knight', 'serpent', 'dragon']);
    // 階層が進むほど、長い（第1階層 9段 → 第2階層 14段 → 第3階層 19段 = 約2倍）
    expect(STAGES.map(stageRows)).toEqual([9, 14, 19]);
  });

  it('階層ごとの敵: 新規4種（重装の盾兵・貪欲なミミック・彷徨う賭博師・腐肉の巨兵）と中ボスを含む多彩な編成', () => {
    const ids = (m: (typeof STAGES)[number]) => new Set(Object.values(m.tiles).flatMap((t) => (t.enemyId ? [t.enemyId] : [])));
    expect(ids(STAGES[0])).toEqual(new Set(['slime', 'skeleton', 'bat', 'ghoul', 'shield_bearer', 'mimic', 'knight']));
    expect(ids(STAGES[1])).toEqual(new Set(['merman', 'gargoyle', 'wraith', 'iron_golem', 'drowned_knight', 'mimic', 'gambler', 'colossus', 'serpent']));
    expect(ids(STAGES[2])).toEqual(new Set(['flame', 'golem', 'imp', 'iron_golem', 'magma_serpent', 'mimic', 'gambler', 'colossus', 'dragon']));
  });

  it('戦略ルート: 祠は各階層に 1 箇所だけ（全3階層で最大3回）。単調な3列固定ではなく2列・3列が組み合わさり、ミミックの直後にショップがある', () => {
    for (const stage of STAGES) {
      const tiles = Object.values(stage.tiles);
      expect(tiles.some((t) => t.kind === 'empty')).toBe(false);
      // 祠は各階層に 1 箇所だけ（会心の一撃 → 覇王の一撃 → 終焉の一撃 を各階層 1 段階ずつ育てる）
      expect(tiles.filter((t) => t.kind === 'shrine')).toHaveLength(1);
      // 2マスの段と3マスの段が両方存在し、単調な格子にならない
      const rowCounts = new Set(Array.from({ length: stageRows(stage) }, (_, r) => tiles.filter((t) => t.row === r).length));
      expect(rowCounts.has(2)).toBe(true);
      expect(rowCounts.has(3)).toBe(true);
      // 賞金首ルート: どの階層にも、倒した直後にショップへ行けるミミックがいる
      const mimics = tiles.filter((t) => t.enemyId === 'mimic');
      expect(mimics.length).toBeGreaterThanOrEqual(1);
      expect(mimics.some((m) => nextTiles(stage, m.id).some((n) => n.kind === 'shop'))).toBe(true);
      // ボス直前は宿屋（安全回復）と敵（最後の稼ぎ）を選べる
      const bossRow = stageRows(stage) - 1;
      const preBossKinds = new Set(tiles.filter((t) => t.row === bossRow - 1).map((t) => t.kind));
      expect(preBossKinds.has('inn')).toBe(true);
      expect(preBossKinds.has('enemy')).toBe(true);
    }
  });

  it('中ボス（水没した騎士・溶岩の大蛇）と屍食鬼は分岐の挑戦ルート（左列）に配置され、直後に宝箱があり、別ルートへ迂回もできる', () => {
    const checkChallenge = (stageIdx: number, enemyId: string) => {
      const map = STAGES[stageIdx];
      const tiles = Object.values(map.tiles);
      const elite = tiles.find((t) => t.enemyId === enemyId)!;
      expect(elite).toBeDefined();
      expect(elite.col).toBe(0);
      // 同じ段に迂回ルート（他の列のマス）が存在する
      const sameRow = tiles.filter((t) => t.row === elite.row);
      expect(sameRow.length).toBeGreaterThanOrEqual(2);
      // 倒した直後のマスは宝箱（遺物）
      const reward = nextTiles(map, elite.id);
      expect(reward).toHaveLength(1);
      expect(reward[0].kind).toBe('chest');
    };
    checkChallenge(0, 'ghoul');
    checkChallenge(1, 'drowned_knight');
    checkChallenge(2, 'magma_serpent');
  });

  it('次の階層へ: 最大 HP が +10、HP が最大の7割（+10 の分も）回復し、位置・済みのマスが新しい階層になる。最後の階層では進めない', () => {
    const run = createRun();
    expect(run.stage).toBe(1);
    run.hp = 5;
    run.cleared = ['A'];
    moveTo(run, 'A');
    expect(isFinalStage(run)).toBe(false);
    expect(advanceStage(run)).toBe(true);
    expect(run.stage).toBe(2);
    expect(run.map.id).toBe('stage2');
    expect(run.position).toBe('S');
    expect(run.cleared).toEqual([]);
    expect(run.maxHp).toBe(30 + STAGE_CLEAR_MAX_HP); // 最大 HP が増える
    expect(run.hp).toBe(Math.min(run.maxHp, 5 + STAGE_CLEAR_MAX_HP + Math.ceil(run.maxHp * STAGE_CLEAR_HEAL)));
    run.hp = run.maxHp - 1;
    advanceStage(run);
    expect(run.stage).toBe(3);
    expect(run.hp).toBe(run.maxHp); // 最大 HP を超えない
    expect(isFinalStage(run)).toBe(true);
    expect(advanceStage(run)).toBe(false);
    expect(run.stage).toBe(3);
  });

  it('深さ（魂片の計算）は階層をまたいで通算する', () => {
    const run = createRun();
    moveTo(run, 'A');
    expect(run.stats.maxRow).toBe(1);
    advanceStage(run);
    moveTo(run, 'A');
    expect(stageRowOffset(2)).toBe(9);
    expect(run.stats.maxRow).toBe(9 + 1);
  });

  it('階層が進むほど、レアとレジェンドが出やすい。どの階層も、割合の合計は 100', () => {
    for (const st of [1, 2, 3] as const) expect(Object.values(RARITY_RATE[st]).reduce((x, y) => x + y, 0)).toBe(100);
    expect(rarityRates(1).legend).toBeLessThan(rarityRates(2).legend);
    expect(rarityRates(2).legend).toBeLessThan(rarityRates(3).legend);
    expect(rarityRates(1).common).toBeGreaterThan(rarityRates(3).common);
    expect(rarityRates(0)).toEqual(rarityRates(1)); // 範囲外は端の階層
    expect(rarityRates(9)).toEqual(rarityRates(3));
  });

  it('レア度ごとの割合は、そのレア度の個数に左右されない（個数が多いレジェンドが出やすくならない）', () => {
    const pool = ['c1', 'c2', 'r1', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'];
    const rarityOf = (id: string) => (id.startsWith('c') ? 'common' : id.startsWith('r') ? 'rare' : 'legend') as 'common' | 'rare' | 'legend';
    const w = tierWeights(pool, rarityOf, 1);
    const share = (r: 'common' | 'rare' | 'legend') => pool.filter((x) => rarityOf(x) === r).reduce((sum, x) => sum + w(x), 0);
    expect(share('common')).toBeCloseTo(70);
    expect(share('rare')).toBeCloseTo(27);
    expect(share('legend')).toBeCloseTo(3); // 6個あっても、合計で 3
  });

  it('実際の抽選でも、階層ごとのレア度の割合になる（スキル報酬・レリック）', () => {
    for (const stage of [1, 2, 3] as const) {
      const run = createRun();
      run.stage = stage;
      const skillCount = { common: 0, rare: 0, legend: 0 };
      const relicCount = { common: 0, rare: 0, legend: 0 };
      const N = 3000;
      for (let i = 0; i < N; i++) {
        const rng = seededRng(i + 1);
        // スキルの2枠だけを数える（3枠目は道具・防具の枠で、別のプール）
        for (const id of offerSkills(rng, run).slice(0, 2)) skillCount[rarityOfSkill(getSkill(id))]++;
        for (const r of offerRelics(run, rng)) relicCount[r.rarity ?? 'common']++;
      }
      const rate = RARITY_RATE[stage];
      // 重複なしで選ぶので、少しずれる。レジェンドが、決めた割合を大きく超えないことを確かめる
      expect(skillCount.legend / (N * 2) * 100, `skill stage${stage}`).toBeLessThan(rate.legend + 5);
      expect(skillCount.common / (N * 2) * 100, `skill stage${stage}`).toBeGreaterThan(rate.common - 12);
      expect(relicCount.legend / (N * 3) * 100, `relic stage${stage}`).toBeLessThan(rate.legend + 12); // レリックのレジェンドは3個しかない
    }
  });
});

describe('駒の移動', () => {
  it('1度に1マスだけ、隣接マスにだけ進める', () => {
    const run = createRun();
    expect(run.position).toBe('S');
    expect(() => moveTo(run, 'B')).toThrow();
    moveTo(run, 'A');
    expect(reachableTiles(run).map((t) => t.id).sort()).toEqual(['L1', 'M1', 'R1']);
    expect(() => moveTo(run, 'L2')).toThrow();
    moveTo(run, 'L1');
    expect(run.position).toBe('L1');
  });

  it('デバッグ用: 離れたマス（ボスなど）へ直接ワープ移動できる', () => {
    const run = createRun();
    expect(run.position).toBe('S');
    const boss = debugMoveTo(run, 'B');
    expect(run.position).toBe('B');
    expect(boss.kind).toBe('boss');
    expect(() => debugMoveTo(run, 'INVALID')).toThrow();
  });

  it('済みのマスを記録できる', () => {
    const run = createRun();
    expect(isCleared(run, 'A')).toBe(false);
    markCleared(run, 'A');
    markCleared(run, 'A');
    expect(run.cleared).toEqual(['A']);
  });
});

describe('冒険の状態（レベル・経験値は廃止）', () => {
  it('RunState に exp / level を持たない', () => {
    const run = createRun() as unknown as Record<string, unknown>;
    expect(run).not.toHaveProperty('exp');
    expect(run).not.toHaveProperty('level');
    expect(run.stage).toBe(1); // 階層（ステージ）は、第1階層から始まる
  });

  it('持ち越したスロットとHPがバトルに反映される', () => {
    const run = createRun();
    run.hp = 23;
    run.slots = { 13: 'guard' };
    const m = new BattleMachine({
      enemy: ENEMY_LINEUP[0], playerMaxHp: run.maxHp, playerHp: run.hp,
      playerSlots: run.slots, playerFallback: run.fallbackSkill, pace: noWait,
    });
    expect(m.ctx.player.hp).toBe(23);
    expect(m.ctx.player.slots[13]).toBe('guard');
  });
});

describe('スキルの付け替え', () => {
  it('スロット11以下（小攻撃）と21（会心の一撃）は固定されている（付け替え不可）', () => {
    const run = createRun();
    expect(run.slots[11]).toBe('small_attack');
    expect(run.slots[21]).toBe('ace_strike');
    run.inventory.push('smash');
    for (const key of [11, 21]) {
      expect(isSlotLocked(run, key)).toBe(true);
      expect(equipSkill(run, key, 'smash')).toBe(false);
    }
    expect(run.slots[11]).toBe('small_attack');
    expect(run.slots[21]).toBe('ace_strike');
    expect(run.inventory).toEqual(['smash']);
  });

  it('それ以外のスロット（12〜20）は付け替えられる', () => {
    const run = createRun();
    for (let key = 12; key <= 20; key++) expect(isSlotLocked(run, key)).toBe(false);
  });

  it('報酬スキルの抽選に小攻撃（11以下固定）は出ない', () => {
    expect(SKILL_POOL).not.toContain('small_attack');
  });

  it('付け替えはできず上書きのみ: 元のスキルは失われ、持ち物には戻らない', () => {
    const run = createRun();
    run.inventory.push('smash');
    expect(equipSkill(run, 20, 'smash')).toBe(true);
    expect(run.slots[20]).toBe('smash');
    expect(run.inventory).toEqual([]);
  });

  it('空きスロットにセットできる（外して空きに戻す操作はない）', () => {
    const run = createRun();
    run.inventory.push('slash');
    expect(equipSkill(run, 13, 'slash')).toBe(true);
    expect(run.inventory).toEqual([]);
    expect(run.slots[13]).toBe('slash');
  });

  it('持っていないスキルはセットできない', () => {
    expect(equipSkill(createRun(), 13, 'slash')).toBe(false);
  });

  it('21 を解錠するレリックを持つと、スロット21だけ付け替えられ（11以下は固定のまま）、会心の一撃は持ち物に残る', () => {
    const run = createRun();
    expect(isSlotLocked(run, 11)).toBe(true);
    run.relics.push(unlockRelic(21));
    run.inventory.push('smash');
    expect(equipSkill(run, 21, 'smash')).toBe(true);
    expect(run.slots[21]).toBe('smash');
    expect(run.inventory).toEqual([]); // 上書きされた会心の一撃は失われる
    expect(isSlotLocked(run, 11)).toBe(true);
  });
});

describe('祠: 入れ替えとバージョンアップ', () => {
  it('入れ替え: 2つのスロットの中身を交換し、空きへは移動になる。固定スロットは動かせない', () => {
    const run = createRun();
    run.slots = { ...WITH_BLOCKS };
    expect(swapSlots(run, 15, 18)).toBe(true);
    expect([run.slots[15], run.slots[18]]).toEqual(['shield', 'guard']);
    expect(swapSlots(run, 15, 13)).toBe(true); // 空きへ移動
    expect(run.slots[15]).toBeUndefined();
    expect(run.slots[13]).toBe('shield');
    expect(swapSlots(run, 11, 15)).toBe(false);
    expect(swapSlots(run, 21, 15)).toBe(false);
    expect(swapSlots(run, 14, 16)).toBe(false); // 両方空き
    expect(run.inventory).toEqual([]);
  });

  it('祠のバージョンアップの候補は、21 の会心の一撃の系統だけ。終焉の一撃まで育ったら、候補はない', () => {
    const run = createRun();
    run.slots = { ...WITH_BLOCKS };
    Object.assign(run.slots, { 12: 'jab', 13: 'slash', 14: 'guard', 15: 'big_attack', 16: 'slash' }); // ほかのスキルは候補に出ない（＋は合成で作る）
    expect(shrineUpgradeChoices(run, seededRng(1))).toEqual([21]);
    run.slots[21] = 'overlord_strike';
    expect(shrineUpgradeChoices(run, seededRng(1))).toEqual([21]);
    run.slots[21] = 'final_strike';
    expect(shrineUpgradeChoices(run, seededRng(1))).toEqual([]);
  });

  it('合成: 手に入れたスキルと同じスキルのスロットで、2 つを合わせて「＋」にする（手持ちの 1 つを使う）', () => {
    const run = createRun();
    run.slots = { ...WITH_BLOCKS, 16: 'slash' };
    run.inventory = ['slash'];
    expect(hasMergeTarget(run, 'slash')).toBe(true);
    expect(canMergeAt(run, 16, 'slash')).toBe(true);
    expect(canMergeAt(run, 15, 'slash')).toBe(false); // 違うスキルのスロット
    expect(mergeSkill(run, 16, 'slash')).toBe('slash_plus');
    expect(run.slots[16]).toBe('slash_plus');
    expect(run.inventory).toEqual([]);
    // ＋はそれ以上合成しない。手持ちがなければ合成できない
    run.inventory = ['slash'];
    expect(canMergeAt(run, 16, 'slash')).toBe(false);
    expect(hasMergeTarget(run, 'slash')).toBe(false);
    run.slots[17] = 'slash';
    run.inventory = [];
    expect(canMergeAt(run, 17, 'slash')).toBe(false);
  });
  it('道具・会心の一撃は合成できない', () => {
    const run = createRun();
    run.slots = { ...WITH_BLOCKS, 12: 'herb' };
    run.inventory = ['herb', 'ace_strike'];
    expect(canMergeAt(run, 12, 'herb')).toBe(false);
    expect(canMergeAt(run, 21, 'ace_strike')).toBe(false);
    expect(hasMergeTarget(run, 'herb')).toBe(false);
  });

  it('バージョンアップ: スキルが「＋」になる（レア度は同じ）。＋はそれ以上強化できない。道具は不可。会心の一撃は別に育つ', () => {
    const run = createRun();
    run.slots = { ...WITH_BLOCKS };
    run.slots[18] = 'guard';
    expect(canUpgradeSlot(run, 18)).toBe(true); // 受け流し(コモン)
    expect(upgradeSlot(run, 18)).toBe('guard_plus');
    expect(getSkill('guard_plus').name).toBe('受け流し＋');
    expect(rarityOfSkill(getSkill('guard_plus'))).toBe('common'); // レア度は変わらない
    expect(canUpgradeSlot(run, 18)).toBe(false); // ＋はこれ以上不可
    expect(upgradeSlot(run, 18)).toBeNull();
    expect(canUpgradeSlot(run, 12)).toBe(false); // 薬草（道具）
    expect(canUpgradeSlot(run, 11)).toBe(false); // 固定（強化先がない）
    expect(canUpgradeSlot(run, 21)).toBe(true); // 固定でも、会心の一撃は覇王の一撃にできる
    expect(run.slots[12]).toBe('herb');
  });

  it('強化先は同じレア度（会心の一撃の系統もレジェンドのまま）。道具には強化先がない', () => {
    for (const id of SKILL_POOL) {
      const to = getSkill(id).upgradesTo;
      expect(to, id).toBe(`${id}_plus`);
      expect(rarityOfSkill(getSkill(to!)), id).toBe(rarityOfSkill(getSkill(id)));
    }
    for (const id of ['ace_strike', 'overlord_strike']) expect(rarityOfSkill(getSkill(getSkill(id).upgradesTo!))).toBe('legend');
    for (const id of ITEM_POOL) expect(getSkill(id).upgradesTo).toBeUndefined();
  });
});

describe('マスのイベント', () => {
  it('宿屋: 最大HPの50%回復し、最大HPを超えない', () => {
    const run = createRun();
    run.hp = 10;
    expect(useInn(run)).toBe(Math.ceil(30 * INN_HEAL_RATIO));
    expect(run.hp).toBe(25);
    run.hp = 28;
    useInn(run);
    expect(run.hp).toBe(30);
  });

  it('祠: どの乱数でも何かが起き、HPは1未満にならず、不変条件を保つ', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const run = createRun();
      run.hp = 5;
      const r = resolveShrine(run, seededRng(seed));
      seen.add(r.id);
      expect(r.text.length).toBeGreaterThan(0);
      expect(run.hp).toBeGreaterThanOrEqual(1);
      expect(run.hp).toBeLessThanOrEqual(run.maxHp);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5); // 複数の効果が出る
  });

  it('祠: 古き技は持ち物にスキルを加える。血の契約はレリックを加える', () => {
    const found: Record<string, boolean> = {};
    for (let seed = 1; seed <= 300 && Object.keys(found).length < 2; seed++) {
      const run = createRun();
      const r = resolveShrine(run, seededRng(seed));
      if (r.id === 'old-art') { expect(run.inventory).toHaveLength(1); found[r.id] = true; }
      if (r.id === 'pact') { expect(run.relics).toHaveLength(1); found[r.id] = true; }
    }
    expect(Object.keys(found).sort()).toEqual(['old-art', 'pact']);
  });

  it('報酬: スキルは3択で重複なし、宝箱のレリックは所持済みを除く', () => {
    // 報酬は、スキルだけ（道具・防具は出ない。ショップでだけ買える）
    const skills = offerSkills(seededRng(1));
    expect(skills).toHaveLength(3);
    expect(new Set(skills).size).toBe(3);
    skills.forEach((id) => expect(SKILL_POOL).toContain(id));
    for (let seed = 1; seed <= 30; seed++) {
      const o = offerSkills(seededRng(seed), createRun(), 'skeleton');
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
      expect(o.every((id) => SKILL_POOL.includes(id))).toBe(true);
    }
    const run = createRun();
    expect(offerRelics(run, seededRng(1))).toHaveLength(3);
    run.relics.push(Whetstone);
    expect(offerRelics(run, seededRng(1)).some((r) => r.id === 'whetstone')).toBe(false);
    expect(RELIC_POOL).toHaveLength(15);
  });
});

describe('レリックの効果', () => {
  it('砥石: 基本パワー +1（20 の大攻撃 POW+5 が 15 → 16）', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Whetstone] });
    expect(m.ctx.enemy.hp).toBe(40 - 16);
  });

  it('胸当て: 受ける攻撃ダメージ -1', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Breastplate] });
    expect(m.ctx.player.hp).toBe(60 - 2); // 溶解 3 - 1
  });

  it('疾風の靴: 同値でも先攻になる', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 10, relics: [Boots] });
    expect(m.ctx.turn?.mode).toBe('sequential');
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(60);
  });

  it('堅牢の盾: 獲得するブロック +3', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['6', '8'], relics: [SturdyShield], stopAt: ['CheckDeath'], playerSlots: WITH_BLOCKS });
    expect(m.ctx.player.block).toBe(6 + 3 - 1); // 受け流し 6 + 3、敵 14 の酸の飛沫 POW3×0.5 = 1
  });

  it('命の蝋燭: 戦闘開始時にHP+2', () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerHp: 30, relics: [LifeCandle], pace: noWait });
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.player.hp).toBe(32);
  });

  it('覇王の一撃（祠で会心の一撃をバージョンアップ）: POW×2（効果は攻撃だけ）', async () => {
    const m = await playRound({ player: ['7', '7', '7'], enemyHand: ['3', '4'], enemyHp: 100, playerSlots: { ...DEFAULT_PLAYER_SLOTS, 21: 'overlord_strike' }, stopAt: ['CheckDeath'] });
    expect(m.ctx.enemy.hp).toBe(100 - 22); // 21 は POW 11: POW×2（会心の一撃のままなら ×1.5 = 16）
    expect(m.ctx.player.block).toBe(0); // ブロックの効果はない
  });

  it('祠のバージョンアップ: 固定スロット 21 の会心の一撃は、覇王の一撃 → 終焉の一撃と育つ（入れ替え・上書きはできないまま）', () => {
    const run = createRun();
    expect(run.slots[21]).toBe('ace_strike');
    expect(canUpgradeSlot(run, 21)).toBe(true);
    const chain = ['overlord_strike', 'final_strike'];
    for (const id of chain) expect(upgradeSlot(run, 21)).toBe(id);
    expect(run.slots[21]).toBe('final_strike');
    expect(canUpgradeSlot(run, 21)).toBe(false); // もう上はない
    // レア度: どの段階もレジェンドのまま（名前と効果だけが変わる）
    expect(['ace_strike', ...chain].map((id) => rarityOfSkill(getSkill(id)))).toEqual(['legend', 'legend', 'legend']);
    // 代金: 覇王の一撃へ 40 G、終焉の一撃へ 80 G
    expect(['ace_strike', 'overlord_strike'].map((id) => upgradeCost(id))).toEqual([40, 80]);
    expect(swapSlots(run, 21, 20)).toBe(false); // 固定スロットは、動かせないまま
    expect(canUpgradeSlot(run, 11)).toBe(false); // 11以下（小攻撃）には強化先がない
  });
});

describe('レリックで変わるスキル効果', () => {
  it('スキルを書き換えるレリック: 大攻撃が POW×2+5 になる', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, relics: [reshapeRelic('big_attack', 2, 5)] });
    expect(60 - m.ctx.enemy.hp).toBe(25); // 20 は POW 10: POW×2+5
  });

  it('スキルを書き換えるレリック: 小攻撃（11以下）が POW×0.5 から POW×2+10 になる', async () => {
    const base = await playRound({ player: ['3', '4'], enemyHand: ['9', '9'], enemyHp: 60 });
    const buffed = await playRound({ player: ['3', '4'], enemyHand: ['9', '9'], enemyHp: 60, relics: [reshapeRelic('small_attack', 2, 10)] });
    expect(60 - base.ctx.enemy.hp).toBe(1);   // 後攻の小攻撃 = POW(1)×0.5（最低 1）
    expect(60 - buffed.ctx.enemy.hp).toBe(12); // POW(1)×2+10
  });
});

describe('敵の特性', () => {
  const enemy = (id: string) => ENEMY_LINEUP.find((e) => e.id === id)!;

  it('骸骨兵: 骨の鎧（受けるダメージ -2）', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemy: enemy('skeleton') });
    expect(m.ctx.enemy.hp).toBe(enemy('skeleton').maxHp - 13); // 大攻撃15 - 骨の鎧2（敵 18 は斬り下ろしで、ブロック なし）
  });

  it('大蝙蝠: 同値なら必ず敵が先攻', async () => {
    const m = await playRound({ player: ['K', 'Q'], enemyHand: ['K', 'K'], enemy: enemy('bat') });
    expect(m.ctx.turn).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });

  it('屍食鬼: HPを削るたびHP+2', async () => {
    const m = await playRound({ player: ['9', '8'], enemyHand: ['K', 'K'], enemy: enemy('ghoul'), enemyHp: 15 });
    expect(m.ctx.player.hp).toBe(60 - 6); // 20: 引き裂き POW4+2 = 6（17 は未設定でブロック なし）
    expect(m.ctx.enemy.hp).toBe(15 + 2 - 7); // HP を削って +2 回復、そのあと後攻の通常攻撃（17 は POW 7）
  });

  it('黒竜: 攻撃ダメージ +3', async () => {
    const m = await playRound({ player: ['9', '9'], enemyHand: ['K', 'K'], enemy: enemy('dragon'), playerSlots: WITH_BLOCKS });
    expect(m.ctx.player.hp).toBe(60 - (23 - 11)); // 20: 業火 POW6×3+2 + 息吹3 = 23。後攻の身構え ブロック 11 が先に付与される
  });

  it('重装の盾兵: 開幕ブロック 10 + 毎ラウンド +2（上限 14）。低 HP 高ブロック', () => {
    const def = enemy('shield_bearer');
    expect(def.maxHp).toBe(14);
    const m = new BattleMachine({ enemy: def, pace: noWait });
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.enemy.block).toBe(10);
    m.bus.emit('onRoundStart', { round: 1 });
    expect(m.ctx.enemy.block).toBe(12);
    m.bus.emit('onRoundStart', { round: 2 });
    m.bus.emit('onRoundStart', { round: 3 });
    expect(m.ctx.enemy.block).toBe(14);
  });

  it('貪欲なミミック: 獲得ゴールドが通常の 3 倍で、開幕ブロック 4 を持つ', async () => {
    const { enemyGold } = await import('../src/run/shop');
    const def = enemy('mimic');
    expect(def.goldMultiplier).toBe(3);
    expect(enemyGold(def)).toBe(enemyGold({ ...def, goldMultiplier: 1 }) * 3);
    const m = new BattleMachine({ enemy: def, pace: noWait });
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.enemy.block).toBe(4);
  });

  it('彷徨う賭博師（SmartAI）: ソフトハンド（A+5=16）ではヒットし、手負い時のハード15〜16ではスタンドして守り、好機には17以上を狙う', async () => {
    const { makeCard } = await import('../src/core/cards/Card');
    const def = enemy('gambler');
    const m = new BattleMachine({ enemy: def, pace: noWait });
    // 1. ソフト16 (A + 5) -> いつでもヒット
    m.ctx.enemy.hand.clear();
    m.ctx.enemy.hand.add(makeCard('A', 'S'));
    m.ctx.enemy.hand.add(makeCard('5', 'H'));
    expect(m.ctx.enemy.hand.isSoft(m.ctx.rules)).toBe(true);
    m.ctx.enemy.hp = 10; // 手負いでもソフトハンドならヒット
    expect(def.ai.decide(m.ctx.enemy, m.ctx.player, m.ctx.rules)).toBe('hit');
    // 2. 手負い時（HP <= 60%）かつプレイヤーのブロックが薄い時のハード15 (10 + 5) -> ブラフ（ブロック+回復）発動のためスタンド
    m.ctx.enemy.hand.clear();
    m.ctx.enemy.hand.add(makeCard('10', 'S'));
    m.ctx.enemy.hand.add(makeCard('5', 'H'));
    expect(m.ctx.enemy.hand.isSoft(m.ctx.rules)).toBe(false);
    m.ctx.player.block = 0;
    expect(def.ai.decide(m.ctx.enemy, m.ctx.player, m.ctx.rules)).toBe('stand');
    // 3. 万全時（HP > 60%）またはプレイヤーがブロックを固めている時のハード15 (10 + 5) -> 17以上を狙ってヒット
    m.ctx.enemy.hp = def.maxHp;
    expect(def.ai.decide(m.ctx.enemy, m.ctx.player, m.ctx.rules)).toBe('hit');
  });

  it('腐肉の巨兵: 高 HP（46）かつ毎ラウンド再生 +1', () => {
    const def = enemy('colossus');
    expect(def.maxHp).toBeGreaterThanOrEqual(45);
    const m = new BattleMachine({ enemy: def, pace: noWait });
    m.ctx.enemy.hp = 30;
    m.bus.emit('onRoundStart', { round: 1 });
    expect(m.ctx.enemy.hp).toBe(31);
  });
});

describe('スキル・道具のスロット配置（レア度によるスロット制限なし）', () => {
  it('コモン・レア・レジェンドのスキルはすべてどのスロットにも置ける（防具はスロットに置けない）', () => {
    expect(RARITY_MIN_SLOT).toEqual({ common: 11, rare: 11, legend: 11 });
    expect([minSlotOf(getSkill('jab')), minSlotOf(getSkill('big_attack')), minSlotOf(getSkill('smash'))]).toEqual([11, 11, 11]);
    expect(canPlaceAt(getSkill('jab'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('big_attack'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('smash'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('smash'), 18)).toBe(true);
    expect(canPlaceAt(getSkill('iron_shield'), 20)).toBe(false); // 防具はスロットに置けない
  });

  it('道具もレア度に関係なくどのスロットにも置ける', () => {
    expect(canPlaceAt(getSkill('herb'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('tonic'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('elixir'), 12)).toBe(true);
    expect(canPlaceAt(getSkill('elixir'), 19)).toBe(true);
  });

  it('初期装備は、すべて置ける状態になっている', () => {
    const run = createRun();
    for (const [key, id] of Object.entries(run.slots)) expect(canPlaceAt(getSkill(id!), Number(key)), `${key}:${id}`).toBe(true);
  });

  it('equipSkill: 固定スロット（11・21）以外のどのスロットにもレア・レジェンドを置ける', () => {
    const run = createRun();
    run.inventory.push('smash', 'big_attack', 'jab');
    expect(equipSkill(run, 11, 'smash')).toBe(false); // 固定スロットには置けない
    expect(equipSkill(run, 12, 'smash')).toBe(true);
    expect(equipSkill(run, 13, 'big_attack')).toBe(true);
    expect(equipSkill(run, 14, 'jab')).toBe(true);
  });

  it('入れ替え: 固定スロット以外のどのスロット間でもレア度に関係なく入れ替えられる', () => {
    const run = createRun();
    run.slots[19] = 'smash'; // レジェンド
    run.slots[13] = 'jab';   // コモン
    expect(swapSlots(run, 19, 13)).toBe(true);
    expect([run.slots[13], run.slots[19]]).toEqual(['smash', 'jab']);
    run.slots[16] = 'heavy'; // レア
    expect(swapSlots(run, 16, 13)).toBe(true);
    expect([run.slots[13], run.slots[16]]).toEqual(['heavy', 'smash']);
  });

  it('バージョンアップ: どのスロットでも強化できる', () => {
    const run = createRun();
    run.slots[13] = 'big_attack';
    expect(canUpgradeSlot(run, 13)).toBe(true);
    expect(upgradeSlot(run, 13)).toBe('big_attack_plus');
    run.slots[12] = 'smash';
    expect(upgradeSlot(run, 12)).toBe('smash_plus');
  });

  it('置ける場所の説明（レア度制限がないため常に空）', () => {
    expect(placementNote(getSkill('jab'))).toBe('');
    expect(placementNote(getSkill('big_attack'))).toBe('');
    expect(placementNote(getSkill('smash'))).toBe('');
    expect(placementNote(getSkill('iron_shield'))).toBe('');
  });
});

describe('祠の入れ替え（スロット・道具袋・防具の間で、何度でも）', () => {
  it('スロット ↔ スロット / 空きへの移動。レア度に関係なく移動でき、固定スロットは守る', () => {
    const run = createRun();
    run.slots[13] = 'jab';
    expect(swapSpots(run, { kind: 'slot', key: 13 }, { kind: 'slot', key: 14 })).toBe(true); // 空きへ移動
    expect(run.slots[13]).toBeUndefined();
    expect(run.slots[14]).toBe('jab');
    expect(swapSpots(run, { kind: 'slot', key: 14 }, { kind: 'slot', key: 15 })).toBe(true); // 薬草と入れ替え
    expect(run.slots[14]).toBe('herb');
    expect(run.slots[15]).toBe('jab');
    run.slots[16] = 'smash'; // レジェンドも自由に入れ替えられる
    expect(canSwapSpots(run, { kind: 'slot', key: 16 }, { kind: 'slot', key: 13 })).toBe(true);
    expect(swapSpots(run, { kind: 'slot', key: 16 }, { kind: 'slot', key: 13 })).toBe(true);
    expect(run.slots[13]).toBe('smash');
    expect(canSwapSpots(run, { kind: 'slot', key: 11 }, { kind: 'slot', key: 12 })).toBe(false); // 固定
    expect(canSwapSpots(run, { kind: 'slot', key: 12 }, { kind: 'slot', key: 14 })).toBe(true);
    expect(canSwapSpots(run, { kind: 'slot', key: 12 }, { kind: 'slot', key: 16 })).toBe(false); // どちらも空き
  });

  it('固定スロットと防具の制限は、入れ替えでも守る', () => {
    const run = createRun();
    run.slots[19] = 'smash';
    expect(placementViolations(run)).toEqual([]);
    expect(canSwapSpots(run, { kind: 'slot', key: 19 }, { kind: 'slot', key: 11 })).toBe(false);
    run.inventory = ['iron_shield'];
    expect(canSwapSpots(run, { kind: 'pouch' }, { kind: 'slot', key: 13 })).toBe(false);
  });

  it('スロット ↔ 道具袋（袋は 1 つ）。袋が空でも、スロットの中身を袋に移せる', () => {
    const run = createRun();
    run.slots[13] = 'jab';
    run.inventory = ['slash'];
    expect(swapSpots(run, { kind: 'pouch' }, { kind: 'slot', key: 13 })).toBe(true);
    expect(run.slots[13]).toBe('slash');
    expect(run.inventory).toEqual(['jab']);
    expect(swapSpots(run, { kind: 'slot', key: 13 }, { kind: 'pouch' })).toBe(true); // 何度でも
    expect(run.slots[13]).toBe('jab');
    run.inventory = [];
    expect(swapSpots(run, { kind: 'slot', key: 13 }, { kind: 'pouch' })).toBe(true); // 空の袋へ移す
    expect(run.slots[13]).toBeUndefined();
    expect(run.inventory).toEqual(['jab']);
  });

  it('防具は、防御スロットと道具袋の間だけ。防御スロットは空にできない。防具はスキルのスロットに置けない', () => {
    const run = createRun();
    run.inventory = ['steel_shield'];
    expect(canSwapSpots(run, { kind: 'pouch' }, { kind: 'slot', key: 14 })).toBe(false); // 防具はスロットへ置けない
    expect(swapSpots(run, { kind: 'armor' }, { kind: 'pouch' })).toBe(true);
    expect(run.armor).toBe('steel_shield');
    expect(run.inventory).toEqual(['iron_shield']);
    run.inventory = [];
    expect(canSwapSpots(run, { kind: 'armor' }, { kind: 'pouch' })).toBe(false); // 防御スロットを空にできない
    run.inventory = ['herb'];
    expect(canSwapSpots(run, { kind: 'armor' }, { kind: 'pouch' })).toBe(false); // 防具の場所に道具は置けない
  });
});

describe('合成の画面', () => {
  it('置く画面で、同じスキルのスロットは「合成」になり、確認では「合成後」と出す（上書きの注意は出さない）', async () => {
    const { readFileSync } = await import('node:fs');
    const screen = readFileSync('src/ui/LoadoutScreen.ts', 'utf8');
    expect(screen).toContain('const merge = !!armed && canMergeAt(run, key, armed);');
    expect(screen).toContain('content: buildSlotCompare(before, after, true),');
    expect(readFileSync('src/ui/components/Compare.ts', 'utf8')).toContain("side(merge ? '合成後' : 'セット後'");
    expect(readFileSync('src/main.ts', 'utf8')).toContain("hasMergeTarget(run, id) ? '・装備中と合成で＋' : ''");
  });
});

describe('ごほうびのスキルを置く画面', () => {
  it('「売る」を出さない（道具袋から出したとき・ショップで買ったときは、これまでどおり）', async () => {
    const { readFileSync } = await import('node:fs');
    const screen = readFileSync('src/ui/LoadoutScreen.ts', 'utf8');
    expect(screen).not.toContain("} else {\n        actions.append(mk('btn--retry', '売る'");
    expect(screen).toContain("actions.append(mk('btn--stand', 'やめる', '袋にもどす'"); // 道具袋から出したとき
    expect(screen).toContain("'買うのをやめる'"); // ショップで買ったとき
  });
  it('すでに＋のスロットには、同じスキルは置けない', async () => {
    const { readFileSync } = await import('node:fs');
    const screen = readFileSync('src/ui/LoadoutScreen.ts', 'utf8');
    expect(screen).toContain('const plusHere = !!armed && !!id && id === getSkill(armed).upgradesTo && isPlusSkill(id);');
    expect(screen).toContain('if (plusHere) return;');
    expect(screen).toContain("tag: plusHere ? '＋なので置けない' : undefined,");
  });
});
