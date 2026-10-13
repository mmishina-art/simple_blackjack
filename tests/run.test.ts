import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { ARMOR_POOL, ITEM_POOL, SKILL_POOL } from '../src/core/skills/catalog';
import { getSkill, hasSkill, rarityOfSkill, SLOT_KEYS } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { INN_HEAL_RATIO, resolveShrine, useInn } from '../src/map/events';
import { STAGE_ROWS, STAGES } from '../src/map/stages';
import { rarityWeights } from '../src/core/rarity';
import { nextTiles, tileOf, type TileKind } from '../src/map/StageMap';
import {
  Boots, Breastplate, FateRing, LifeCandle, OverlordOrb, RELIC_POOL, ScapegoatDoll, SealKey, SturdyShield,
  VampireFang, Whetstone,
} from '../src/relics/catalog';
import {
  createRun, enemyOfTile, equipSkill, isCleared, isSlotLocked, markCleared, moveTo, offerRelics, offerSkills, reachableTiles,
  advanceStage, canUpgradeSlot, isFinalStage, STAGE_CLEAR_HEAL, STAGE_CLEAR_MAX_HP, swapSlots, upgradeSlot,
} from '../src/run/Run';
import { ENEMY_SPRITES } from '../src/ui/components/enemySprites';
import { noWait, playRound } from './helpers';

describe('敵', () => {
  it('全員にスプライトがあり、スロットのスキルが全て実在する', () => {
    expect(new Set(ENEMY_LINEUP.map((e) => e.id)).size).toBe(ENEMY_LINEUP.length);
    expect(ENEMY_LINEUP).toHaveLength(13); // 第1階層 5 / 第2階層 4 / 第3階層 4
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
  it('3つの階層があり、ボスは 墓守の騎士 → 深淵の海蛇 → 黒竜。段数は同じ', () => {
    expect(STAGES).toHaveLength(3);
    expect(STAGES.map((m) => Object.values(m.tiles).find((t) => t.kind === 'boss')!.enemyId)).toEqual(['knight', 'serpent', 'dragon']);
    for (const m of STAGES) expect(Math.max(...Object.values(m.tiles).map((t) => t.row)) + 1).toBe(STAGE_ROWS);
  });

  it('階層ごとの敵: 第1階層は 5 種、第2階層は魚人・ガーゴイル・亡霊・海蛇、第3階層は精霊・ゴーレム・悪魔・黒竜', () => {
    const ids = (m: (typeof STAGES)[number]) => new Set(Object.values(m.tiles).flatMap((t) => (t.enemyId ? [t.enemyId] : [])));
    expect(ids(STAGES[0])).toEqual(new Set(['slime', 'skeleton', 'bat', 'ghoul', 'knight']));
    expect(ids(STAGES[1])).toEqual(new Set(['merman', 'gargoyle', 'wraith', 'serpent']));
    expect(ids(STAGES[2])).toEqual(new Set(['flame', 'golem', 'imp', 'dragon']));
  });

  it('次の階層へ: 最大 HP が +10、HP が最大の半分（+10 の分も）回復し、位置・済みのマスが新しい階層になる。最後の階層では進めない', () => {
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
    expect(run.hp).toBe(5 + STAGE_CLEAR_MAX_HP + Math.ceil(run.maxHp * STAGE_CLEAR_HEAL));
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
    expect(run.stats.maxRow).toBe(STAGE_ROWS + 1);
  });

  it('階層が進むほど、レアが出やすい', () => {
    expect(rarityWeights(1)).toEqual({ common: 6, rare: 3, legend: 1 });
    expect(rarityWeights(2).legend).toBeGreaterThan(rarityWeights(1).legend);
    expect(rarityWeights(3).legend).toBeGreaterThan(rarityWeights(2).legend);
    expect(rarityWeights(3).common).toBeLessThan(rarityWeights(1).common);
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

  it('封印の鍵を持つと、スロット21だけ付け替えられ（11以下は固定のまま）、会心の一撃は持ち物に残る', () => {
    const run = createRun();
    expect(isSlotLocked(run, 11)).toBe(true);
    run.relics.push(SealKey);
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

  it('バージョンアップ: コモン→レア、レア→レジェンド。道具・固定スキルは不可', () => {
    const run = createRun();
    expect(canUpgradeSlot(run, 15)).toBe(true); // シールド(コモン)
    expect(upgradeSlot(run, 15)).toBe('bulwark');
    expect(rarityOfSkill(getSkill('bulwark'))).toBe('rare');
    expect(upgradeSlot(run, 15)).toBe('fortress');
    expect(rarityOfSkill(getSkill('fortress'))).toBe('legend');
    expect(upgradeSlot(run, 15)).toBeNull(); // レジェンドはこれ以上不可
    expect(canUpgradeSlot(run, 12)).toBe(false); // 薬草（道具）
    expect(canUpgradeSlot(run, 11)).toBe(false); // 固定
    expect(canUpgradeSlot(run, 21)).toBe(false);
    expect(run.slots[12]).toBe('herb');
  });

  it('強化先は必ず1つ上のレア度で、道具には強化先がない', () => {
    const order = ['common', 'rare', 'legend'];
    for (const id of SKILL_POOL) {
      const to = getSkill(id).upgradesTo;
      if (to) expect(order.indexOf(rarityOfSkill(getSkill(to)))).toBe(order.indexOf(rarityOfSkill(getSkill(id))) + 1);
      else expect(rarityOfSkill(getSkill(id))).toBe('legend');
    }
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
    // 報酬は、スキルと道具に分け、道具を必ず1つ含む（並びは、スキル → 道具）
    const skills = offerSkills(seededRng(1));
    expect(skills).toHaveLength(3);
    expect(new Set(skills).size).toBe(3);
    skills.slice(0, 2).forEach((id) => expect(SKILL_POOL).toContain(id));
    expect([...ITEM_POOL, ...ARMOR_POOL]).toContain(skills[2]);
    for (let seed = 1; seed <= 30; seed++) {
      const o = offerSkills(seededRng(seed));
      expect(o.filter((id) => [...ITEM_POOL, ...ARMOR_POOL].includes(id))).toHaveLength(1);
      expect(o.filter((id) => SKILL_POOL.includes(id))).toHaveLength(2);
    }
    const run = createRun();
    expect(offerRelics(run, seededRng(1))).toHaveLength(3);
    run.relics.push(Whetstone);
    expect(offerRelics(run, seededRng(1)).some((r) => r.id === 'whetstone')).toBe(false);
    expect(RELIC_POOL).toHaveLength(21);
  });
});

describe('レリックの効果', () => {
  it('砥石: 基本攻撃力 +1（20 の大攻撃 ATK+5 が 15 → 16）', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Whetstone] });
    expect(m.ctx.enemy.hp).toBe(40 - 16);
  });

  it('胸当て: 受ける攻撃ダメージ -1', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, relics: [Breastplate] });
    expect(m.ctx.player.hp).toBe(60 - 3); // 溶解 4 - 1
  });

  it('吸血の牙: 敵のHPを削るたびHP+1', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40, playerHp: 50, relics: [VampireFang] });
    expect(m.ctx.player.hp).toBe(50 + 1 - 4);
  });

  it('身代わりの人形: 最初のバーストでは敵も行動しない', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], relics: [ScapegoatDoll] });
    expect(m.ctx.player.hp).toBe(60);
  });

  it('運命の指輪: 同時攻撃になったラウンド、与える攻撃ダメージ +8', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 40, relics: [FateRing] });
    expect(m.ctx.enemy.hp).toBe(40 - 23); // 大攻撃15 + 8
  });

  it('疾風の靴: 同値でも先攻になる', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 10, relics: [Boots] });
    expect(m.ctx.turn?.mode).toBe('sequential');
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(60);
  });

  it('堅牢の盾: 獲得する Block +3', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['6', '8'], relics: [SturdyShield], stopAt: ['CheckDeath'] });
    expect(m.ctx.player.block).toBe(6 + 3 - 3); // 盾 6 + 3、敵の酸 3
  });

  it('命の蝋燭: 戦闘開始時にHP+3', () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerHp: 30, relics: [LifeCandle], pace: noWait });
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.player.hp).toBe(33);
  });

  it('覇王の宝珠: 会心の一撃（ATK×1.5）が覇王の一撃（ATK×2 + Block 8）に変わる', async () => {
    const m = await playRound({ player: ['7', '7', '7'], enemyHand: ['3', '4'], enemyHp: 100, relics: [OverlordOrb], stopAt: ['CheckDeath'] });
    expect(m.ctx.enemy.hp).toBe(100 - 22); // 21 は ATK 11: ATK×2（宝珠なしなら ×1.5 = 16）
    expect(m.ctx.player.block).toBe(8 - 3); // 敵の基本攻撃3は Block で吸収
  });
});

describe('レリックで変わるスキル効果', () => {
  it('剛力の腕輪: 大攻撃が ATK×2+5 になる', async () => {
    const { Bracer } = await import('../src/relics/catalog');
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, relics: [Bracer] });
    expect(60 - m.ctx.enemy.hp).toBe(25); // 20 は ATK 10: ATK×2+5
  });

  it('巨人の血: 小攻撃（11以下）が ATK×0.5 から ATK×2+10 になる', async () => {
    const { TitanBlood } = await import('../src/relics/catalog');
    const base = await playRound({ player: ['3', '4'], enemyHand: ['9', '9'], enemyHp: 60 });
    const buffed = await playRound({ player: ['3', '4'], enemyHand: ['9', '9'], enemyHp: 60, relics: [TitanBlood] });
    expect(60 - base.ctx.enemy.hp).toBe(1);   // 後攻の小攻撃 = ATK(1)×0.5（最低 1）
    expect(60 - buffed.ctx.enemy.hp).toBe(12); // ATK(1)×2+10
  });
});

describe('敵の特性', () => {
  const enemy = (id: string) => ENEMY_LINEUP.find((e) => e.id === id)!;

  it('骸骨兵: 骨の鎧（受けるダメージ -2）', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemy: enemy('skeleton') });
    expect(m.ctx.enemy.hp).toBe(22 - 13); // 大攻撃15 - 骨の鎧2
  });

  it('大蝙蝠: 同値なら必ず敵が先攻', async () => {
    const m = await playRound({ player: ['K', 'Q'], enemyHand: ['K', 'K'], enemy: enemy('bat') });
    expect(m.ctx.turn).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });

  it('屍食鬼: HPを削るたびHP+2', async () => {
    const m = await playRound({ player: ['9', '8'], enemyHand: ['K', 'K'], enemy: enemy('ghoul'), enemyHp: 15 });
    expect(m.ctx.player.hp).toBe(60 - 8); // 貪り喰う ATK4×2 = 8（17 は未設定で Block なし）
    expect(m.ctx.enemy.hp).toBe(15 + 2 - 7); // HP を削って +2 回復、そのあと後攻の通常攻撃（17 は ATK 7）
  });

  it('黒竜: 攻撃ダメージ +3', async () => {
    const m = await playRound({ player: ['9', '9'], enemyHand: ['K', 'K'], enemy: enemy('dragon') });
    expect(m.ctx.player.hp).toBe(60 - (18 - 11)); // 業火 ATK6×2+3 + 息吹3 = 18。後攻の盾 Block 11 が先に付与される
  });
});
