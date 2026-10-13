import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Slime } from '../src/core/entities/enemies/Slime';
import { ALL_POOL, DEFAULT_PLAYER_SLOTS, ITEM_POOL, SKILL_POOL } from '../src/core/skills/catalog';
import { previewSkill } from '../src/core/skills/preview';
import { getSkill, isItem } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { resolveShrine } from '../src/map/events';
import { CODEX_ITEM_TOTAL, CODEX_SKILL_TOTAL, emptyMeta, isSkillDiscovered } from '../src/meta/Meta';
import { ArtisanTools, HerbalistBag, RELIC_POOL, Whetstone } from '../src/relics/catalog';
import { createRun, START_MAX_HP } from '../src/run/Run';
import { calloutOf } from '../src/ui/callout';
import { noWait, playRound } from './helpers';

const machine = (opts: Partial<ConstructorParameters<typeof BattleMachine>[0]> = {}) =>
  new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, ...opts });
const effectAt = (id: string, key: number, relics: ConstructorParameters<typeof BattleMachine>[0]['relics'] = [], playerAttack?: number) => {
  const m = machine({ playerSlots: { [key]: id }, relics, playerAttack });
  return previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, key).parts.map((p) => p.value);
};

describe('初期の体力と初期の回復', () => {
  it('冒険の初期の最大 HP は 30', () => {
    expect(START_MAX_HP).toBe(30);
    const run = createRun();
    expect([run.maxHp, run.hp]).toEqual([30, 30]);
  });

  it('初期スロットに薬草（回復の道具）がある（15）', () => {
    expect(DEFAULT_PLAYER_SLOTS[15]).toBe('herb');
    expect(createRun().slots[15]).toBe('herb');
    const m = machine({ playerSlots: createRun().slots });
    expect(previewSkill(m.ctx, m.ctx.player, m.ctx.enemy, 15).parts).toEqual([{ type: 'heal', value: 8 }]);
  });
});

describe('スキルと道具', () => {
  it('道具は kind: item。スキルとは別のプールで、報酬・祠・図鑑に出る', () => {
    expect(ITEM_POOL.every((id) => isItem(getSkill(id)))).toBe(true);
    expect(SKILL_POOL.some((id) => isItem(getSkill(id)))).toBe(false);
    expect(ALL_POOL).toHaveLength(SKILL_POOL.length + ITEM_POOL.length);
    expect(isItem(getSkill('big_attack'))).toBe(false);
  });

  it('道具の効果は固定: スロット・POW の強化に関係なく、いつも同じ', () => {
    for (const [id, value] of [['herb', 8], ['tonic', 14], ['bomb', 10]] as const) {
      const values = [12, 15, 20].flatMap((k) => [effectAt(id, k)[0], effectAt(id, k, [Whetstone], 8)[0]]);
      expect(new Set(values), id).toEqual(new Set([value]));
    }
  });

  it('同じ種類のスキルは、スロットが高いほど強い（道具との違い）', () => {
    expect([12, 20].map((k) => effectAt('shield', k)[0])).toEqual([5, 13]);
    expect(effectAt('herb', 12)[0]).toBe(effectAt('herb', 20)[0]);
  });

  it('爆弾は固定ダメージ（10）。実際の戦闘でも、スロットに関係なく同じ', async () => {
    const low = await playRound({ player: ['5', '8'], enemyHand: ['2', '3'], enemyHp: 99, playerSlots: { 13: 'bomb' } });
    const high = await playRound({ player: ['K', 'K'], enemyHand: ['2', '3'], enemyHp: 99, playerSlots: { 20: 'bomb' } });
    expect(99 - low.ctx.enemy.hp).toBe(10);
    expect(99 - high.ctx.enemy.hp).toBe(10);
  });

  it('大きな表示にも、道具か（固定の効果）が分かる', () => {
    const m = machine({ playerSlots: { 12: 'herb' } });
    (['6', '6'] as Rank[]).forEach((r) => m.ctx.player.hand.add(makeCard(r, 'S')));
    const c = calloutOf(m.ctx, m.ctx.player, m.ctx.enemy)!;
    expect(c).toMatchObject({ name: '薬草', item: true });
    const n = machine();
    (['K', 'K'] as Rank[]).forEach((r) => n.ctx.player.hand.add(makeCard(r, 'S')));
    expect(calloutOf(n.ctx, n.ctx.player, n.ctx.enemy)!.item).toBe(false);
  });
});

describe('道具を強化するレリック', () => {
  it('薬師の鞄: 道具の回復 +5（薬草 8 → 13）。スキルの回復（吸精）には効かない', () => {
    expect(effectAt('herb', 15, [HerbalistBag])).toEqual([13]);
    expect(effectAt('tonic', 15, [HerbalistBag])).toEqual([19]);
    expect(effectAt('drain', 17, [HerbalistBag])).toEqual(effectAt('drain', 17)); // スキルは変わらない
  });

  it('匠の工具: 道具のダメージ +4。スキルのブロック・攻撃には効かない', () => {
    expect(effectAt('bomb', 15, [ArtisanTools])).toEqual([14]);
    expect(effectAt('shield', 15, [ArtisanTools])).toEqual(effectAt('shield', 15));
    expect(effectAt('big_attack', 15, [ArtisanTools])).toEqual(effectAt('big_attack', 15));
  });

  it('実際の戦闘でも効く（薬草 + 薬師の鞄 = 13 回復）。レリックの一覧に入っている', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['K', 'Q', '5'], playerSlots: { 15: 'herb' }, playerHp: 10, relics: [HerbalistBag] });
    expect(m.ctx.player.hp).toBe(23);
    expect(RELIC_POOL).toContain(HerbalistBag);
    expect(RELIC_POOL).toContain(ArtisanTools);
  });
});

describe('図鑑・祠と道具', () => {
  it('薬草は最初から図鑑にあり、ほかの道具は入手すると図鑑に載る', () => {
    const meta = emptyMeta();
    expect(isSkillDiscovered(meta, 'herb')).toBe(true);
    expect(isSkillDiscovered(meta, 'bomb')).toBe(false);
    meta.codex.skills.push('bomb');
    expect(isSkillDiscovered(meta, 'bomb')).toBe(true);
  });

  it('図鑑の総数は、スキルと道具を分けて数える', () => {
    expect(CODEX_ITEM_TOTAL).toBe(ITEM_POOL.length);
    expect(CODEX_SKILL_TOTAL).toBeGreaterThan(SKILL_POOL.length - 1);
  });

  it('祠の「古き技の記憶」は、スキルだけを授かる（道具はショップでだけ買える）', () => {
    const got = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      const run = createRun();
      const r = resolveShrine(run, seededRng(seed));
      if (r.id === 'old-art') got.add(run.inventory[0]);
    }
    expect(got.size).toBeGreaterThan(0);
    expect([...got].every((id) => SKILL_POOL.includes(id))).toBe(true);
  });
});
