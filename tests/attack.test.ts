import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { Slime } from '../src/core/entities/enemies/Slime';
import { badgeText, formatPreview, previewAllSlots, previewSkill } from '../src/core/skills/preview';
import { attackFormula, attackValue, describeSkill, getSkill } from '../src/core/skills/Skill';
import { describeSlotTable } from '../src/core/skills/table';
import { seededRng } from '../src/core/util/Rng';
import { resolveShrine } from '../src/map/events';
import { Whetstone } from '../src/relics/catalog';
import { createRun } from '../src/run/Run';
import { noWait, playRound } from './helpers';

const machine = (opts: Partial<ConstructorParameters<typeof BattleMachine>[0]> = {}) =>
  new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, ...opts });
const give = (m: BattleMachine, who: 'player' | 'enemy', ranks: Rank[]) =>
  ranks.forEach((r) => m.ctx[who].hand.add(makeCard(r, 'S')));

describe('基本攻撃力（ATK）', () => {
  it('攻撃ダメージは floor(ATK × 倍率) + 加算 で決まる', () => {
    expect(attackValue({ mult: 1 }, 5)).toBe(5);
    expect(attackValue({ mult: 0.5 }, 5)).toBe(2);
    expect(attackValue({ mult: 1, add: 5 }, 5)).toBe(10);
    expect(attackValue({ mult: 3 }, 5)).toBe(15);
    expect(attackFormula({ mult: 1 })).toBe('ATK');
    expect(attackFormula({ mult: 1, add: 5 })).toBe('ATK+5');
    expect(attackFormula({ mult: 3 })).toBe('ATK×3');
  });

  it('初期スキルの式: 11以下=ATK×0.5 / 剛=ATK+5 / 会=ATK×3（クリティカルの概念はない）', () => {
    expect(describeSkill(getSkill('small_attack'), 5)).toBe('攻撃 ATK×0.5＝2');
    expect(describeSkill(getSkill('big_attack'), 5)).toBe('攻撃 ATK+5＝10');
    expect(describeSkill(getSkill('ace_strike'), 5)).toBe('攻撃 ATK×3＝15');
    expect(describeSkill(getSkill('big_attack'))).toBe('攻撃 ATK+5');
    expect(describeSkill(getSkill('shield'))).toBe('Block 8');
  });

  it('癒（回復）スキルは廃止され、18 は盾（Block 8）になった', () => {
    const m = machine();
    expect(m.ctx.player.slots[18]).toBe('shield');
    expect(Object.values(m.ctx.player.slots)).not.toContain('mend');
    expect(() => getSkill('mend')).toThrow();
  });

  it('プレイヤーと敵は ATK を持ち、プレイヤーは初期値5。冒険から引き継げる', () => {
    expect(machine().ctx.player.attack).toBe(5);
    expect(machine().ctx.enemy.attack).toBe(Slime.attack);
    expect(createRun().baseAttack).toBe(5);
    expect(machine({ playerAttack: 7 }).ctx.player.attack).toBe(7);
  });

  it('ATK が上がると、すべての攻撃スキルが伸びる', async () => {
    const base = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60 });
    const buffed = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, playerAttack: 7 });
    expect(60 - base.ctx.enemy.hp).toBe(10);   // ATK+5
    expect(60 - buffed.ctx.enemy.hp).toBe(12);
    const plain = await playRound({ player: ['6', '7'], enemyHand: ['3', '4'], enemyHp: 60, playerAttack: 7 });
    expect(60 - plain.ctx.enemy.hp).toBe(7);   // 未設定は通常攻撃 = ATK×1
  });

  it('砥石は ATK +2。祠（力）でも ATK が上がる', () => {
    expect(machine({ relics: [Whetstone] }).ctx.player.attack).toBe(7);
    const seen: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun();
      if (resolveShrine(run, seededRng(seed)).id === 'might') seen.push(run.baseAttack);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === 6)).toBe(true);
  });
});

describe('予測ダメージ', () => {
  it('通常のスキル: 発動するスキルとダメージを出す', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']); // 20: 大攻撃
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(p.skill?.id).toBe('big_attack');
    expect(p.parts).toEqual([{ type: 'attack', value: 10 }]);
    expect(formatPreview(p)).toBe('大攻撃 → 10ダメージ');
  });

  it('21 は会心の一撃（ATK×3 = 15）。ブラックジャックでも変わらない', () => {
    const m = machine();
    give(m, 'player', ['A', 'K']);
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 21);
    expect(p.skill?.id).toBe('ace_strike');
    expect(p.parts[0]).toEqual({ type: 'attack', value: 15 });
  });

  it('レリックと敵の特性による補正を反映する', () => {
    const m = machine({ enemy: ENEMY_LINEUP.find((e) => e.id === 'skeleton')!, relics: [Whetstone] });
    give(m, 'player', ['K', 'K']);
    // ATK7 → 大攻撃 ATK+5 = 12、骨の鎧 -2 → 10
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(10);
  });

  it('予測は戦闘の状態を変えない（副作用なし）', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);
    previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(m.ctx.enemy.hp).toBe(Slime.maxHp);
    expect(m.ctx.player.block).toBe(0);
  });

  it('予測と実際のダメージが一致する', async () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);
    give(m, 'enemy', ['9', '9']);
    const predicted = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value;
    m.ctx.enemy.hp = 40;
    await m.runFrom('Initiative', ['Deal']);
    expect(40 - m.ctx.enemy.hp).toBe(predicted);
  });

  it('相手がバーストしているなら、予測にも1.5倍が出て、実際のダメージと一致する', async () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);      // 20: 大攻撃 10
    give(m, 'enemy', ['K', 'Q', '5']);  // 25: バースト
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(p.parts).toEqual([{ type: 'attack', value: 15 }]);
    m.ctx.enemy.hp = 40;
    await m.runFrom('Initiative', ['Deal']);
    expect(40 - m.ctx.enemy.hp).toBe(15);
  });

  it('敵の予測も、バーストしたプレイヤーへの1.5倍を反映する', () => {
    const m = machine();
    give(m, 'player', ['K', 'Q', '5']); // 25: バースト
    give(m, 'enemy', ['9', '9']);       // 18: 溶解 8
    expect(previewSkill(m.ctx, m.ctx.enemy, m.ctx.player, 18).parts[0].value).toBe(12);
  });

  it('伏せカードがあるうちは、敵のバーストを予測に漏らさない（めくられたら1.5倍）', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);
    give(m, 'enemy', ['K', 'Q']);
    m.ctx.enemy.hand.add(makeCard('5', 'S'), { faceDown: true }); // 伏せた1枚で 25 のバースト
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(10);
    m.ctx.enemy.hand.revealAll();
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(15);
  });

  it('防御スキルは Block の値を出す。敵の Block 吸収後も示す', () => {
    const m = machine();
    give(m, 'player', ['7', '8']); // 15: シールド
    expect(formatPreview(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 15))).toBe('シールド → Block +6');
    const n = machine();
    give(n, 'player', ['K', 'K']);
    expect(formatPreview(previewSkill(n.ctx, n.ctx.player, n.ctx.enemy, 20), 5)).toContain('Block吸収後 5');
  });
});

describe('スロット表の各マスの効果', () => {
  const badges = (m: BattleMachine, who: 'player' | 'enemy') => {
    const [user, target] = who === 'player' ? [m.ctx.player, m.ctx.enemy] : [m.ctx.enemy, m.ctx.player];
    const all = previewAllSlots(m.ctx, user, target, Array.from({ length: 11 }, (_, i) => 11 + i));
    return Object.fromEntries([...all].map(([k, parts]) => [k, parts.map(badgeText).join(' ')]));
  };

  it('攻撃はダメージ数、Block は B+数。空きスロットは通常攻撃の数', () => {
    const b = badges(machine(), 'player');
    expect(b).toMatchObject({ 11: '2', 12: '5', 15: 'B6', 18: 'B8', 20: '10', 21: '15' });
  });

  it('回復は +数。複数の効果は並べる（吸精: 攻撃と回復）', () => {
    expect(badgeText({ type: 'heal', value: 4 })).toBe('+4');
    const m = machine({ playerSlots: { 17: 'drain', 16: 'shield_bash' } });
    expect(badges(m, 'player')).toMatchObject({ 17: '6 +4', 16: '5 B5' });
  });

  it('レリックで変わった効果が出る（砥石 ATK+2: 大攻撃 12）。敵のスロットも同じ', () => {
    expect(badges(machine({ relics: [Whetstone] }), 'player')[20]).toBe('12');
    expect(badges(machine(), 'enemy')).toMatchObject({ 17: '8', 20: '12' }); // スライム ATK3: 溶解 ATK×2+2 / 飲み込み ATK×4
  });

  it('相手がバーストしているときは 1.5倍、伏せカードがあるうちは等倍', () => {
    const m = machine();
    give(m, 'player', ['K', 'Q', '5']); // バースト
    expect(badges(m, 'enemy')[17]).toBe('12'); // 8 × 1.5
    const n = machine();
    give(n, 'enemy', ['K', 'Q']);
    n.ctx.enemy.hand.add(makeCard('5', 'S'), { faceDown: true });
    expect(badges(n, 'player')[20]).toBe('10'); // 伏せカードのバーストは漏らさない
  });
});

describe('敵のスキル一覧（実数値つき）', () => {
  it('全スロット（11〜21）の行が出て、未設定行は通常攻撃になる', () => {
    const m = machine({ enemy: ENEMY_LINEUP.find((e) => e.id === 'skeleton')! });
    const rows = describeSlotTable(m.ctx.enemy);
    expect(rows).toHaveLength(11);
    expect(rows[0]).toMatchObject({ label: '≤11', isFallback: true });
    expect(rows[0].skill.id).toBe('skel_stab');
    const r15 = rows.find((r) => r.key === 15)!;
    expect(r15).toMatchObject({ isFallback: false });
    expect(r15.skill.id).toBe('skel_guard');
    // 骸骨兵 ATK4: 斬り下ろし ATK×2 = 8 / 兜割り ATK×3 = 12
    expect(rows.find((r) => r.key === 18)!.text).toBe('攻撃 ATK×2＝8');
    expect(rows.find((r) => r.key === 21)!.text).toBe('攻撃 ATK×3＝12');
  });

  it('敵は全員 ATK を持ち、一覧が作れる', () => {
    for (const e of ENEMY_LINEUP) {
      const m = machine({ enemy: e });
      expect(m.ctx.enemy.attack).toBeGreaterThan(0);
      expect(describeSlotTable(m.ctx.enemy)).toHaveLength(11);
    }
  });
});
