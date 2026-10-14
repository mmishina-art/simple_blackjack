import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { ALL_POOL, ARMOR_POOL, ITEM_POOL, SKILL_POOL, slotAttack } from '../src/core/skills/catalog';
import { attackValue, describeSkill, getSkill, hasAttack, rarityOfSkill, supportValue, type SkillDef } from '../src/core/skills/Skill';
import { CODEX_ARMOR_TOTAL, CODEX_ITEM_TOTAL, CODEX_RELIC_TOTAL, CODEX_SKILL_TOTAL, computeShards, SHARD_CLEAR_BONUS, SHARD_STAGE_BONUS } from '../src/meta/Meta';
import { DEFAULT_PLAYER_SLOTS } from '../src/core/skills/catalog';
import { ArtisanTools, CounterStance, DefenderCharm, FullRing, LuckyDice, NoBustPenalty, RELIC_POOL, ThornMail, TriumphCup, Unyielding } from '../src/relics/catalog';
import { noWait, playRound } from './helpers';

const enemy = (id: string) => ENEMY_LINEUP.find((e) => e.id === id)!;

describe('第2・第3階層のスキル', () => {
  it('強化は「＋」: レア度は同じで、名前に＋が付き、効果が上がる。＋は、それ以上は強化できない', () => {
    for (const id of ['lunge', 'pierce_stab', 'impale', 'chop', 'berserk', 'rampage', 'mend', 'holy_light', 'miracle', 'twin_strike', 'flurry']) {
      const base = getSkill(id);
      expect(SKILL_POOL, id).toContain(id);
      const plus = getSkill(base.upgradesTo!);
      expect(plus.id).toBe(`${id}_plus`);
      expect(plus.name).toBe(`${base.name}＋`);
      expect(rarityOfSkill(plus), id).toBe(rarityOfSkill(base));
      expect(plus.upgradesTo, id).toBeUndefined();
      expect(SKILL_POOL, id).not.toContain(plus.id); // 報酬には出ない
    }
  });

  it('＋の上乗せ: コモン +3・レア +5・レジェンド +7（複数の効果は、効果ごとに半分（切り上げ））', () => {
    expect(getSkill('jab_plus').effects).toEqual([{ type: 'attack', mult: 1, add: 4 }]); // コモン: 1 + 3
    expect(getSkill('guard_plus').effects).toEqual([{ type: 'block', mult: 1, amount: 4 }]); // コモン: 1 + 3
    expect(getSkill('big_attack_plus').effects).toEqual([{ type: 'attack', mult: 1, add: 10 }]); // レア: 5 + 5
    expect(getSkill('smash_plus').effects).toEqual([{ type: 'attack', mult: 2, add: 12 }]); // レジェンド: 5 + 7
    expect(getSkill('drain_plus').effects).toEqual([{ type: 'attack', mult: 1, add: 4 }, { type: 'heal', mult: 0.5, amount: 5 }]); // レア: 2 つの効果に +3 ずつ
    expect(getSkill('pierce_stab_plus').effects).toEqual([{ type: 'attack', mult: 1, add: 8, pierce: true }]); // ブロック無視は残る
  });

  it('レア度が高いほど強い（スロット 17、POW 7 での、攻撃・回復の合計）', () => {
    const power = (sk: SkillDef): number => sk.effects.reduce((sum, e) => sum + (e.type === 'attack' ? attackValue(e, slotAttack(5, 17)) : e.type === 'heal' ? supportValue(e, slotAttack(5, 17)) : 0), 0);
    expect(power(getSkill('pierce_stab'))).toBeGreaterThan(power(getSkill('lunge')));
    expect(power(getSkill('impale'))).toBeGreaterThan(power(getSkill('pierce_stab')));
    expect(power(getSkill('berserk'))).toBeGreaterThan(power(getSkill('chop')));
    expect(power(getSkill('rampage'))).toBeGreaterThan(power(getSkill('berserk')));
    expect(power(getSkill('holy_light'))).toBeGreaterThan(power(getSkill('mend')));
    expect(power(getSkill('miracle'))).toBeGreaterThan(power(getSkill('holy_light')));
    expect(power(getSkill('flurry'))).toBeGreaterThan(power(getSkill('twin_strike')));
  });

  it('多段攻撃: 二連斬は 2 回、乱舞は 3 回、別々にブロック へ吸われる', async () => {
    expect(getSkill('twin_strike').effects.filter((e) => e.type === 'attack')).toHaveLength(2);
    expect(getSkill('flurry').effects.filter((e) => e.type === 'attack')).toHaveLength(3);
    // 17（POW 7）: 二連斬 = floor(7×0.8)+1 = 6 を 2 回
    const m = await playRound({ player: ['K', '7'], enemyHand: ['K', 'K', '5'], playerSlots: { 17: 'twin_strike' }, enemyHp: 40 });
    expect(40 - m.ctx.enemy.hp).toBe(6 * 2 * 1.5); // 敵がバーストしているので、1 回ごとに ×1.5（6 → 9）
  });

  it('破甲の突き・串刺しはブロックを無視して破壊する', () => {
    for (const id of ['pierce_stab', 'impale']) expect(getSkill(id).effects.some((e) => e.type === 'attack' && e.pierce), id).toBe(true);
    expect(describeSkill(getSkill('impale'))).toContain('ブロック無視');
  });

  it('癒しの術・聖光・奇跡は POW に応じて回復する', () => {
    expect(supportValue(getSkill('mend').effects[0] as never, slotAttack(5, 17))).toBe(7 + 3);
    expect(supportValue(getSkill('miracle').effects[0] as never, slotAttack(5, 17))).toBe(7 + 10);
    expect(hasAttack(getSkill('mend'))).toBe(false);
  });
});

describe('第2・第3階層の道具・防具', () => {
  it('道具: 霊薬は回復 22、大爆弾は 16 ダメージ、守りの巻物・聖なる護符はブロック（固定）', () => {
    expect(ITEM_POOL).toEqual(['herb', 'tonic', 'elixir', 'bomb', 'big_bomb', 'ward', 'holy_ward']);
    expect(getSkill('elixir').effects).toEqual([{ type: 'heal', amount: 22 }]);
    expect(getSkill('big_bomb').effects).toEqual([{ type: 'attack', mult: 0, add: 16 }]);
    expect(getSkill('ward').effects).toEqual([{ type: 'block', amount: 7 }]);
    expect(getSkill('holy_ward').effects).toEqual([{ type: 'block', amount: 12 }]);
    for (const id of ITEM_POOL) expect(getSkill(id).upgradesTo, id).toBeUndefined();
  });

  it('防具は 3 つ（鉄の盾・鋼の盾・ミスリルの盾）。報酬には出ず、ショップでだけ買える', () => {
    expect(ARMOR_POOL).toEqual(['iron_shield', 'steel_shield', 'mithril_shield']);
    expect(getSkill('mithril_shield').name).toBe('ミスリルの盾');
    expect(getSkill('mithril_shield').damageCap).toBe(3);
    expect(rarityOfSkill(getSkill('mithril_shield'))).toBe('legend');
  });

  it('図鑑の総数はスキル・道具・防具・レリックの数と合う', () => {
    expect(CODEX_ITEM_TOTAL).toBe(ITEM_POOL.length);
    expect(CODEX_ARMOR_TOTAL).toBe(ARMOR_POOL.length);
    expect(CODEX_RELIC_TOTAL).toBe(RELIC_POOL.length);
    expect(CODEX_SKILL_TOTAL).toBeGreaterThan(20);
    expect(ALL_POOL).toHaveLength(SKILL_POOL.length + ITEM_POOL.length);
  });
});

describe('レリック（効果）', () => {
  /** 防御 → ダメージ計算 → ラウンド終了、を直接流して、レリックのフックだけを試す。 */
  const calc = (m: BattleMachine, damage: number, attacker: 'player' | 'enemy' = 'enemy') =>
    m.bus.emit('onDamageCalculated', { attacker: m.ctx.entityOf(attacker), defender: m.ctx.entityOf(attacker === 'enemy' ? 'player' : 'enemy'), damage, skill: null, defending: false } as never).damage;

  it('守りの護符: 防御したとき、受けるダメージを 0 にする（スライムの溶解 3 が通らない）', async () => {
    const m = await playRound({ player: ['K', '5'], enemyHand: ['9', '9'], from: 'Surrender', playerHp: 30, relics: [DefenderCharm] });
    expect(m.ctx.player.hp).toBe(30);
    const without = await playRound({ player: ['K', '5'], enemyHand: ['9', '9'], from: 'Surrender', playerHp: 30 });
    expect(without.ctx.player.hp).toBe(27);
  });

  it('守りの護符: 各バトル 2 回まで。防御していないラウンドには効かない', () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], relics: [DefenderCharm], pace: noWait });
    expect(calc(m, 5)).toBe(5); // 防御していない
    for (const expected of [0, 0, 5]) {
      m.bus.emit('onSurrender', { entity: m.ctx.player });
      expect(calc(m, 5)).toBe(expected); // 3 回目の防御は効かない
      m.bus.emit('onRoundEnd', { round: 1 });
    }
    expect(calc(m, 5)).toBe(5);
  });

  it('反撃の構え: 防御した次のラウンドだけ、与える攻撃ダメージ +30%', () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], relics: [CounterStance], pace: noWait });
    expect(calc(m, 10, 'player')).toBe(10);
    m.bus.emit('onSurrender', { entity: m.ctx.player });
    expect(calc(m, 10, 'player')).toBe(10); // 防御したラウンド自体は変わらない
    m.bus.emit('onRoundEnd', { round: 1 });
    expect(calc(m, 10, 'player')).toBe(13); // 次のラウンド
    m.bus.emit('onRoundEnd', { round: 2 });
    expect(calc(m, 10, 'player')).toBe(10); // その次は元に戻る
  });

  it('満杯の指輪: 12〜20 がすべて埋まっていると POW +3（1 つでも欠けていると効かない）', () => {
    const full = { ...DEFAULT_PLAYER_SLOTS, 12: 'jab', 13: 'jab', 14: 'jab', 15: 'herb', 16: 'jab', 17: 'jab', 18: 'jab', 19: 'jab', 20: 'big_attack' };
    const base = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerSlots: full, pace: noWait }).ctx.player.attack;
    const ring = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerSlots: full, relics: [FullRing], pace: noWait }).ctx.player.attack;
    expect(ring).toBe(base + 3);
    const { 19: _removed, ...gap } = full;
    const partial = new BattleMachine({ enemy: ENEMY_LINEUP[0], playerSlots: gap, relics: [FullRing], pace: noWait }).ctx.player.attack;
    expect(partial).toBe(base);
  });

  it('二十一の盾: 合計 21 で Stand したときブロック +8（21 でなければ付かない）', async () => {
    const m = new BattleMachine({ enemy: ENEMY_LINEUP[0], relics: [LuckyDice], pace: noWait });
    m.ctx.player.hand.add({ rank: 'K', suit: 'S', value: 10 });
    m.ctx.player.hand.add({ rank: 'A', suit: 'S', value: 1 });
    m.bus.emit('onStand', { entity: m.ctx.player });
    expect(m.ctx.player.block).toBe(8);
    const n = new BattleMachine({ enemy: ENEMY_LINEUP[0], relics: [LuckyDice], pace: noWait });
    n.ctx.player.hand.add({ rank: 'K', suit: 'S', value: 10 });
    n.ctx.player.hand.add({ rank: '9', suit: 'S', value: 9 });
    n.bus.emit('onStand', { entity: n.ctx.player });
    expect(n.ctx.player.block).toBe(0);
  });

  it('棘の鎧: HP を削られたとき、その 20%（最低 1）を敵にも与える', async () => {
    const m = await playRound({ player: ['K', '7'], enemyHand: ['K', 'K'], enemy: enemy('knight'), relics: [ThornMail], enemyHp: 30 });
    // 騎士 20: 断罪の一閃 POW4×2 = 8 → HP -8 → 棘 floor(1.6)=1（最低 1）、そのあと後攻の通常攻撃 7
    expect(m.ctx.player.hp).toBe(60 - 8);
    expect(m.ctx.enemy.hp).toBe(30 - 1 - 7);
  });

  it('凱旋の杯（レジェンド）: 敵に勝つたび、最大 HP +1（現在の HP も +1）', async () => {
    expect(TriumphCup.rarity).toBe('legend');
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 5, playerHp: 40, relics: [TriumphCup] });
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(41);
    expect(m.ctx.player.maxHp).toBe(61);
  });

  it('破滅の加護（レジェンド）: バーストしても、受けるダメージが 1.5 倍にならない', async () => {
    expect(NoBustPenalty.rarity).toBe('legend');
    const plain = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'] });
    const blessed = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], relics: [NoBustPenalty] });
    expect(plain.ctx.player.hp).toBe(60 - Math.floor(3 * 1.5));
    expect(blessed.ctx.player.hp).toBe(60 - 3);
  });

  it('爆弾師の工具: 爆弾系（攻撃の道具）のダメージ 1.5 倍。スキルの攻撃には効かない', async () => {
    const bomb = await playRound({ player: ['7', '8'], enemyHand: ['K', 'Q'], enemyHp: 60, playerSlots: { 15: 'bomb' }, relics: [ArtisanTools] });
    expect(60 - bomb.ctx.enemy.hp).toBe(15); // 爆弾 10 → 15
    const skill = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, relics: [ArtisanTools] });
    expect(60 - skill.ctx.enemy.hp).toBe(15); // 大攻撃は変わらない
  });

  it('不屈の心: 各バトルで一度だけ、致命傷を HP 1 で耐える', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], enemy: enemy('dragon'), playerHp: 4, relics: [Unyielding] });
    expect(m.ctx.player.hp).toBe(1);
    expect(m.ctx.winner).toBeNull();
    const dead = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], enemy: enemy('dragon'), playerHp: 4 });
    expect(dead.ctx.player.hp).toBe(0);
  });

  it('レリックは 15 個（コモン 7・レア 4・レジェンド 4）で、名前と ID が重ならない', () => {
    expect(RELIC_POOL).toHaveLength(15);
    for (const [rarity, n] of [['common', 7], ['rare', 4], ['legend', 4]] as const) expect(RELIC_POOL.filter((r) => r.rarity === rarity), rarity).toHaveLength(n);
    expect(RELIC_POOL.find((r) => r.id === 'breastplate')).toMatchObject({ rarity: 'legend', name: '金剛の鎧' });
    expect(new Set(RELIC_POOL.map((r) => r.id)).size).toBe(15);
    expect(new Set(RELIC_POOL.map((r) => r.name)).size).toBe(15);
  });
});

describe('ブロックを重ねる敵（鋼鉄のゴーレム）', () => {
  const ig = enemy('iron_golem');

  it('スキルのほとんどがブロックを含み、攻撃はブロックとセット（壁・盾叩き・鉄塊の一撃）', () => {
    const skills = Object.values(ig.slots).map((id) => getSkill(id!));
    const withBlock = skills.filter((s) => s.effects.some((e) => e.type === 'block'));
    expect(withBlock.length / skills.length).toBeGreaterThan(0.8);
    expect(getSkill('ig_wall').effects).toEqual([{ type: 'block', amount: 8 }]);
    expect(getSkill('ig_bash').effects.map((e) => e.type)).toEqual(['attack', 'block']);
  });

  it('鋼の守り: ラウンドの初めにブロック +2。上限 14 を超えない（積み上がって倒せなくならない）', () => {
    const m = new BattleMachine({ enemy: ig, pace: noWait });
    m.bus.emit('onRoundStart', { round: 1 });
    expect(m.ctx.enemy.block).toBe(2);
    m.ctx.enemy.block = 13;
    m.bus.emit('onRoundStart', { round: 2 });
    expect(m.ctx.enemy.block).toBe(14);
    m.ctx.enemy.block = 25;
    m.bus.emit('onBlockApplied', { entity: m.ctx.enemy, amount: 10 });
    expect(m.ctx.enemy.block).toBe(14);
  });

  it('ブロックを無視する攻撃（会心の一撃）は、積んだブロックを破壊して、フルダメージが入る', async () => {
    const m = await playRound({ player: ['A', 'K'], enemyHand: ['9', '7'], enemy: ig, enemyHp: 34 }); // 21 vs 16
    m.ctx.enemy.block = 0; // （行動順の前に積むブロックは、ここでは使わない）
    expect(getSkill('ace_strike').effects[0]).toMatchObject({ pierce: true });
    expect(m.ctx.enemy.hp).toBeLessThanOrEqual(34);
  });
});

describe('第1〜3階層の敵の特性', () => {
  const env = (id: string) => {
    const m = new BattleMachine({ enemy: enemy(id), pace: noWait });
    return m;
  };

  it('墓守の騎士: 戦闘開始時にブロック 6', () => {
    const m = env('knight');
    m.bus.emit('onBattleStart', { player: m.ctx.player, enemy: m.ctx.enemy });
    expect(m.ctx.enemy.block).toBe(6);
  });

  it('沼の魚人・深淵の海蛇: ラウンドの初めに HP が回復する（最大 HP まで）', () => {
    const m = env('merman');
    m.ctx.enemy.hp = 10;
    m.bus.emit('onRoundStart', { round: 1 });
    expect(m.ctx.enemy.hp).toBe(11);
    const s = env('serpent');
    s.ctx.enemy.hp = s.ctx.enemy.maxHp;
    s.bus.emit('onRoundStart', { round: 1 });
    expect(s.ctx.enemy.hp).toBe(s.ctx.enemy.maxHp);
  });

  it('亡霊: ラウンドの初めに、あなたのブロックが 2 減る（0 未満にはならない）', () => {
    const m = env('wraith');
    m.ctx.player.block = 5;
    m.bus.emit('onRoundStart', { round: 1 });
    expect(m.ctx.player.block).toBe(3);
    m.ctx.player.block = 1;
    m.bus.emit('onRoundStart', { round: 2 });
    expect(m.ctx.player.block).toBe(0);
  });

  it('ガーゴイル・溶岩ゴーレム: 受けるダメージ -3（最低 1）', async () => {
    for (const id of ['gargoyle', 'golem']) {
      const e = enemy(id);
      const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemy: e, enemyHp: 60 });
      expect(60 - m.ctx.enemy.hp, id).toBe(15 - 3);
    }
  });

  it('炎の精霊: 攻撃ダメージ +2。業火の悪魔: 同値なら必ず先攻', async () => {
    const flame = await playRound({ player: ['K', '7'], enemyHand: ['K', 'K'], enemy: enemy('flame') });
    // 20: 紅蓮 POW5×2+2 = 12、燃焼 +2 = 14（17 は未設定でブロック なし）
    expect(flame.ctx.player.hp).toBe(60 - 14);
    const imp = await playRound({ player: ['K', 'Q'], enemyHand: ['K', 'K'], enemy: enemy('imp') });
    expect(imp.ctx.turn).toMatchObject({ mode: 'sequential', first: 'enemy', second: 'player' });
  });

  it('全員の LV と魂片: 階層が進むほど敵が強く、踏破した階層の分の魂片が増える', () => {
    expect(computeShards({ maxRow: 24, enemiesDefeated: 20, cleared: true, stagesCleared: 2 })).toBe(24 * 2 + 20 * 4 + 2 * SHARD_STAGE_BONUS + SHARD_CLEAR_BONUS);
    expect(computeShards({ maxRow: 5, enemiesDefeated: 2, cleared: false })).toBe(5 * 2 + 2 * 4);
  });
});
