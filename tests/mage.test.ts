import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard } from '../src/core/cards/Card';
import { ENEMY_LINEUP, getEnemy } from '../src/core/entities/enemies/catalog';
import {
  ARCH_MAGIC_ID, armorPoolFor, DEFAULT_MAGE_ARMOR_ID, DEFAULT_MAGE_SLOTS, ITEM_POOL,
  MAGE_ARMOR_POOL, MAGE_SKILL_POOL, skillPoolFor, slotAttack,
} from '../src/core/skills/catalog';
import { previewSkill } from '../src/core/skills/preview';
import { describeSkill, getSkill, rarityOfSkill } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { emptyMeta, finishRun, isMageUnlocked, isSkillDiscovered } from '../src/meta/Meta';
import { ElementRing, MAGE_RELIC_POOL, ManaCrystal, MirrorBrooch, relicPoolFor, SageStone } from '../src/relics/catalog';
import { dropsOf, MAGE_ENEMY_DROPS } from '../src/run/drops';
import { armorCap, armorReflect, createRun, offerRelics, offerSkills, shrineUpgradeChoices, upgradeSlot } from '../src/run/Run';
import { generateShop, upgradeCost } from '../src/run/shop';
import { noWait, playRound } from './helpers';

describe('キャラクター解放と選択（戦士 / 魔導士 / 3人目 🔒）', () => {
  it('初期状態では魔導士は未解放。1回以上クリアすると解放される', () => {
    const meta = emptyMeta();
    expect(isMageUnlocked(meta)).toBe(false);
    finishRun(meta, { maxRow: 5, enemiesDefeated: 3, cleared: false });
    expect(isMageUnlocked(meta)).toBe(false);
    finishRun(meta, { maxRow: 24, enemiesDefeated: 18, cleared: true, stagesCleared: 2 });
    expect(isMageUnlocked(meta)).toBe(true);
    for (const id of ['ice_needle', 'spark', 'fire_magic', 'arch_magic']) {
      expect(isSkillDiscovered(meta, id), id).toBe(true);
    }
  });

  it('タイトル画面から開始時、クリア済みなら戦士・魔導士・鍵つき3人目（🔒 未解放）の選択シートが出る', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toContain("title: 'キャラクター選択'");
    expect(main).toContain("name: '戦士'");
    expect(main).toContain("name: '魔導士'");
    expect(main).toContain("badge: '🔒 未解放'");
    expect(main).toContain("name: '？？？'");
    expect(main).toContain('新たなキャラクター「魔導士」が解放された！');
  });

  it('魔導士で冒険を始めると、専用の初期スロット・魔導のローブ（反射つき）・大魔導を装備している', () => {
    const run = createRun(undefined, emptyMeta(), 'mage');
    expect(run.character).toBe('mage');
    expect(run.armor).toBe(DEFAULT_MAGE_ARMOR_ID);
    expect(armorCap(run)).toBe(5);
    expect(armorReflect(run)).toBe(1);
    expect(run.slots).toEqual(DEFAULT_MAGE_SLOTS);
    expect(run.slots[21]).toBe(ARCH_MAGIC_ID);
    // 祠のバージョンアップで大魔導 → 星霊魔導 → 創世魔導に育つ
    expect(shrineUpgradeChoices(run)).toEqual([21]);
    expect(upgradeCost('arch_magic')).toBe(40);
    expect(upgradeSlot(run, 21)).toBe('astral_magic');
    expect(upgradeCost('astral_magic')).toBe(80);
    expect(upgradeSlot(run, 21)).toBe('genesis_magic');
    expect(shrineUpgradeChoices(run)).toEqual([]);
  });
});

describe('手札のマークによる属性決定（♥炎・♠氷・♣雷・♦無属性）と敵の弱点（三すくみ・ダメージ 2 倍）', () => {
  it('すべての敵に3属性が割り当てられ、三すくみ（🔥炎 ＞ ❄️氷 ＞ ⚡雷 ＞ 🔥炎）に従う', () => {
    const expectedWeakness = { ice: 'fire', lightning: 'ice', fire: 'lightning' } as const;
    for (const e of ENEMY_LINEUP) {
      expect(e.attackElement, `${e.id} attackElement`).toMatch(/^(fire|ice|lightning)$/);
      expect(e.weakness, `${e.id} weakness`).toBe(expectedWeakness[e.attackElement!]);
    }
  });

  it('魔導士の攻撃は最後のカードのマークで属性が決まり、敵の弱点ならダメージ 2 倍（previewSkill にも反映）', async () => {
    const slime = getEnemy('slime');
    expect(slime.attackElement).toBe('ice');
    expect(slime.weakness).toBe('fire');

    // 1. 最後の札が ♥（炎）: スライム（弱点: 炎）に対し、スロット 20（POW 10）の大魔法（POW+5 = 15）→ 弱点 2 倍で 30 ダメージ
    const mFire = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: 'K', suit: 'H' }], enemyHand: ['9', '8'], enemy: slime, enemyHp: 50,
      playerSlots: { 20: 'grand_magic' },
    });
    expect(50 - mFire.ctx.enemy.hp).toBe(15 * 2);
    expect(mFire.logs.some((l) => l.includes('弱点 ×2'))).toBe(true);

    // previewSkill でも弱点 2 倍と weak フラグが返る
    const preview = previewSkill(mFire.ctx, mFire.ctx.player, mFire.ctx.enemy, 20);
    expect(preview.parts[0]).toMatchObject({ type: 'attack', value: 30, weak: true });

    // 2. 最後の札が ♠（氷）: 氷属性になるため等倍（15 ダメージ）
    const mIce = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: 'K', suit: 'S' }], enemyHand: ['9', '8'], enemy: slime, enemyHp: 50,
      playerSlots: { 20: 'grand_magic' },
    });
    expect(50 - mIce.ctx.enemy.hp).toBe(15);

    // 3. 最後の札が ♦（無属性）: 弱点を突かず等倍（15 ダメージ）
    const mDia = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: 'K', suit: 'D' }], enemyHand: ['9', '8'], enemy: slime, enemyHp: 50,
      playerSlots: { 20: 'grand_magic' },
    });
    expect(50 - mDia.ctx.enemy.hp).toBe(15);
  });

  it('三すくみ通り、雷属性の敵（ガーゴイル）には♠氷、炎属性の敵（黒竜）には♣雷で 2 倍ダメージが入る', async () => {
    const garg = getEnemy('gargoyle');
    expect(garg.attackElement).toBe('lightning');
    expect(garg.weakness).toBe('ice');
    // 最後の札が ♠（氷）。20（POW 10）で魔槍（POW+3 = 13・貫通）→ 石の肌 -3 で 10 → 弱点 ×2 = 20
    const m2 = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: 'K', suit: 'S' }], enemyHand: ['K', '9'], enemy: garg, enemyHp: 50,
      playerSlots: { 20: 'magic_lance' },
    });
    expect(50 - m2.ctx.enemy.hp).toBe(10 * 2);

    const dragon = getEnemy('dragon');
    expect(dragon.attackElement).toBe('fire');
    expect(dragon.weakness).toBe('lightning');
    // 最後の札が ♣（雷）。18（POW 8）で魔弾（POW+1 = 9）→ 弱点 ×2 = 18
    const m3 = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: '8', suit: 'C' }], enemyHand: ['K', '8'], enemy: dragon, enemyHp: 90,
      playerSlots: { 18: 'magic_bullet' },
    });
    expect(90 - m3.ctx.enemy.hp).toBe(9 * 2);
  });

  it('共鳴弾: 手札がすべて同じマークなら 2 倍、さらに弱点なら 4 倍ダメージになる', async () => {
    const slime = getEnemy('slime');
    // 手札が両方 ♥（炎）。18（POW 8）で共鳴弾（POW+2 = 10）→ 共鳴 2 倍（20）→ スライムの弱点（炎）でさらに 2 倍 = 40 ダメージ！
    const mRes = await playRound({
      playerCharacter: 'mage',
      player: [{ rank: '9', suit: 'H' }, { rank: '9', suit: 'H' }], enemyHand: ['8', '8'], enemy: slime, enemyHp: 50,
      playerSlots: { 18: 'resonance_bullet' },
    });
    expect(50 - mRes.ctx.enemy.hp).toBe(10 * 2 * 2);
    expect(mRes.logs.some((l) => l.includes('共鳴 ×2'))).toBe(true);
    expect(mRes.logs.some((l) => l.includes('弱点 ×2'))).toBe(true);

    // マークが揃っていない（♥ と ♠）場合は共鳴しない（スロット 18: 10 ダメージ、最後の札 ♠ は弱点でないので等倍のまま）
    const mDiff = await playRound({
      playerCharacter: 'mage',
      player: [{ rank: '9', suit: 'H' }, { rank: '9', suit: 'S' }], enemyHand: ['8', '8'], enemy: slime, enemyHp: 50,
      playerSlots: { 18: 'resonance_bullet' },
    });
    expect(50 - mDiff.ctx.enemy.hp).toBe(10);
  });
});

describe('属性の障壁と敵攻撃の吸収（ダメージ 0 ＋ HP 回復）', () => {
  it('属性の障壁は最後のカードのマークの属性を吸収し、一致すれば敵攻撃を吸収して HP 回復する', async () => {
    const flame = getEnemy('flame');
    expect(flame.attackElement).toBe('fire');

    // 1. 最後の札が ♥（炎）のとき「属性の障壁」を使うと、炎の精霊の攻撃（16）を吸収して HP +8 回復！
    const mBarrierFire = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: '7', suit: 'H' }], enemyHand: ['K', 'K'], enemy: flame,
      playerMaxHp: 60, playerHp: 30,
      playerSlots: { 17: 'elemental_barrier' },
    });
    expect(mBarrierFire.ctx.player.hp).toBe(30 + 8);
    expect(mBarrierFire.ctx.player.block).toBe(7 + 2); // 吸収したのでブロックも減らずに残る
    expect(mBarrierFire.logs.some((l) => l.includes('炎属性を吸収し、HP を 8 回復した'))).toBe(true);

    // 2. 最後の札が ♠（氷）のときは氷属性吸収になるため、炎攻撃は吸収されず通常のブロック（POW 7 + 2 = 9）で軽減
    const mBarrierIce = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: '7', suit: 'S' }], enemyHand: ['K', 'K'], enemy: flame,
      playerMaxHp: 60, playerHp: 30,
      playerSlots: { 17: 'elemental_barrier' },
    });
    expect(mBarrierIce.ctx.player.hp).toBe(30 - (16 - 9));
    expect(mBarrierIce.ctx.player.block).toBe(0);

    // 3. 最後の札が ♦（無属性）のときは何も吸収しないが、通常のブロックとして機能する
    const mBarrierDia = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: '7', suit: 'D' }], enemyHand: ['K', 'K'], enemy: flame,
      playerMaxHp: 60, playerHp: 30,
      playerSlots: { 17: 'elemental_barrier' },
    });
    expect(mBarrierDia.ctx.player.hp).toBe(30 - (16 - 9));
  });

  it('全属性吸収スキル（元素吸収・星喰らい・大魔導）は、どの属性の敵攻撃も吸収して回復する', async () => {
    // ガーゴイルは attackElement: 'lightning'。プレイヤーが 17 で元素吸収（element_drain: absorbAll）を使う
    const garg = getEnemy('gargoyle');
    expect(garg.attackElement).toBe('lightning');
    const m = await playRound({
      player: ['K', '7'], enemyHand: ['K', 'K'], enemy: garg,
      playerMaxHp: 60, playerHp: 20,
      playerSlots: { 17: 'element_drain' },
    });
    // ガーゴイル 20（岩砕き POW4×3+2 = 14）を吸収して +7、さらに自分の元素吸収の回復（POW7×0.5+2 = 5）で合計 +12
    expect(m.ctx.player.hp).toBe(20 + 7 + 5);
  });
});

describe('防御と反射魔法による攻撃の反射', () => {
  it('魔導士が防御（Surrender）すると、被ダメージ上限を超えた軽減分だけを100%（星霊のローブは150%）敵に反射する', async () => {
    // 墓守の騎士 20（断罪の一閃: 12 ダメージ）。魔導のローブ（上限 5・反射 1.0）で防御すると、プレイヤーの被ダメは 5、軽減した 7 ダメージを騎士に反射！
    const knight = getEnemy('knight');
    const m = new BattleMachine({
      enemy: knight,
      playerCharacter: 'mage',
      playerMaxHp: 60,
      playerHp: 30,
      playerArmorCap: 5,
      playerArmorReflect: 1,
      pace: noWait,
    });
    m.ctx.enemy.hand.add({ rank: 'K', suit: 'S', value: 10 });
    m.ctx.enemy.hand.add({ rank: 'K', suit: 'H', value: 10 });
    m.ctx.player.hand.add({ rank: '9', suit: 'S', value: 9 });
    m.ctx.player.hand.add({ rank: '6', suit: 'S', value: 6 });
    await m.runFrom('Surrender', ['Deal']);
    expect(m.ctx.player.hp).toBe(30 - 5);
    expect(m.ctx.enemy.hp).toBe(knight.maxHp - 7);
    expect(m.logs.some((l) => l.includes('反射！'))).toBe(true);
  });

  it('敵の 21（攻撃 2 倍）を防御しても、跳ね返すのは 2 倍する前の分だけ（予告のとき、防御が必ず得にはならない）', async () => {
    // 墓守の騎士 21（審判の剣: 7 → 2 倍で 14）。魔導のローブ（上限 5）で防御すると、被ダメは 5、反射は 2 倍する前の 7 から上限 5 を引いた 2
    const knight = getEnemy('knight');
    const m = new BattleMachine({ enemy: knight, playerCharacter: 'mage', playerMaxHp: 60, playerHp: 30, playerArmorCap: 5, playerArmorReflect: 1, pace: noWait });
    m.ctx.enemy.hand.add(makeCard('K', 'S'));
    m.ctx.enemy.hand.add(makeCard('A', 'S'));
    m.ctx.player.hand.add(makeCard('9', 'S'));
    m.ctx.player.hand.add(makeCard('6', 'S'));
    await m.runFrom('Surrender', ['Deal']);
    expect(m.ctx.player.hp).toBe(30 - 5);
    expect(m.ctx.enemy.hp).toBe(knight.maxHp - 2);
  });

  it('反射スキル（反鏡の陣・神鏡の結界）は、ブロック獲得＋敵の攻撃力そのものを100%〜150%跳ね返す', async () => {
    // 騎士 20（12 ダメージ）に対し、17（POW 7）で反鏡の陣（ブロック POW+4 = 11、反射 100%）を発動
    // ブロック 11 + HP 減少 1 = 12 ダメージを受け、その 100%（12 ダメージ）を騎士に反射する！
    const knight = getEnemy('knight');
    const m = await playRound({
      player: ['K', '7'], enemyHand: ['K', 'K'], enemy: knight,
      playerHp: 40, enemyHp: 30,
      playerSlots: { 17: 'mirror_coat' },
    });
    expect(m.ctx.player.hp).toBe(40 - 1);
    expect(m.ctx.enemy.hp).toBe(30 - 12);
  });
});

describe('魔導士の専用スキル・防具・レリック・報酬プール', () => {
  it('魔導士のスキルはすべて「＋」に強化でき、道具は戦士と共通、防具は専用ローブ 3 種', () => {
    expect(skillPoolFor('mage')).toBe(MAGE_SKILL_POOL);
    expect(armorPoolFor('mage')).toBe(MAGE_ARMOR_POOL);
    expect(MAGE_ARMOR_POOL).toEqual(['magic_robe', 'mirror_robe', 'astral_robe']);
    for (const id of MAGE_SKILL_POOL) {
      const sk = getSkill(id);
      expect(sk.upgradesTo, id).toBe(`${id}_plus`);
      const plus = getSkill(sk.upgradesTo!);
      expect(rarityOfSkill(plus)).toBe(rarityOfSkill(sk));
      expect(describeSkill(sk).length).toBeGreaterThan(0);
    }
    for (const [id, drops] of Object.entries(MAGE_ENEMY_DROPS)) {
      expect(drops.length, id).toBeGreaterThanOrEqual(4);
      for (const s of drops) expect(MAGE_SKILL_POOL, `${id}: ${s}`).toContain(s);
    }
  });

  it('魔導士で冒険中は、報酬に魔導士スキル、ショップに魔導士のローブと共通道具・魔導士レリックが並ぶ', () => {
    const run = createRun(undefined, emptyMeta(), 'mage');
    run.stage = 2;
    const offered = offerSkills(seededRng(7), run, 'skeleton');
    expect(offered.every((id) => MAGE_SKILL_POOL.includes(id))).toBe(true);
    expect(offered.some((id) => dropsOf('skeleton', 'mage').includes(id))).toBe(true);

    const shop = generateShop(run, seededRng(3));
    const shopSkillIds = shop.filter((o) => o.type === 'skill').map((o) => o.id);
    expect(shopSkillIds.every((id) => ITEM_POOL.includes(id) || MAGE_ARMOR_POOL.includes(id))).toBe(true);
    expect(shopSkillIds.some((id) => MAGE_ARMOR_POOL.includes(id))).toBe(true);

    expect(relicPoolFor('mage')).toEqual(expect.arrayContaining([...MAGE_RELIC_POOL]));
    const relics = offerRelics(run, seededRng(1));
    expect(relics).toHaveLength(3);
  });

  it('魔導士の追加レリック 4 種（魔導の水晶・元素の指輪・鏡面のブローチ・賢者の秘石）が正しく機能する', async () => {
    // 1. 魔導の水晶（属性魔法ダメージ +2）+ 元素の指輪（弱点 2.5 倍）
    // スライム（炎弱点）に 17（POW 7）の魔弾（POW+1 = 8、最後の札 ♥ で炎属性）→ 水晶で 8+2=10 → 指輪の弱点 2.5 倍で floor(10×2.5) = 25 ダメージ！
    const slime = getEnemy('slime');
    const m1 = await playRound({
      playerCharacter: 'mage',
      player: ['K', { rank: '7', suit: 'H' }], enemyHand: ['9', '7'], enemy: slime, enemyHp: 40,
      playerSlots: { 17: 'magic_bullet' },
      relics: [ManaCrystal, ElementRing],
    });
    expect(40 - m1.ctx.enemy.hp).toBe(Math.floor((slotAttack(5, 17) + 1 + 2) * 2.5));

    // 2. 鏡面のブローチ（反射ダメージ 1.5 倍）
    // 騎士 20（12 ダメージ）に 17 で反鏡の陣（12 ダメージ反射）→ ブローチで 12 × 1.5 = 18 ダメージ反射！
    const knight = getEnemy('knight');
    const m2 = await playRound({
      player: ['K', '7'], enemyHand: ['K', 'K'], enemy: knight, enemyHp: 30,
      playerSlots: { 17: 'mirror_coat' },
      relics: [MirrorBrooch],
    });
    expect(m2.ctx.enemy.hp).toBe(30 - 18);

    // 3. 賢者の秘石（常時全属性吸収）: 通常攻撃（属性なし）で止まっても敵の属性攻撃を吸収して回復する
    const flame = getEnemy('flame');
    const m3 = await playRound({
      player: ['K', '7'], enemyHand: ['K', 'K'], enemy: flame,
      playerMaxHp: 60, playerHp: 30,
      relics: [SageStone],
    });
    expect(m3.ctx.player.hp).toBe(30 + 8);
  });

  it('旧スキルのID互換性: 旧スキルIDを指定しても新スキルとして解決され動作する', () => {
    expect(getSkill('fire_bolt').id).toBe('magic_bullet');
    expect(getSkill('frost_shield').id).toBe('elemental_barrier');
    expect(getSkill('fire_magic').id).toBe('grand_magic');
    expect(getSkill('thunder_lance').id).toBe('magic_lance');
    expect(getSkill('twin_thunder').id).toBe('rapid_bullets');
    expect(getSkill('meteor').id).toBe('cataclysm');
    expect(getSkill('judgement_bolt').id).toBe('tri_star');
  });
});

