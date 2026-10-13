import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { Slime } from '../src/core/entities/enemies/Slime';
import { badgeText, formatPreview, previewAllSlots, previewSkill } from '../src/core/skills/preview';
import { fxChips } from '../src/ui/callout';
import { slotAttack } from '../src/core/skills/catalog';
import { attackFormula, attackValue, describeSkill, describeSkillBonus, describeSkillShort, circledNumber, diffLines, effectTotals, getSkill } from '../src/core/skills/Skill';
import { describeSlotTable } from '../src/core/skills/table';
import { seededRng } from '../src/core/util/Rng';
import { resolveShrine } from '../src/map/events';
import { Bracer, Whetstone } from '../src/relics/catalog';
import { previewSlot } from '../src/run/effective';
import { createRun } from '../src/run/Run';
import { noWait, playRound, WITH_BLOCKS } from './helpers';

const machine = (opts: Partial<ConstructorParameters<typeof BattleMachine>[0]> = {}) =>
  new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, ...opts });
const give = (m: BattleMachine, who: 'player' | 'enemy', ranks: Rank[]) =>
  ranks.forEach((r) => m.ctx[who].hand.add(makeCard(r, 'S')));

describe('基本パワー（POW）', () => {
  it('攻撃ダメージは floor(POW × 倍率) + 加算 で決まる', () => {
    expect(attackValue({ mult: 1 }, 5)).toBe(5);
    expect(attackValue({ mult: 0.5 }, 5)).toBe(2);
    expect(attackValue({ mult: 1, add: 5 }, 5)).toBe(10);
    expect(attackValue({ mult: 3 }, 5)).toBe(15);
    expect(attackFormula({ mult: 1 })).toBe('POW');
    expect(attackFormula({ mult: 1, add: 5 })).toBe('POW+5');
    expect(attackFormula({ mult: 3 })).toBe('POW×3');
  });

  it('初期スキルの式: 11以下=POW×0.5 / 剛=POW+5 / 会=POW×1.5（クリティカルの概念はない）', () => {
    expect(describeSkill(getSkill('small_attack'), 5)).toBe('攻撃 POW×0.5＝2');
    expect(describeSkill(getSkill('big_attack'), 5)).toBe('攻撃 POW+5＝10');
    expect(describeSkill(getSkill('ace_strike'), 5)).toBe('攻撃 POW×1.5＝7（ブロック無視・破壊）');
    expect(describeSkill(getSkill('big_attack'))).toBe('攻撃 POW+5');
    expect(describeSkill(getSkill('shield'))).toBe('ブロック POW+3'); // ブロック・回復も基本パワーが基準
    expect(describeSkill(getSkill('shield'), 8)).toBe('ブロック POW+3＝11');
    expect(describeSkill(getSkill('herb'), 5)).toBe('回復 8'); // 道具は固定（POW に関係ない）
    expect(describeSkill(getSkill('herb'), 12)).toBe('回復 8');
    expect(describeSkill(getSkill('bomb'))).toBe('攻撃 10');
    expect(describeSkill(getSkill('skel_guard'))).toBe('ブロック 6'); // 敵の防御は固定量のまま
  });

  it('初期スロットには受け流し・身構えはない（守りは防具が受け持つ）。回復スキルも入っていない（回復は薬草）', () => {
    const m = machine();
    expect(m.ctx.player.slots[15]).toBe('herb'); // 15 は薬草（止まるか迷う合計値）
    expect(m.ctx.player.slots[18]).toBeUndefined();
    expect(Object.values(m.ctx.player.slots).sort()).toEqual(['ace_strike', 'big_attack', 'herb', 'small_attack']);
    expect(Object.values(m.ctx.player.slots)).not.toContain('mend');
  });

  it('プレイヤーと敵は POW を持ち、プレイヤーは初期値5。冒険から引き継げる', () => {
    expect(machine().ctx.player.attack).toBe(5);
    expect(machine().ctx.enemy.attack).toBe(Slime.attack);
    expect(createRun().baseAttack).toBe(5);
    expect(machine({ playerAttack: 7 }).ctx.player.attack).toBe(7);
  });

  it('POW が上がると、すべての攻撃スキルが伸びる', async () => {
    const base = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60 });
    const buffed = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 60, playerAttack: 7 });
    expect(60 - base.ctx.enemy.hp).toBe(15);   // 20 は POW 10: 大攻撃 POW+5
    expect(60 - buffed.ctx.enemy.hp).toBe(17); // 強化 +2 は、どのスロットにも足される
    const plain = await playRound({ player: ['6', '7'], enemyHand: ['3', '4'], enemyHp: 60, playerAttack: 7 });
    expect(60 - plain.ctx.enemy.hp).toBe(5);   // 13 は POW 3 + 強化 2。未設定は通常攻撃 = POW×1
  });

  it('砥石は POW +1。祠（力）でも POW が上がる', () => {
    expect(machine({ relics: [Whetstone] }).ctx.player.attack).toBe(6);
    const seen: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun();
      if (resolveShrine(run, seededRng(seed)).id === 'might') seen.push(run.baseAttack);
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === 6)).toBe(true);
  });
});

describe('スロットごとの基本パワー（プレイヤー）', () => {
  it('11以下=1 から、スロットが1上がるごとに +1（21=11）。強化はどのスロットにも同じだけ足される', () => {
    expect([11, 12, 13, 15, 18, 20, 21].map((k) => slotAttack(5, k))).toEqual([1, 2, 3, 5, 8, 10, 11]);
    expect(slotAttack(5, 4)).toBe(1);   // 11 未満（合計 4 など）は「11以下」のスロット
    expect(slotAttack(5, 25)).toBe(11); // 21 を超える値は 21 に丸める
    expect([11, 15, 21].map((k) => slotAttack(7, k))).toEqual([3, 7, 13]); // 強化 +2
    expect(slotAttack(5, 15)).toBe(5);  // 標準では、スロット15 が従来の固定値と同じ
  });

  it('プレイヤーは合計値で変わり、敵は固定のまま', () => {
    const m = machine();
    expect(m.ctx.player.attackAt(11)).toBe(1);
    expect(m.ctx.player.attackAt(20)).toBe(10);
    expect(m.ctx.enemy.attackAt(11)).toBe(Slime.attack);
    expect(m.ctx.enemy.attackAt(21)).toBe(Slime.attack);
  });

  it('攻撃スキルは最低 1 ダメージ（POW 1 の小攻撃 POW×0.5 が 0 にならない）。ブロック・回復は対象外', () => {
    expect(attackValue({ mult: 0.5 }, 1)).toBe(1);
    expect(attackValue({ mult: 0.5 }, 5)).toBe(2);
    expect(attackValue({ mult: 0 }, 5)).toBe(0);
  });

  it('スロットが決まっていない一覧（報酬・持ち物）では、幅（7〜15）ではなく、上乗せだけを示す（+5 など）', () => {
    expect(describeSkillBonus(getSkill('big_attack'))).toBe('攻撃 +5');
    expect(describeSkillBonus(getSkill('jab'))).toBe('攻撃 +1');
    expect(describeSkillBonus(getSkill('basic_attack'))).toBe('攻撃 +0');
    expect(describeSkillBonus(getSkill('heavy'))).toBe('攻撃 ×1.5+3');
    expect(describeSkillBonus(getSkill('smash'))).toBe('攻撃 ×2+5');
    expect(describeSkillBonus(getSkill('shield'))).toBe('ブロック +3');
    expect(describeSkillBonus(getSkill('herb'))).toBe('回復 8'); // 道具は固定量のまま
    expect(describeSkillBonus(getSkill('bomb'))).toBe('攻撃 10');
    expect(describeSkillBonus(getSkill('drain'))).toBe('攻撃 +1 + 回復 ×0.5+2');
    expect(describeSkillBonus(getSkill('ace_strike'))).toBe('攻撃 ×1.5（ブロック無視・破壊）');
    expect(describeSkillBonus(getSkill('skel_guard'))).toBe('ブロック 6'); // 固定量は数字のまま
    for (const id of ['big_attack', 'shield', 'drain']) expect(describeSkillBonus(getSkill(id))).not.toMatch(/〜|＝/);
  });

  it('実際の戦闘で、同じスキルでも合計値が高いスロットほど強い', async () => {
    const low = await playRound({ player: ['6', '7'], enemyHand: ['2', '3'], enemyHp: 99 });   // 13: 空き → 通常攻撃 POW 3
    expect(99 - low.ctx.enemy.hp).toBe(3);
    const custom = await playRound({ player: ['9', '9'], enemyHand: ['2', '3'], enemyHp: 99, playerSlots: {} }); // 18 が空き: 通常攻撃 POW 8
    expect(99 - custom.ctx.enemy.hp).toBe(8);
  });
});

describe('防御・回復もスロットの基本パワーが基準（上位のスキルほど上乗せが大きい）', () => {
  const at = (id: string, key: number, relics: ConstructorParameters<typeof BattleMachine>[0]['relics'] = []) => {
    const m = machine({ playerSlots: { [key]: id }, relics });
    return previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, key).parts.map((p) => p.value);
  };

  it('ブロック・回復は、スロットが高いほど増える（身構え POW+3: 12→5 / 15→8 / 18→11 / 20→13）', () => {
    expect([12, 15, 18, 20].map((k) => at('shield', k)[0])).toEqual([5, 8, 11, 13]);
    expect([12, 20].map((k) => at('herb', k)[0])).toEqual([8, 8]); // 薬草（道具）は、スロットが変わっても固定
  });

  it('上位ほど上乗せが大きい: 受け流し POW+1 < 身構え POW+3 < 鉄壁の構え POW+5（同じスロットで）', () => {
    expect([at('guard', 15)[0], at('shield', 15)[0], at('bulwark', 15)[0]]).toEqual([6, 8, 10]);
    expect(getSkill('guard').rarity ?? 'common').toBe('common');
    expect(getSkill('bulwark').rarity).toBe('rare');
  });

  it('攻撃も同じ: 突き POW+1 < 斬撃 POW+3 < 大攻撃 POW+5 < 渾身の一撃 POW×2+5（スロット15、POW 5）', () => {
    expect(['jab', 'slash', 'big_attack', 'smash'].map((id) => at(id, 15)[0])).toEqual([6, 8, 10, 15]);
  });

  it('複数の効果も POW 基準（盾打ち: 攻撃 POW + ブロック POW / 吸精: 攻撃 POW+1 + 回復 POW×0.5+2）', () => {
    expect(at('shield_bash', 17)).toEqual([7, 7]);
    expect(at('drain', 17)).toEqual([8, 5]);
  });

  it('POW の強化（砥石 +1）は、ブロック・回復にも効く', () => {
    expect(at('shield', 15, [Whetstone])[0]).toBe(9); // POW 5+1 → ブロック POW+3
    expect(at('herb', 15, [Whetstone])[0]).toBe(8); // 道具は POW の強化の影響を受けない
  });

  it('敵の防御・回復は固定量のまま（POW が固定の敵は、いつも同じ）', () => {
    const m = machine({ enemy: ENEMY_LINEUP.find((e) => e.id === 'skeleton')! });
    const guard = previewSkill(m.ctx, m.ctx.enemy, m.ctx.player, 15);
    expect(guard.parts).toEqual([{ type: 'block', value: 6 }]);
  });

  it('会心の一撃は POW×1.5（スロット21 は POW 11 で 16）。祠でバージョンアップした覇王の一撃は POW×2（22）、さらに ×3・×4・×5（33・44・55）', () => {
    expect(at('ace_strike', 21)).toEqual([16]);
    expect(at('overlord_strike', 21)).toEqual([22]);
    expect(at('overlord_judge', 21)).toEqual([33]);
    expect(at('heaven_strike', 21)).toEqual([44]);
    expect(at('final_strike', 21)).toEqual([55]);
  });

  it('実際の戦闘でも、薬草（道具）の回復量は固定（どのスロットでも 8）', async () => {
    const a = await playRound({ player: ['7', '8'], enemyHand: ['K', 'Q', '5'], playerSlots: { 15: 'herb' }, playerHp: 20 });
    const b = await playRound({ player: ['A', '9'], enemyHand: ['K', 'Q', '5'], playerSlots: { 20: 'herb' }, playerHp: 20 });
    expect(a.ctx.player.hp).toBe(28);
    expect(b.ctx.player.hp).toBe(28);
  });
});

describe('会心の一撃はブロックを無視して破壊する（ほかの攻撃との違い）', () => {
  const fight = async (player: Rank[], enemyBlock: number) => {
    const waits: string[] = []; // 敵が受けたダメージの内訳（HP / 吸収 / 破壊）
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait });
    m.bus.on('onDamageDealt', ({ broken, absorbed, hpLoss, defender }) => { if (defender.id === 'enemy') waits.push(`${hpLoss}/${absorbed}/${broken}`); });
    player.forEach((r) => m.ctx.player.hand.add(makeCard(r, 'S')));
    (['2', '3'] as Rank[]).forEach((r) => m.ctx.enemy.hand.add(makeCard(r, 'H')));
    m.ctx.enemy.hp = 99;
    m.ctx.enemy.block = enemyBlock;
    await m.runFrom('Initiative', ['Deal']);
    return { m, waits };
  };

  it('ブロックに吸われず、フルダメージが入り、相手のブロックはすべて破壊される', async () => {
    const { m, waits } = await fight(['A', 'K'], 10); // 21: 会心の一撃 16
    expect(99 - m.ctx.enemy.hp).toBe(16);
    expect(m.ctx.enemy.block).toBe(0);
    expect(waits).toEqual(['16/0/10']); // HP 16 / 吸収 0 / 破壊 10
    expect(m.logs).toContain('スライムのブロック 10 を破壊した');
  });

  it('ほかの攻撃（大攻撃など）は、従来どおりブロックに吸われる', async () => {
    const { m, waits } = await fight(['K', 'K'], 10); // 20: 大攻撃 15
    expect(99 - m.ctx.enemy.hp).toBe(5);
    expect(m.ctx.enemy.block).toBe(0);
    expect(waits).toEqual(['5/10/0']);
    expect(m.logs.some((l) => l.includes('を破壊した'))).toBe(false);
  });

  it('相手にブロックがないときは、破壊の表示は出ない', async () => {
    const { m, waits } = await fight(['A', 'K'], 0);
    expect(waits).toEqual(['16/0/0']);
    expect(m.logs.some((l) => l.includes('を破壊した'))).toBe(false);
  });

  it('予測と大きな表示にも出る（ブロックを破壊 / ブロック無視）', () => {
    const m = machine();
    give(m, 'player', ['A', 'K']);
    m.ctx.enemy.block = 7;
    const parts = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 21).parts;
    expect(parts[0]).toEqual({ type: 'attack', value: 16, pierce: true });
    expect(fxChips(parts, 7)[0]).toMatchObject({ main: '16', note: 'ブロック 7 を破壊' });
    expect(fxChips(parts, 0)[0].note).toBe('ブロック無視');
    expect(formatPreview({ skill: getSkill('ace_strike'), parts }, 7)).toContain('ブロック無視');
  });

  it('覇王の一撃も、ブロックを無視する', () => {
    expect(getSkill('overlord_strike').effects[0]).toMatchObject({ type: 'attack', pierce: true });
  });

  it('プレイヤーも同じ: 敵の会心の一撃のような pierce 攻撃は、プレイヤーのブロックを破壊する', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, playerBlock: 9 });
    m.ctx.enemy.slots = { 17: 'ace_strike' }; // 敵に会心の一撃を持たせる（pierce の効果は誰が使っても同じ）
    ['K', 'Q', '5'].forEach((r) => m.ctx.player.hand.add(makeCard(r as Rank, 'S'))); // バースト
    ['9', '8'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as Rank, 'H')));       // 17
    await m.runFrom('Initiative', ['Deal']);
    expect(m.ctx.player.block).toBe(0);
    expect(m.ctx.player.hp).toBeLessThan(60);
  });
});

describe('予測ダメージ', () => {
  it('通常のスキル: 発動するスキルとダメージを出す', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']); // 20: 大攻撃
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(p.skill?.id).toBe('big_attack');
    expect(p.parts).toEqual([{ type: 'attack', value: 15 }]);
    expect(formatPreview(p)).toBe('大攻撃 → 15ダメージ');
  });

  it('21 は会心の一撃（POW 11 × 1.5 = 16）。ブラックジャックでも変わらない', () => {
    const m = machine();
    give(m, 'player', ['A', 'K']);
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 21);
    expect(p.skill?.id).toBe('ace_strike');
    expect(p.parts[0]).toEqual({ type: 'attack', value: 16, pierce: true });
  });

  it('レリックと敵の特性による補正を反映する', () => {
    const m = machine({ enemy: ENEMY_LINEUP.find((e) => e.id === 'skeleton')!, relics: [Whetstone] });
    give(m, 'player', ['K', 'K']);
    // 20 は POW 10 + 砥石 1 = 11 → 大攻撃 POW+5 = 16、骨の鎧 -2 → 14
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(14);
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
    give(m, 'player', ['K', 'K']);      // 20: 大攻撃 15
    give(m, 'enemy', ['K', 'Q', '5']);  // 25: バースト
    const p = previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20);
    expect(p.parts).toEqual([{ type: 'attack', value: 22 }]); // 15 × 1.5
    m.ctx.enemy.hp = 40;
    await m.runFrom('Initiative', ['Deal']);
    expect(40 - m.ctx.enemy.hp).toBe(22);
  });

  it('敵の予測も、バーストしたプレイヤーへの1.5倍を反映する', () => {
    const m = machine();
    give(m, 'player', ['K', 'Q', '5']); // 25: バースト
    give(m, 'enemy', ['9', '9']);       // 18: 溶解 3
    expect(previewSkill(m.ctx, m.ctx.enemy, m.ctx.player, 18).parts[0].value).toBe(4); // 3 × 1.5
  });

  it('伏せカードがあるうちは、敵のバーストを予測に漏らさない（めくられたら1.5倍）', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);
    give(m, 'enemy', ['K', 'Q']);
    m.ctx.enemy.hand.add(makeCard('5', 'S'), { faceDown: true }); // 伏せた1枚で 25 のバースト
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(15);
    m.ctx.enemy.hand.revealAll();
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 20).parts[0].value).toBe(22); // 15 × 1.5
  });

  it('防御スキルはブロックの値を出す。敵のブロック 吸収後も示す', () => {
    const m = machine({ playerSlots: WITH_BLOCKS });
    give(m, 'player', ['7', '8']); // 15: 受け流し
    expect(formatPreview(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 15))).toBe('受け流し → ブロック +6');
    const n = machine();
    give(n, 'player', ['K', 'K']);
    expect(formatPreview(previewSkill(n.ctx, n.ctx.player, n.ctx.enemy, 20), 5)).toContain('ブロック吸収後 10'); // 15 - 5
  });
});

describe('スロット表の各マスの効果', () => {
  const badges = (m: BattleMachine, who: 'player' | 'enemy') => {
    const [user, target] = who === 'player' ? [m.ctx.player, m.ctx.enemy] : [m.ctx.enemy, m.ctx.player];
    const all = previewAllSlots(m.ctx, user, target, Array.from({ length: 11 }, (_, i) => 11 + i));
    return Object.fromEntries([...all].map(([k, parts]) => [k, parts.map(badgeText).join(' ')]));
  };

  it('攻撃はダメージ数、ブロックは B+数。空きスロットは通常攻撃の数', () => {
    const b = badges(machine({ playerSlots: WITH_BLOCKS }), 'player');
    // 基本パワーは 11以下=1、スロットが上がるごとに +1（小攻撃 POW×0.5 は最低 1）
    // ブロックも POW 基準（受け流し POW+1 → 15 で 6、身構え POW+3 → 18 で 11）。会心の一撃は POW×1.5
    expect(b).toMatchObject({ 11: '1', 12: '+8', 13: '3', 15: 'B6', 18: 'B11', 20: '15', 21: '16' }); // 12 は薬草（道具・回復 8 固定）
  });

  it('回復は +数。複数の効果は並べる（吸精: 攻撃と回復）', () => {
    expect(badgeText({ type: 'heal', value: 4 })).toBe('+4');
    const m = machine({ playerSlots: { 17: 'drain', 16: 'shield_bash' } });
    expect(badges(m, 'player')).toMatchObject({ 17: '8 +5', 16: '6 B6' }); // 17 は POW 7: 攻撃 +1 / 回復 POW×0.5+2。16 は POW 6: 攻撃 POW / ブロック POW
  });

  it('レリックで変わった効果が出る（砥石 POW+1: 大攻撃 11）。敵のスロットも同じ', () => {
    expect(badges(machine({ relics: [Whetstone] }), 'player')[20]).toBe('16'); // POW 10 + 1 = 11、POW+5
    expect(badges(machine(), 'enemy')).toMatchObject({ 17: '3', 20: '6' }); // スライム POW3: 溶解 POW / 飲み込み POW×2
  });

  it('相手がバーストしているときは 1.5倍、伏せカードがあるうちは等倍', () => {
    const m = machine();
    give(m, 'player', ['K', 'Q', '5']); // バースト
    expect(badges(m, 'enemy')[17]).toBe('4'); // 3 × 1.5
    const n = machine();
    give(n, 'enemy', ['K', 'Q']);
    n.ctx.enemy.hand.add(makeCard('5', 'S'), { faceDown: true });
    expect(badges(n, 'player')[20]).toBe('15'); // 伏せカードのバーストは漏らさない
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
    // 骸骨兵 POW4: 斬り下ろし POW = 4 / 兜割り POW+3 = 7
    expect(rows.find((r) => r.key === 18)!.text).toBe('攻撃 POW＝4');
    expect(rows.find((r) => r.key === 21)!.text).toBe('攻撃 POW+3＝7');
  });

  it('敵は全員 POW を持ち、一覧が作れる', () => {
    for (const e of ENEMY_LINEUP) {
      const m = machine({ enemy: e });
      expect(m.ctx.enemy.attack).toBeGreaterThan(0);
      expect(describeSlotTable(m.ctx.enemy)).toHaveLength(11);
    }
  });
});

describe('スロット表の右側の短い表示と、基本値の丸数字', () => {
  const at = (id: string, key: number): string => describeSkillShort(getSkill(id), slotAttack(5, key));

  it('種類と値だけ（計算式は出さない）: 攻撃 / ブロック / 回復、複数は「 + 」でつなぐ', () => {
    expect(at('big_attack', 20)).toBe('攻撃 15');
    expect(at('guard', 15)).toBe('ブロック 6');
    expect(at('herb', 12)).toBe('回復 8');
    expect(at('shield_bash', 17)).toBe('攻撃 7 + ブロック 7');
    expect(at('drain', 17)).toBe('攻撃 8 + 回復 5');
    expect(at('ace_strike', 21)).toBe('攻撃 16');
  });

  it('同じ値の連続した攻撃は「×回数」にまとめる（二連斬・乱舞）', () => {
    expect(at('twin_strike', 17)).toBe('攻撃 6×2');
    expect(at('flurry', 17)).toBe('攻撃 6×3');
  });

  it('防具は、被ダメージの上限（と防御の回復）', () => {
    expect(describeSkillShort(getSkill('iron_shield'), 0)).toBe('被ダメージ最大 5');
    expect(describeSkillShort(getSkill('saint_robe'), 0)).toBe('被ダメージ最大 4 + 回復 3');
  });

  it('詳細（計算式）は describeSkill のまま', () => {
    expect(describeSkill(getSkill('big_attack'), slotAttack(5, 20))).toBe('攻撃 POW+5＝15');
  });

  it('丸数字: ①〜⑳、㉑〜㉟。範囲外は (n)', () => {
    expect([1, 5, 10, 11, 20].map(circledNumber)).toEqual(['①', '⑤', '⑩', '⑪', '⑳']);
    expect([21, 35].map(circledNumber)).toEqual(['㉑', '㉟']);
    expect(circledNumber(36)).toBe('(36)');
    expect(circledNumber(0)).toBe('(0)');
  });
});

describe('ビフォーアフター（セット前の比較）', () => {
  it('diffLines: 種類ごとに「いま → 後（差）」。増減は符号と文字で分かる', () => {
    expect(diffLines({ attack: 5, block: 0, heal: 0 }, { attack: 8, block: 0, heal: 0 })).toEqual(['攻撃 5 → 8（+3）']);
    expect(diffLines({ attack: 0, block: 0, heal: 8 }, { attack: 6, block: 0, heal: 0 })).toEqual(['攻撃 なし → 6（+6）', '回復 8 → なし（−8）']);
    expect(diffLines({ attack: 0, block: 6, heal: 0 }, { attack: 7, block: 6, heal: 5 })).toEqual(['攻撃 なし → 7（+7）', 'ブロック 6 → 6（変わらない）', '回復 なし → 5（+5）']);
    expect(diffLines({ attack: 0, block: 0, heal: 0 }, { attack: 0, block: 0, heal: 0 })).toEqual(['効果は変わらない']);
  });

  it('effectTotals: 攻撃は複数回の合計、ブロック・回復は種類ごと', () => {
    expect(effectTotals(getSkill('twin_strike'), slotAttack(5, 17))).toEqual({ attack: 12, block: 0, heal: 0 });
    expect(effectTotals(getSkill('drain'), slotAttack(5, 17))).toEqual({ attack: 8, block: 0, heal: 5 });
    expect(effectTotals(getSkill('herb'), slotAttack(5, 12))).toEqual({ attack: 0, block: 0, heal: 8 });
  });

  it('previewSlot: そのスロットに置いたときの値（空きは通常攻撃）。run は変えない。レリックの補正が入る', () => {
    const run = createRun();
    const slotsBefore = JSON.stringify(run.slots);
    const empty = previewSlot(run, 15, null);
    expect(empty.name).toContain('通常攻撃');
    expect(empty.short).toBe('攻撃 5');
    const placed = previewSlot(run, 15, 'big_attack'); // 15 は POW 5: 大攻撃 POW+5
    expect(placed.short).toBe('攻撃 10');
    expect(diffLines(empty.totals, placed.totals)).toEqual(['攻撃 5 → 10（+5）']);
    expect(JSON.stringify(run.slots)).toBe(slotsBefore);
    run.relics.push(Bracer); // 大攻撃が POW×2+5 に
    expect(previewSlot(run, 15, 'big_attack').short).toBe('攻撃 15');
  });
});
