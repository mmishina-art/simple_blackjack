import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { Slime } from '../src/core/entities/enemies/Slime';
import { formatPreview, previewSkill } from '../src/core/skills/preview';
import { attackFormula, attackValue, describeSkill, getSkill } from '../src/core/skills/Skill';
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
    expect(attackValue({ mult: 1 }, 4)).toBe(4);
    expect(attackValue({ mult: 3, add: 2 }, 4)).toBe(14);
    expect(attackValue({ mult: 1.5 }, 5)).toBe(7);
    expect(attackFormula({ mult: 1 })).toBe('ATK');
    expect(attackFormula({ mult: 3, add: 2 })).toBe('ATK×3+2');
    expect(describeSkill(getSkill('big_attack'), 4)).toBe('攻撃 ATK×3+2＝14');
    expect(describeSkill(getSkill('big_attack'))).toBe('攻撃 ATK×3+2');
  });

  it('プレイヤーと敵は ATK を持ち、プレイヤーは初期値4。冒険から引き継げる', () => {
    expect(machine().ctx.player.attack).toBe(4);
    expect(machine().ctx.enemy.attack).toBe(Slime.attack);
    expect(createRun().baseAttack).toBe(4);
    expect(machine({ playerAttack: 7 }).ctx.player.attack).toBe(7);
  });

  it('ATK が上がると、すべての攻撃スキルが伸びる（倍率が大きいほど大きく）', async () => {
    const base = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60 });
    const buffed = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, playerAttack: 6 });
    expect(60 - base.ctx.enemy.hp).toBe(14);   // ×3+2
    expect(60 - buffed.ctx.enemy.hp).toBe(20); // ATK+2 → +6
    const plain = await playRound({ player: ['6', '7'], enemyHand: ['3', '4'], enemyHp: 60, playerAttack: 6 });
    expect(60 - plain.ctx.enemy.hp).toBe(6);   // 未設定は通常攻撃 = ATK×1
  });

  it('砥石は ATK +1。祠（力）でも ATK が上がる', () => {
    expect(machine({ relics: [Whetstone] }).ctx.player.attack).toBe(5);
    const seen = [];
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun();
      if (resolveShrine(run, seededRng(seed)).id === 'might') seen.push(run.baseAttack);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === 5)).toBe(true);
  });
});

describe('予測ダメージ', () => {
  it('通常のスキル: 基本の値と会心時の値を出す', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']); // 20: 大攻撃
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(p.skill?.id).toBe('big_attack');
    expect(p.parts).toEqual([{ type: 'attack', value: 14, critValue: 21 }]);
    expect(formatPreview(p)).toBe('大攻撃 → 14ダメージ（会心 21）');
  });

  it('必ず会心のスキル（21）は会心の値が基本になる', () => {
    const m = machine();
    give(m, 'player', ['7', '7', '7']);
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 21);
    expect(p.skill?.id).toBe('critical_strike');
    expect(p.parts[0]).toMatchObject({ value: 21 });
    expect(formatPreview(p)).toContain('（会心）');
  });

  it('ブラックジャック（初手21）は会心扱い', () => {
    const m = machine();
    give(m, 'player', ['A', 'K']);
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 21).crit).toBe(true);
  });

  it('レリックと敵の特性による補正を反映する', () => {
    const m = machine({ enemy: ENEMY_LINEUP.find((e) => e.id === 'skeleton')!, relics: [Whetstone] });
    give(m, 'player', ['K', 'K']);
    // ATK5 → 大攻撃 ×3+2 = 17、骨の鎧 -2 → 15
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(15);
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

  it('防御・回復スキルは Block / HP の値を出す。敵の Block 吸収後も示す', () => {
    const m = machine();
    give(m, 'player', ['7', '8']); // 15: シールド
    expect(formatPreview(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 15))).toBe('シールド → Block +6');
    const n = machine();
    give(n, 'player', ['K', 'K']);
    expect(formatPreview(previewSkill(n.ctx, n.ctx.player, n.ctx.enemy, 20), 5)).toContain('Block吸収後 9');
  });
});
