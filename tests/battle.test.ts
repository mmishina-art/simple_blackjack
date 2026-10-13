import { describe, expect, it } from 'vitest';
import type { AudioManager } from '../src/audio/AudioManager';
import { bindBattleSounds } from '../src/audio/bindBattleSounds';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { TRANSITIONS, type PlayerInput } from '../src/core/battle/types';
import { DealerAI } from '../src/core/entities/enemies/ai/DealerAI';
import { Slime } from '../src/core/entities/enemies/Slime';
import { seededRng } from '../src/core/util/Rng';
import { makeCard, type Rank } from '../src/core/cards/Card';
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

  it('敵が先に引いて確定 → プレイヤーが配牌・入力 → Stand したらすぐ Initiative → FirstAction へ進む', async () => {
    const m = machine(3);
    const visited = await play(m, () => 'stand');
    expect(visited.slice(0, 7)).toEqual(['Init', 'Deal', 'EnemyAction', 'PlayerDeal', 'PlayerAction', 'Initiative', 'FirstAction']);
    expect(visited.at(-1)).toBe('CheckDeath');
  });

  it('敵の行動（ドロー）は必ずプレイヤーの配牌より前で、プレイヤーの行動後に敵が引き直すことはない', async () => {
    const m = machine(14);
    const visited = await play(m, (b) => (b.ctx.player.hand.total(b.ctx.rules) < 14 ? 'hit' : 'stand'));
    visited.forEach((s, i) => {
      if (s === 'EnemyAction') expect(visited.slice(i - 1, i + 2)).toEqual(['Deal', 'EnemyAction', 'PlayerDeal']);
      if (s === 'PlayerAction') expect(visited[i + 1]).not.toBe('EnemyAction');
    });
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

  it('初手が21（ブラックジャック）でも自動では進まず、Stand を待つ', async () => {
    const m = machine(3);
    m.bus.on('onCardDrawn', (p) => (p.entity.id === 'player' && p.entity.hand.size < 2
      ? { ...p, card: makeCard(p.entity.hand.size === 0 ? 'A' : 'K', 'S') }
      : undefined));
    const seen: string[] = [];
    let waited = false;
    m.onChange(() => {
      if (m.state && seen.at(-1) !== m.state) seen.push(m.state);
      if (!m.canAct) return;
      if (!waited) {
        waited = true;
        // 入力待ちの時点では、まだ行動順の決定へ進んでいない
        expect(m.ctx.player.hand.total(m.ctx.rules)).toBe(21);
        expect(seen.at(-1)).toBe('PlayerAction');
        expect(seen).not.toContain('Initiative');
      }
      queueMicrotask(() => m.submit('stand'));
    });
    await m.run();
    expect(waited).toBe(true);
    expect(m.logs).toContain('ブラックジャック！ あなたのターン');
    expect(seen.indexOf('Initiative')).toBeGreaterThan(seen.indexOf('PlayerAction'));
  });

  it('サレンダー: 自分のスキルは発動せず、敵だけが行動する（行動順の比較はしない）', async () => {
    const m = machine(9);
    const visited = await play(m, () => 'surrender');
    const i = visited.indexOf('Surrender');
    expect(visited.slice(i - 1, i + 3)).toEqual(['PlayerAction', 'Surrender', 'Initiative', 'FirstAction']);
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

interface InputSnapshot {
  round: number;
  cards: string[];
  hidden: boolean[];
  visible: number;
  settled: boolean;
  playerCards: number;
}

/**
 * プレイヤーの入力待ちのたびに敵の手札を記録し（ラウンドごと）、行動順の決定後（FirstAction）の敵の手札も記録して、最後まで走らせる。
 * 初手が21でも入力待ちは発生する（自動では進まない）。
 */
async function observeBattle(m: BattleMachine, policy: (m: BattleMachine) => PlayerInput) {
  const { enemy, player, rules } = m.ctx;
  const inputs: InputSnapshot[] = [];
  const actions = new Map<number, string[]>();
  m.onChange(() => {
    if (m.state === 'FirstAction' && !actions.has(m.ctx.round)) actions.set(m.ctx.round, enemy.hand.cards.map((c) => c.suit + c.rank));
    if (!m.canAct) return;
    if (!inputs.some((i) => i.round === m.ctx.round)) {
      inputs.push({
        round: m.ctx.round,
        cards: enemy.hand.cards.map((c) => c.suit + c.rank),
        hidden: enemy.hand.cards.map((c) => enemy.hand.isFaceDown(c)),
        visible: enemy.hand.visibleTotal(rules),
        settled: m.ctx.enemyDef.ai.decide(enemy, player, rules) === 'stand' || enemy.hand.isBust(rules),
        playerCards: player.hand.size,
      });
    }
    queueMicrotask(() => m.submit(policy(m)));
  });
  await m.run();
  return { inputs, actions };
}

/** 1ラウンド目の配牌を固定する（敵 K,3 → 13 なのでヒット → K でバースト / プレイヤー 5,6）。スライムは14以上で止まる。 */
function forceFirstRound(m: BattleMachine) {
  const forced = { enemy: ['K', '3', 'K'] as Rank[], player: ['5', '6'] as Rank[] };
  m.bus.on('onCardDrawn', (p) => {
    const queue = p.entity.id === 'enemy' ? forced.enemy : forced.player;
    return queue.length ? { ...p, card: makeCard(queue.shift()!, p.entity.id === 'enemy' ? 'H' : 'S') } : undefined;
  });
}

describe('敵先行のラウンド（敵の手札が先に確定し、最後の1枚だけ伏せられる）', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])('seed %i: プレイヤーの入力時点で敵は引き終えており、伏せは最後の1枚だけ', async (seed) => {
    const { inputs } = await observeBattle(machine(seed), () => 'stand');
    expect(inputs.length).toBeGreaterThan(0);
    for (const i of inputs) {
      expect(i.playerCards).toBe(2);
      expect(i.settled).toBe(true); // AI がこれ以上引かない（またはバースト）状態
      expect(i.hidden.at(-1)).toBe(true);
      expect(i.hidden.filter(Boolean)).toHaveLength(1);
    }
  });

  it('プレイヤーが何回 Hit しても敵の手札は変わらず、行動順の決定で伏せカードが公開される', async () => {
    const m = machine(4);
    const { inputs, actions } = await observeBattle(m, (b) => (b.ctx.player.hand.total(b.ctx.rules) < 12 ? 'hit' : 'stand'));
    expect(inputs.length).toBeGreaterThan(0);
    for (const i of inputs) if (actions.has(i.round)) expect(actions.get(i.round)).toEqual(i.cards);
  });

  it('撤退しても敵の手札は確定済み（追加ドローなし）で、そのまま Initiative で公開される', async () => {
    const m = machine(6);
    const { inputs, actions } = await observeBattle(m, () => 'surrender');
    expect(inputs.length).toBeGreaterThan(0);
    for (const i of inputs) if (actions.has(i.round)) expect(actions.get(i.round)).toEqual(i.cards);
    expect(m.logs.some((l) => l.includes('防御に徹した'))).toBe(true);
  });

  it('伏せカードでバーストしていても、入力時点では公開札しか見えず合計は不明のまま', async () => {
    const m = machine(2);
    forceFirstRound(m);
    const { inputs } = await observeBattle(m, () => 'stand');
    expect(inputs[0]).toMatchObject({ round: 1, cards: ['HK', 'H3', 'HK'], hidden: [false, false, true], visible: 13, playerCards: 2 });
    const settled = m.logs.findIndex((l) => l.includes('枚で手札を決めた'));
    const turn = m.logs.findIndex((l) => l.includes('あなたのターン'));
    const bust = m.logs.findIndex((l) => l.includes('スライムはバースト'));
    expect(settled).toBeGreaterThanOrEqual(0);
    expect(turn).toBeGreaterThan(settled);
    expect(bust).toBeGreaterThan(turn); // バーストは伏せカードが公開されたあとに分かる
  });

  it('敵のバースト音は、伏せカードがめくられる行動順の発表まで鳴らない（情報を漏らさない）', async () => {
    const m = machine(2);
    forceFirstRound(m);
    const sfx: string[] = [];
    bindBattleSounds(m, { sfx: (name: string) => { sfx.push(name); } } as unknown as AudioManager);
    const heard: string[][] = [];
    m.onChange(() => {
      if (!m.canAct) return;
      if (heard.length === 0) heard.push([...sfx]);
      queueMicrotask(() => m.submit('stand'));
    });
    await m.run();
    expect(heard[0]).not.toContain('bust');
    expect(sfx).toContain('bust');
  });

  describe('効果音は、実際に起きたときだけ鳴る（予測表示では鳴らない）', () => {
    const bind = (m: BattleMachine) => {
      const heard: string[] = [];
      bindBattleSounds(m, { sfx: (name: string) => { heard.push(name); } } as unknown as AudioManager);
      return heard;
    };

    it('スロット表・予測のために効果を計算しても、Block や回復の音は鳴らない', async () => {
      const { previewAllSlots } = await import('../src/core/skills/preview');
      const m = machine(1);
      const heard = bind(m);
      for (let i = 0; i < 5; i++) {
        previewAllSlots(m.ctx, m.ctx.player, m.ctx.enemy, [11, 15, 18, 20, 21]);
        previewAllSlots(m.ctx, m.ctx.enemy, m.ctx.player, [11, 15, 18, 20, 21]);
      }
      expect(heard).toEqual([]);
    });

    it('Block のスキルが実際に発動したときは、block が1回だけ鳴る', async () => {
      const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait });
      const heard = bind(m);
      ['7', '8'].forEach((r) => m.ctx.player.hand.add(makeCard(r as Rank, 'S')));   // 15: シールド
      ['K', 'Q', '5'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as Rank, 'H'))); // 敵はバースト（攻撃が来ないので、防ぐ音は鳴らない）
      await m.runFrom('Initiative', ['Deal']);
      expect(heard.filter((s) => s === 'block')).toHaveLength(1);
      expect(heard).not.toContain('guard');
    });

    it('Block が攻撃を防いだときは、guard が鳴る（Block を得る音とは別）', async () => {
      const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, playerBlock: 20 });
      const heard = bind(m);
      ['K', 'Q', '5'].forEach((r) => m.ctx.player.hand.add(makeCard(r as Rank, 'S')));
      ['9', '9'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as Rank, 'H')));
      await m.runFrom('Initiative', ['Deal']);
      expect(heard.filter((s) => s === 'guard')).toHaveLength(1);
      expect(heard).not.toContain('damage');
      expect(heard).not.toContain('block');
    });

    it('回復のスキルが発動したときは、heal が1回だけ鳴る', async () => {
      const m = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait, playerSlots: { 15: 'recover' }, playerHp: 30 });
      const heard = bind(m);
      ['7', '8'].forEach((r) => m.ctx.player.hand.add(makeCard(r as Rank, 'S')));
      ['K', 'Q', '5'].forEach((r) => m.ctx.enemy.hand.add(makeCard(r as Rank, 'H')));
      await m.runFrom('Initiative', ['Deal']);
      expect(heard.filter((s) => s === 'heal')).toHaveLength(1);
    });

    it('伏せカードがめくられたときだけ flip が鳴る（伏せがなければ鳴らない）', async () => {
      const withHidden = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait });
      const heardA = bind(withHidden);
      ['K', 'K'].forEach((r) => withHidden.ctx.player.hand.add(makeCard(r as Rank, 'S')));
      withHidden.ctx.enemy.hand.add(makeCard('9', 'H'));
      withHidden.ctx.enemy.hand.add(makeCard('9', 'H'), { faceDown: true });
      await withHidden.runFrom('Initiative', ['Deal']);
      expect(heardA.filter((s) => s === 'flip')).toHaveLength(1);

      const none = new BattleMachine({ enemy: Slime, rng: seededRng(1), pace: noWait });
      const heardB = bind(none);
      ['K', 'K'].forEach((r) => none.ctx.player.hand.add(makeCard(r as Rank, 'S')));
      ['9', '9'].forEach((r) => none.ctx.enemy.hand.add(makeCard(r as Rank, 'H')));
      await none.runFrom('Initiative', ['Deal']);
      expect(heardB).not.toContain('flip');
    });
  });

  it('遷移表: プレイヤーの勝負後に敵へ戻る遷移や、敵の行動から直接 Initiative へ進む遷移は存在しない', () => {
    expect(TRANSITIONS.PlayerAction).not.toContain('EnemyAction');
    expect(TRANSITIONS.Surrender).toEqual(['Initiative']);
    expect(TRANSITIONS.EnemyAction).toEqual(['PlayerDeal']);
    expect(TRANSITIONS.Deal).toEqual(['EnemyAction']);
  });
});

describe('ラウンドの行動順', () => {
  it('合計値が大きい方が先攻: 先攻の攻撃 → 後攻の攻撃', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'] }); // 20 vs 18
    expect(m.ctx.turn).toMatchObject({ mode: 'sequential', first: 'player', second: 'enemy' });
    expect(m.ctx.enemy.hp).toBe(1);   // 16 - 大攻撃（20 は ATK 10: ATK+5 = 15）
    expect(m.ctx.player.hp).toBe(52); // 60 - 溶解8
  });

  it('生存確認: 先攻が倒したら後攻は行動しない', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 10 });
    expect(m.ctx.winner).toBe(m.ctx.player);
    expect(m.ctx.player.hp).toBe(60);
  });

  it('プレイヤーがバースト: スキルは発動せず、受けるダメージが1.5倍。敵は通常どおり行動する', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'] }); // 25 vs 18
    expect(m.ctx.turn).toMatchObject({ mode: 'bustSkip', first: 'enemy', second: null });
    expect(m.ctx.player.hp).toBe(60 - 12);  // 溶解8 ×1.5
    expect(m.ctx.enemy.hp).toBe(16);        // プレイヤーは行動不能
  });

  it('敵がバースト: 敵のスキルは発動せず、受けるダメージが1.5倍。プレイヤーは通常どおり行動する', async () => {
    const m = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q', '5'], enemyHp: 40 });
    expect(m.ctx.enemy.hp).toBe(40 - 22); // 大攻撃 ATK+5 = 15 ×1.5（端数切り捨て）
    expect(m.ctx.player.hp).toBe(60);
  });

  it('両者バースト: 誰も行動しない', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['K', 'Q', '4'] });
    expect(m.ctx.player.hp).toBe(60);
    expect(m.ctx.enemy.hp).toBe(16);
  });

  it('スロット21は会心の一撃（ATK×1.5）。ブラックジャック（初手21）でも特別な効果はない', async () => {
    const m = await playRound({ player: ['7', '7', '7'], enemyHand: ['9', '9'], enemyHp: 40 });
    expect(m.ctx.enemy.hp).toBe(40 - 16); // 21 は ATK 11: ATK×1.5
    const bj = await playRound({ player: ['A', 'K'], enemyHand: ['9', '9'], enemyHp: 40 });
    expect(bj.ctx.enemy.hp).toBe(40 - 16);
  });

  it('未設定スロットでは基本攻撃が発動する', async () => {
    const m = await playRound({ player: ['6', '7'], enemyHand: ['3', '4'], enemyHp: 40 }); // 13 vs 7
    expect(m.ctx.enemy.hp).toBe(37); // 13 は ATK 3: 通常攻撃 = ATK×1 = 3
  });
});

describe('バーストのペナルティ（受けるダメージ 1.5倍）', () => {
  const give = (m: BattleMachine, who: 'player' | 'enemy', ranks: Rank[]) => {
    m.ctx[who].hand.clear();
    ranks.forEach((r) => m.ctx[who].hand.add(makeCard(r, who === 'player' ? 'S' : 'H')));
  };

  it('倍率は RuleSet の bustDamageMultiplier で変えられる（1 なら等倍に戻る）', async () => {
    const plain = { bustDamageMultiplier: 1 };
    const p = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], rules: plain });
    expect(p.ctx.player.hp).toBe(60 - 8);
    const e = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q', '5'], enemyHp: 40, rules: plain });
    expect(e.ctx.enemy.hp).toBe(40 - 15);
    const x2 = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], rules: { bustDamageMultiplier: 2 } });
    expect(x2.ctx.player.hp).toBe(60 - 16);
  });

  it('バーストしていない側は等倍: 先攻・後攻・同値のどれでも増えない', async () => {
    const seq = await playRound({ player: ['K', 'K'], enemyHand: ['9', '9'], enemyHp: 40 }); // 20 vs 18
    expect(40 - seq.ctx.enemy.hp).toBe(15);
    expect(seq.ctx.player.hp).toBe(60 - 8);
    expect(seq.logs.some((l) => l.includes('バースト'))).toBe(false);
    const tie = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q'], enemyHp: 40 }); // 20 vs 20
    expect(40 - tie.ctx.enemy.hp).toBe(15);
    expect(tie.logs.some((l) => l.includes('バースト'))).toBe(false);
  });

  it('端数は切り捨てる（通常攻撃 3 → 4）', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['3', '4'] }); // 敵 7: ぬめる体当たり 3
    expect(m.ctx.player.hp).toBe(60 - 4);
  });

  it('Block は、増えたあとのダメージを先に吸収する（溶解 8 → 12、Block 5 で吸収して HP -7）', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], playerBlock: 5 });
    expect(m.ctx.player.block).toBe(0);
    expect(m.ctx.player.hp).toBe(60 - 7);
  });

  it('レリックの補正のあとに掛かる（鋼の胸当て: (8 - 2) × 1.5 = 9）', async () => {
    const { Breastplate } = await import('../src/relics/catalog');
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], relics: [Breastplate] });
    expect(m.ctx.player.hp).toBe(60 - 9);
  });

  it('身代わりの人形で防いだあとの2回目のバーストは、1.5倍のダメージを受ける', async () => {
    const { ScapegoatDoll } = await import('../src/relics/catalog');
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], relics: [ScapegoatDoll] });
    expect(m.ctx.player.hp).toBe(60); // 最初のバーストは、敵も行動しない
    give(m, 'player', ['K', 'Q', '5']);
    give(m, 'enemy', ['9', '9']);
    await m.runFrom('Initiative', ['Deal']);
    expect(m.ctx.player.hp).toBe(60 - 12);
  });

  it('両者バーストなら誰も行動しないので、倍率の出番はない', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['K', 'Q', '4'] });
    expect(m.ctx.player.hp).toBe(60);
    expect(m.ctx.enemy.hp).toBe(16);
    expect(m.logs.some((l) => l.includes('バースト ×'))).toBe(false);
  });

  it('ログ: バーストの発表と、倍率がかかった攻撃が分かる', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'] });
    expect(m.logs).toContain('あなたはバースト！ スキル不発・受けるダメージ1.5倍');
    expect(m.logs).toContain('スライムだけが行動する');
    expect(m.logs).toContain('あなたに12ダメージ（バースト ×1.5）');
    const e = await playRound({ player: ['K', 'K'], enemyHand: ['K', 'Q', '5'], enemyHp: 40 });
    expect(e.logs).toContain('スライムはバースト！ スキル不発・受けるダメージ1.5倍');
    expect(e.logs).toContain('スライムに22ダメージ（バースト ×1.5）');
  });

  it('Block で全部防いだときも、倍率がかかったことが分かる', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], playerBlock: 20 });
    expect(m.ctx.player.hp).toBe(60);
    expect(m.ctx.player.block).toBe(8); // 12 を吸収
    expect(m.logs).toContain('あなたは Block で防いだ（12・バースト ×1.5）');
  });

  it('ログ: Block を一部消費したときは、同じ括弧にまとめて出る', async () => {
    const m = await playRound({ player: ['K', 'Q', '5'], enemyHand: ['9', '9'], playerBlock: 5 });
    expect(m.logs).toContain('あなたに7ダメージ（Block 5 を消費・バースト ×1.5）');
  });
});

describe('同時攻撃（同値）', () => {
  it('防御 → 攻撃の順で処理される（同時の Block が同時の攻撃を防ぐ）', async () => {
    const m = await playRound({ player: ['A', '7'], enemyHand: ['9', '9'], playerHp: 50 }); // 18 vs 18
    expect(m.ctx.turn?.mode).toBe('simultaneous');
    expect(m.ctx.player.hp).toBe(50); // 18 は ATK 8: 盾 ATK+3 = Block 11 で溶解8を完全に防ぐ
    expect(m.ctx.player.block).toBe(3);
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
    expect(m.ctx.enemy.hp).toBe(Skeleton.maxHp); // 14 は ATK 4: 通常攻撃 4 - 骨の鎧2 = 2 は盾(6)で防がれる
    expect(m.ctx.enemy.block).toBe(4);
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

describe('Block は後攻でも最初に付与される', () => {
  it('後攻のシールドが、先攻の攻撃より前に入って攻撃を受け止める', async () => {
    // 敵 17（溶解8）が先攻、プレイヤー 15（シールド Block 6）が後攻
    const m = await playRound({ player: ['7', '8'], enemyHand: ['K', '7'] });
    expect(m.ctx.turn).toMatchObject({ first: 'enemy', second: 'player' });
    expect(m.ctx.player.hp).toBe(60 - 2); // 溶解8 - Block6（後攻でも先に付与）
    expect(m.ctx.player.block).toBe(0);
  });

  it('先攻が後攻を倒しても、その Block は先に付与されている（攻撃は Block 後に計算）', async () => {
    const m = await playRound({ player: ['7', '8'], enemyHand: ['K', '7'], playerHp: 8 });
    expect(m.ctx.player.hp).toBe(8 - 2);
    expect(m.ctx.winner).toBeNull();
  });

  it('後攻の攻撃は、先攻の Block が先にあるため通りにくい', async () => {
    const { Skeleton } = await import('../src/core/entities/enemies/catalog');
    // プレイヤー 17（ATK 7、未設定: 通常攻撃7）が先攻、骸骨兵 16（シールド6）が後攻
    const m = await playRound({ player: ['K', '7'], enemyHand: ['8', '8'], enemy: Skeleton });
    expect(m.ctx.turn).toMatchObject({ first: 'player', second: 'enemy' });
    expect(m.ctx.enemy.hp).toBe(Skeleton.maxHp); // 通常攻撃7-骨の鎧2=5 は、後攻の Block 6 に先に防がれる
    expect(m.ctx.enemy.block).toBe(1);
  });
});
