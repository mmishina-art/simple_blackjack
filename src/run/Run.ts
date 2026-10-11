import { ENEMY_LINEUP } from '../core/entities/enemies/catalog';
import type { EnemyDef } from '../core/entities/enemies/EnemyDef';
import { RELIC_POOL, reduceDamage } from '../relics/catalog';
import type { Relic } from '../relics/Relic';
import type { Rng } from '../core/util/Rng';
import { PERKS, type Perk } from './perks';

/** 1回の冒険（連戦）の状態。バトルをまたいで持ち越す。 */
export interface RunState {
  /** 現在の戦闘番号（0始まり）。 */
  stage: number;
  level: number;
  exp: number;
  maxHp: number;
  hp: number;
  /** レベルアップによる恒久強化。 */
  damageBonus: number;
  damageReduction: number;
  relics: Relic[];
}

export const START_MAX_HP = 60;
/** 勝利後の休息で回復する割合。 */
export const REST_HEAL_RATIO = 0.35;
/** 累計経験値ごとのレベル到達しきい値（index+1 = レベル）。 */
export const LEVEL_THRESHOLDS = [0, 15, 40, 75, 120, 175];

export function createRun(): RunState {
  return {
    stage: 0, level: 1, exp: 0, maxHp: START_MAX_HP, hp: START_MAX_HP,
    damageBonus: 0, damageReduction: 0, relics: [],
  };
}

export function currentEnemy(run: RunState): EnemyDef {
  return ENEMY_LINEUP[run.stage];
}

export function isLastStage(run: RunState): boolean {
  return run.stage >= ENEMY_LINEUP.length - 1;
}

export function levelForExp(exp: number): number {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((t, i) => { if (exp >= t) level = i + 1; });
  return level;
}

/** 次のレベルまでの累計経験値。最大レベルなら null。 */
export function expForNextLevel(level: number): number | null {
  return LEVEL_THRESHOLDS[level] ?? null;
}

export interface VictoryResult {
  gainedExp: number;
  levelsGained: number;
  healed: number;
}

/** 勝利処理: 経験値の加算、レベル判定、休息による回復。HP は呼び出し側が戦闘結果で更新済みであること。 */
export function applyVictory(run: RunState, enemy: EnemyDef): VictoryResult {
  const before = run.level;
  run.exp += enemy.exp;
  run.level = levelForExp(run.exp);
  const hpBefore = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * REST_HEAL_RATIO));
  return { gainedExp: enemy.exp, levelsGained: run.level - before, healed: run.hp - hpBefore };
}

function pickRandom<T>(pool: readonly T[], count: number, rng: Rng): T[] {
  const rest = [...pool];
  const out: T[] = [];
  while (out.length < count && rest.length > 0) {
    out.push(rest.splice(Math.floor(rng.next() * rest.length), 1)[0]);
  }
  return out;
}

/** レベルアップ時の選択肢（3つ）。 */
export function offerPerks(rng: Rng): Perk[] {
  return pickRandom(PERKS, 3, rng);
}

/** 報酬レリックの選択肢。所持済みは出ない。 */
export function offerRelics(run: RunState, rng: Rng): Relic[] {
  const owned = new Set(run.relics.map((r) => r.id));
  return pickRandom(RELIC_POOL.filter((r) => !owned.has(r.id)), 3, rng);
}

/** レベルアップによる恒久強化をバトルのフックとして実装したもの。 */
function statsRelic(run: RunState): Relic {
  return {
    id: 'stats', name: 'ステータス', icon: '力', description: '',
    apply({ bus, player }) {
      bus.on('onDamageCalculated', (p) => {
        if (p.attacker === player && p.damage > 0) return { ...p, damage: p.damage + run.damageBonus };
        if (p.defender === player && run.damageReduction > 0) {
          return { ...p, damage: reduceDamage(p.damage, run.damageReduction) };
        }
      }, -10);
    },
  };
}

/** このバトルに持ち込むレリック（所持レリック + ステータス強化）。 */
export function battleRelics(run: RunState): Relic[] {
  return [statsRelic(run), ...run.relics];
}
