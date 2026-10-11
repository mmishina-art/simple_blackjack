import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { DealerAI } from '../src/core/entities/enemies/ai/DealerAI';
import { Slime } from '../src/core/entities/enemies/Slime';
import { seededRng } from '../src/core/util/Rng';

const noWait = async () => {};

/** 入力待ちのたびに policy で Hit/Stand を自動入力して最後まで走らせる。 */
async function play(m: BattleMachine, policy: (m: BattleMachine) => 'hit' | 'stand') {
  const visited: string[] = [];
  m.onChange(() => {
    if (m.state && visited[visited.length - 1] !== m.state) visited.push(m.state);
    if (m.canAct) queueMicrotask(() => m.submit(policy(m)));
  });
  await m.run();
  return visited;
}

describe('BattleMachine', () => {
  it('どちらかのHPが0になるまで進行し、勝者が決まる', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(42), pace: noWait });
    const standAt15 = (b: BattleMachine) => (b.ctx.player.hand.total(b.ctx.rules) < 15 ? 'hit' : 'stand');
    await play(m, standAt15);
    expect(m.isFinished).toBe(true);
    expect(m.ctx.winner).not.toBeNull();
    expect(m.ctx.player.isDead || m.ctx.enemy.isDead).toBe(true);
    expect(m.ctx.player.hp).toBeGreaterThanOrEqual(0);
  });

  it('許可された遷移のみを辿る', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(3), pace: noWait });
    const visited = await play(m, () => 'stand');
    expect(visited[0]).toBe('Init');
    expect(visited[1]).toBe('Deal');
    expect(visited[2]).toBe('PlayerAction');
    expect(visited.at(-1)).toBe('CheckDeath');
  });

  it('PlayerAction 以外では入力を受け付けない', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(5), pace: noWait });
    expect(m.submit('hit')).toBe(false);
    expect(m.canAct).toBe(false);
  });

  it('プレイヤーがバーストしたら EnemyAction を経由せず Resolve へ', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(11), pace: noWait });
    const visited = await play(m, () => 'hit'); // 常に Hit → いずれバースト
    const firstBust = visited.indexOf('Resolve');
    expect(visited[firstBust - 1]).toBe('PlayerAction');
    expect(m.ctx.winner).toBe(m.ctx.enemy);
  });

  it('敵ディーラーは17以上になるまで引く', () => {
    const ai = new DealerAI(17);
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait });
    const { enemy, player, rules } = m.ctx;
    m.ctx.draw(enemy);
    while (enemy.hand.total(rules) < 17) {
      expect(ai.decide(enemy, player, rules)).toBe('hit');
      m.ctx.draw(enemy);
    }
    expect(ai.decide(enemy, player, rules)).toBe('stand');
  });

  it('フック: onCardDrawn でカードの数字を変え、onDamageCalculated でダメージを改変できる', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(8), pace: noWait });
    const seen: string[] = [];
    m.bus.on('onCardDrawn', (p) => {
      seen.push(p.entity.id);
      p.card.value = 5; // 全カードを5として扱う（A は 5 / 15 になる）
    });
    m.bus.on('onDamageCalculated', (p) => ({ ...p, damage: 999 }));
    await play(m, () => 'stand');
    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(m.ctx.lastDamage?.damage).toBe(999);
    expect(m.isFinished).toBe(true);
  });

  it('フック: onBust が発火する', async () => {
    const m = new BattleMachine({ enemy: Slime, rng: seededRng(11), pace: noWait });
    const busted: string[] = [];
    m.bus.on('onBust', (p) => { busted.push(p.entity.id); });
    await play(m, () => 'hit');
    expect(busted).toContain('player');
  });

  it('フック: レリックで bustLimit を24にできる', () => {
    const m = new BattleMachine({
      enemy: Slime,
      rng: seededRng(2),
      pace: noWait,
      relics: [{ id: 'r', name: 'r', apply: (_bus, rules) => { rules.bustLimit = 24; } }],
    });
    expect(m.ctx.rules.bustLimit).toBe(24);
  });
});
