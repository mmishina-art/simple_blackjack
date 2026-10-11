import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import type { PlayerInput } from '../src/core/battle/types';
import { DealerAI } from '../src/core/entities/enemies/ai/DealerAI';
import { Slime } from '../src/core/entities/enemies/Slime';
import { seededRng } from '../src/core/util/Rng';
import { makeCard } from '../src/core/cards/Card';
import { noWait, playRound } from './helpers';

/** 入力待ちのたびに policy で入力を自動送信して最後まで走らせる。 */
async function play(m: BattleMachine, policy: (m: BattleMachine) => PlayerInput) {
  const visited: string[] = [];
  m.onChange(() => {
    if (m.state && visited[visited.length - 1] !== m.state) visited.push(m.state);
    if (m.canAct) queueMicrotask(() => m.submit(policy(m)));
  });
  await m.run();
  return visited;
}

const machine = (seed: number) => new BattleMachine({ enemy: Slime, rng: seededRng(seed), pace: noWait });

describe('BattleMachine の進行', () => {
  it('どちらかのHPが0になるまで進行し、勝者が決まる', async () => {
    const m = machine(42);
    await play(m, (b) => (b.ctx.player.hand.total(b.ctx.rules) < 15 ? 'hit' : 'stand'));
    expect(m.isFinished).toBe(true);
    expect(m.ctx.player.isDead || m.ctx.enemy.isDead).toBe(true);
  });

  it('Stand 後は EnemyAction → Initiative → FirstAction の順に進む', async () => {
    const m = machine(3);
    const visited = await play(m, () => 'stand');
    const i = visited.indexOf('EnemyAction');
    expect(visited.slice(0, 3)).toEqual(['Init', 'Deal', 'PlayerAction']);
    expect(visited.slice(i, i + 3)).toEqual(['EnemyAction', 'Initiative', 'FirstAction']);
    expect(visited.at(-1)).toBe('CheckDeath');
  });

  it('PlayerAction 以外では入力を受け付けない', () => {
    const m = machine(5);
    expect(m.submit('hit')).toBe(false);
    expect(m.canAct).toBe(false);
  });

  it('プレイヤーがバーストしたら EnemyAction を経由せず Initiative へ', async () => {
    const m = machine(11);
    const visited = await play(m, () => 'hit');
    const idx = visited.indexOf('Initiative');
    expect(visited[idx - 1]).toBe('PlayerAction');
    expect(m.ctx.winner).toBe(m.ctx.enemy);
  });

  it('サレンダー: 自分のスキルは発動せず、敵だけが行動する（行動順の比較はしない）', async () => {
    const m = machine(9);
    const visited = await play(m, () => 'surrender');
    const i = visited.indexOf('Surrender');
    expect(visited.slice(i, i + 4)).toEqual(['Surrender', 'EnemyAction', 'Initiative', 'FirstAction']);
    expect(m.isFinished).toBe(true);
  });

  it('敵ディーラーは17以上になるまで引く', () => {
    const ai = new DealerAI(17);
    const m = machine(1);
    const { enemy, player, rules } = m.ctx;
    m.ctx.draw(enemy);
    while (enemy.hand.total(rules) < 17) {
      expect(ai.decide(enemy, player, rules)).toBe('hit');
      m.ctx.draw(enemy);
    }
    expect(ai.decide(enemy, player, rules)).toBe('stand');
  });

  it('フック: onCardDrawn でカードの数字を変えられる', async () => {
    const m = machine(8);
    m.bus.on('onCardDrawn', (p) => { p.card.value = 5; });
    await play(m, () => 'stand');
    expect(m.ctx.player.hand.cards.every((c) => c.value === 5)).toBe(true);
  });

  it('フック: onSkillActivated で不発にできる', async () => {
    const { BattleMachine: M } = await import('../src/core/battle/BattleMachine');
    const { makeCard } = await import('../src/core/cards/Card');
    const m = new M({ enemy: Slime, rng: seededRng(1), pace: noWait });
    m.bus.on('onSkillActivated', (p) => (p.user.id === 'player' ? { ...p, skill: null } : undefined));
    ['K', 'K'].forEach((r) => m.ctx.player.hand.add(makeCard(r as never, 'S')));
    ['9', '9'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as never, 'H')));
    await m.runFrom('Initiative', ['Deal']);
    expect(m.ctx.enemy.hp).toBe(16); // プレイヤーのスキルは不発
  });
});

describe('ラウンドの行動順', () => {
  it('合計値が大きい方が先攻: 先攻の攻撃 → 後攻の攻撃', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'] }); // 20 vs 18
    expect(m.ctx.turn).toMatchObject({ mode: 'sequential', first: 'player', second: 'enemy' });
    expect(m.ctx.enemy.hp).toBe(6);   // 16 - 大攻撃(ATK+5=10)
    expect(m.ctx.player.hp).toBe(52); // 60 - 溶解8
  });

  it('生存確認: 先攻が倒したら後攻は行動しない', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 10 });
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(60);
  });

  it('プレイヤーがバースト: スキルは発動しないだけ。敵は通常どおり行動する', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'] }); // 25 vs 18
    expect(m.ctx.turn).toMatchObject({ mode: 'bustSkip', first: 'enemy', second: null });
    expect(m.ctx.player.hp).toBe(60 - 8);   // 溶解8
    expect(m.ctx.enemy.hp).toBe(16);        // プレイヤーは行動不能
  });

  it('敵がバースト: 敵のスキルは発動しない。プレイヤーは通常どおり行動する', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q', '5'], enemyHp: 40 });
    expect(m.ctx.enemy.hp).toBe(40 - 10); // 大攻撃 ATK+5
    expect(m.ctx.player.hp).toBe(60);
  });

  it('両者バースト: 誰も行動しない', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['K', 'Q', '4'] });
    expect(m.ctx.player.hp).toBe(60);
    expect(m.ctx.enemy.hp).toBe(16);
  });

  it('スロット21は会心の一撃（ATK×3）。ブラックジャック（初手21）でも特別な効果はない', async () => {
    const m = await playRound({ player: ['7', '7', '7'], enemyHand: ['9', '9'], enemyHp: 40 });
    expect(m.ctx.enemy.hp).toBe(40 - 15); // ATK×3
    const bj = await playRound({ player: ['A', 'K'], enemyHand: ['9', '9'], enemyHp: 40 });
    expect(bj.ctx.enemy.hp).toBe(40 - 15);
  });

  it('未設定スロットでは基本攻撃が発動する', async () => {
    const m = await playRound({ player: ['6', '7'], enemyHand: ['3', '4'], enemyHp: 40 }); // 13 vs 7
    expect(m.ctx.enemy.hp).toBe(35); // 通常攻撃 = ATK×1 = 5
  });
});

describe('同時攻撃（同値）', () => {
  it('防御 → 攻撃の順で処理される（同時の Block が同時の攻撃を防ぐ）', async () => {
    const m = await playRound({ player: ['A', '7'], enemyHand: ['9', '9'], playerHp: 50 }); // 18 vs 18
    expect(m.ctx.turn?.mode).toBe('simultaneous');
    expect(m.ctx.player.hp).toBe(50); // 盾 Block 8 で溶解8を完全に防ぐ
    expect(m.ctx.player.block).toBe(0);
  });

  it('同時のシールドは同時の攻撃を防ぎ、余った Block は持ち越される', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['8', '7'] }); // 15 vs 15
    expect(m.ctx.player.hp).toBe(60); // 敵の酸5はBlock6で吸収
    expect(m.ctx.player.block).toBe(1); // 残り1は次のラウンドへ
  });

  it('相打ちはプレイヤー敗北', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'K'], playerHp: 5, enemyHp: 5 });
    expect(m.ctx.winner).toBe(m.ctx.enemy);
  });
});

describe('Block とサレンダー', () => {
  it('先攻の Block が後攻の攻撃を防ぎ、余りは持ち越される', async () => {
    const { Skeleton } = await import('../src/core/entities/enemies/catalog');
    const m = await playRound({ player: ['6', '8'], enemyHand: ['8', '8'], enemy: Skeleton }); // 14 vs 16
    expect(m.ctx.turn?.first).toBe('enemy');
    expect(m.ctx.enemy.hp).toBe(Skeleton.maxHp); // 通常攻撃5 - 骨の鎧2 = 3 は盾(6)で防がれる
    expect(m.ctx.enemy.block).toBe(3);
  });

  it('サレンダー: Block 5 を得て、敵の攻撃を受け止める。自分のスキルは不発', async () => {
    const m = await playRound({ player: ['K', '5'], enemyHand: ['9', '9'], from: 'Surrender' });
    expect(m.ctx.turn?.mode).toBe('defend');
    expect(m.ctx.player.hp).toBe(60 - 3); // 溶解8 - Block5
    expect(m.ctx.enemy.hp).toBe(16);       // 自分は行動していない
  });

  it('サレンダーの Block もレリックの影響を受ける（堅牢の盾 +3）', async () => {
    const { SturdyShield } = await import('../src/relics/catalog');
    const m = await playRound({ player: ['K', '5'], enemyHand: ['9', '9'], from: 'Surrender', relics: [SturdyShield] });
    expect(m.ctx.player.hp).toBe(60); // Block 8 で溶解8を完全に防ぐ
  });

  it('サレンダー中に敵がバーストしたら誰も行動しない', async () => {
    const m = await playRound({ player: ['K', '5'], enemyHand: ['K', 'Q', '5'], from: 'Surrender' });
    expect(m.ctx.player.hp).toBe(60);
  });
});

describe('Block の持ち越し', () => {
  it('Block は戦闘中ラウンドをまたいで残り、次のラウンドの攻撃も吸収する', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['6', '8'], stopAt: ['Deal'] }); // 15 vs 14: 盾6, 敵の酸5
    expect(m.ctx.player.block).toBe(1);
    // 次のラウンド: プレイヤーが防御（Block+5 → 6）、敵の溶解8
    m.ctx.player.hand.clear();
    m.ctx.enemy.hand.clear();
    ['K', '5'].forEach((r) => m.ctx.player.hand.add(makeCard(r as never, 'S')));
    ['9', '9'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as never, 'H')));
    await m.runFrom('Surrender', ['Deal']);
    expect(m.ctx.player.block).toBe(0);
    expect(m.ctx.player.hp).toBe(60 - 2); // 持ち越し1 + サレンダー5 = 6、溶解8 → 2通る
  });
});
