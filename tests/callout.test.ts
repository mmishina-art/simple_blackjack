import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Slime } from '../src/core/entities/enemies/Slime';
import { seededRng } from '../src/core/util/Rng';
import { Whetstone } from '../src/relics/catalog';
import { calloutOf, fxChips } from '../src/ui/callout';
import { noWait } from './helpers';

const machine = (opts: Partial<ConstructorParameters<typeof BattleMachine>[0]> = {}) =>
  new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, ...opts });
const give = (m: BattleMachine, who: 'player' | 'enemy', ranks: Rank[]) => ranks.forEach((r) => m.ctx[who].hand.add(makeCard(r, 'S')));

describe('発動するスキルの大きな表示（calloutOf / fxChips）', () => {
  it('名前・アイコン・効果の数値を出す（20 = 大攻撃 15ダメージ）', () => {
    const m = machine();
    give(m, 'player', ['K', 'K']);
    const c = calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)!;
    expect(c).toMatchObject({ name: '大攻撃', icon: '大', rarity: 'rare', fizzled: false });
    expect(fxChips(c.parts, c.targetBlock)).toEqual([{ type: 'attack', main: '15', unit: 'ダメージ', note: undefined }]);
  });

  it('Block・回復は +数 と単位。複数の効果は並べる', () => {
    const m = machine({ playerSlots: { 17: 'drain', 16: 'shield_bash', 15: 'guard' } });
    give(m, 'player', ['9', '8']); // 17: 吸精（攻撃+回復）
    const c = calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)!;
    expect(fxChips(c.parts, 0).map((x) => `${x.main}${x.unit}`)).toEqual(['8ダメージ', '+4HP']) // 17 は ATK 7 + 1;
    const n = machine({ playerSlots: { 15: 'guard' } });
    give(n, 'player', ['7', '8']);
    expect(fxChips(calloutOf(n.ctx, n.ctx.player, n.ctx.enemy)!.parts, 0)).toEqual([{ type: 'block', main: '+6', unit: 'Block' }]);
  });

  it('空きスロットは「通常攻撃」と明記する。敵の Block に吸収されたあとの値も添える', () => {
    const m = machine();
    give(m, 'player', ['6', '7']); // 13: 空き
    m.ctx.enemy.block = 2;
    const c = calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)!;
    expect(c).toMatchObject({ name: '通常攻撃', icon: '攻' });
    expect(fxChips(c.parts, c.targetBlock)[0]).toMatchObject({ main: '3', note: 'Block吸収後 1' }); // 13 は ATK 3
  });

  it('レリックの補正が出る（砥石: 大攻撃 ATK 12 + 5 = 17）', () => {
    const m = machine({ relics: [Whetstone] });
    give(m, 'player', ['K', 'K']);
    expect(fxChips(calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)!.parts, 0)[0].main).toBe('17');
  });

  it('手札が空・バーストのときは出さない（別の文言になる）', () => {
    const m = machine();
    expect(calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)).toBeNull();
    give(m, 'player', ['K', 'Q', '5']);
    expect(calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)).toBeNull();
  });

  it('敵のスキルも同じ形で出る（スライム 18 = 溶解 8ダメージ）', () => {
    const m = machine();
    give(m, 'enemy', ['9', '9']);
    const c = calloutOf(m.ctx, m.ctx.enemy, m.ctx.player)!;
    expect(c.name).toBe('溶解');
    expect(fxChips(c.parts, 0)[0].main).toBe('8');
  });
});
