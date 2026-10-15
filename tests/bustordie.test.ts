import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeCard, type Rank } from '../src/core/cards/Card';
import { Entity } from '../src/core/entities/Entity';
import { damageDealtMultiplier, isBustOrDie } from '../src/core/rules/bust';
import { createRuleSet } from '../src/core/rules/RuleSet';
import { getSkill } from '../src/core/skills/Skill';
import { Slime } from '../src/core/entities/enemies/Slime';
import { playRound } from './helpers';

const rules = createRuleSet();
const withHand = (id: 'player' | 'enemy', ...ranks: Rank[]) => {
  const e = new Entity(id, id, 30, {}, 'basic_attack', 5);
  ranks.forEach((r) => e.hand.add(makeCard(r, 'S')));
  return e;
};
// スライムの 21 は必殺の酸の奔流（POW3 + 2 = 5）。2 倍で 10
const DELUGE = 5;

describe('BUST or DIE: 敵の 21 は攻撃 2 倍', () => {
  it('倍率は RuleSet の enemy21Multiplier（既定 2）。敵の 21 だけで、プレイヤーの 21 や敵の 20 には掛からない', () => {
    expect(rules.enemy21Multiplier).toBe(2);
    expect(damageDealtMultiplier(withHand('enemy'), 21, rules)).toBe(2);
    expect(damageDealtMultiplier(withHand('enemy'), 20, rules)).toBe(1);
    expect(damageDealtMultiplier(withHand('player'), 21, rules)).toBe(1);
  });
  it('戦闘: 敵 21（酸の奔流 5）が先攻 → 2 倍の 10 ダメージ。倍率 1 なら 5', async () => {
    expect(getSkill(Slime.slots[21]!).id).toBe('slime_deluge');
    const m = await playRound({ player: ['K', '6'], enemyHand: ['K', 'A'], playerMaxHp: 60, playerHp: 60, enemyHp: 40 });
    expect(m.ctx.player.hp).toBe(60 - DELUGE * 2);
    const plain = await playRound({ player: ['K', '6'], enemyHand: ['K', 'A'], playerMaxHp: 60, playerHp: 60, enemyHp: 40, rules: { enemy21Multiplier: 1 } });
    expect(plain.ctx.player.hp).toBe(60 - DELUGE);
  });
  it('防御すれば、2 倍の一撃も防具の上限（5）で止まる', async () => {
    const m = await playRound({ player: ['K', '6'], enemyHand: ['K', 'A'], from: 'Surrender', playerMaxHp: 60, playerHp: 60 });
    expect(m.ctx.player.hp).toBe(60 - 5);
  });
});

describe('BUST or DIE の予告', () => {
  it('敵の手札（伏せ札を含む）が 21 かバーストなら予告する。20 以下なら出さない', () => {
    expect(isBustOrDie(withHand('enemy', 'K', 'A'), rules)).toBe(true);
    expect(isBustOrDie(withHand('enemy', 'K', '9', '5'), rules)).toBe(true);
    expect(isBustOrDie(withHand('enemy', 'K', 'Q'), rules)).toBe(false);
    expect(isBustOrDie(withHand('enemy'), rules)).toBe(false);
  });
  it('敵が引き終えたときに決まり、ラウンドの初めに戻る。読み上げ用のログにも出す', () => {
    const state = readFileSync('src/core/battle/states/EnemyActionState.ts', 'utf8');
    expect(state).toContain('ctx.bustOrDie = isBustOrDie(enemy, rules);');
    expect(state).toContain('BUST or DIE ── ');
    expect(readFileSync('src/core/battle/states/DealState.ts', 'utf8')).toContain('ctx.bustOrDie = false;');
  });
  it('画面: 伏せ札がめくられるまで、敵の舞台に「BUST or DIE」。どちらなのか（21 の確率）は出さない', () => {
    const view = readFileSync('src/ui/BattleView.ts', 'utf8');
    expect(view).toContain('const omen = hidden && ctx.bustOrDie;');
    expect(view).toContain('BUST <small>or</small> DIE');
    expect(view).not.toMatch(/21 の確率/);
    expect(readFileSync('src/ui/styles/main.css', 'utf8')).toContain('.omen {');
    expect(readFileSync('src/ui/components/EnemyInfo.ts', 'utf8')).toContain('die-tag');
  });
});

describe('予告が消える', () => {
  it('hidden 属性の要素は、display を指定していても必ず隠れる（全体の [hidden] の指定）', () => {
    expect(readFileSync('src/ui/styles/main.css', 'utf8')).toContain('[hidden] { display: none !important; }');
  });
});
