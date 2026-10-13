import { attackValue, getSkill } from '../../skills/Skill';
import { SLOT_MAX, SLOT_MIN } from '../../skills/Skill';
import type { EnemyDef } from './EnemyDef';

/**
 * 「N以上で止まる」ディーラーが、バーストせずに止まる最終合計値の確率（無限山札の近似）。
 * 低い合計で止まるほど起きやすいので、LV の平均はこの重みで取る。キーは合計値（N〜21）、値は確率（合計 1 に正規化）。
 */
export function standDistribution(standOn: number): Map<number, number> {
  const memo = new Map<string, Map<number, number>>();
  const walk = (sum: number, ace: boolean): Map<number, number> => {
    const total = ace && sum + 10 <= SLOT_MAX ? sum + 10 : sum;
    if (total > SLOT_MAX) return new Map(); // バースト（攻撃しない）
    if (total >= standOn && sum > 0) return new Map([[total, 1]]);
    const key = `${sum}|${ace}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const out = new Map<number, number>();
    for (let v = 1; v <= 10; v++) {
      const p = v === 10 ? 4 / 13 : 1 / 13; // 10・J・Q・K は 4 倍出やすい
      for (const [t, q] of walk(sum + v, ace || v === 1)) out.set(t, (out.get(t) ?? 0) + p * q);
    }
    memo.set(key, out);
    return out;
  };
  const dist = walk(0, false);
  const sumP = [...dist.values()].reduce((a, b) => a + b, 0);
  return new Map([...dist].map(([t, p]) => [t, p / sumP]));
}

/**
 * 敵のレベル（LV）= 攻撃するときの平均ダメージ。LV 5 なら、1回の攻撃で約 5 ダメージ（HP 30 なら約 6 回で倒れる）。
 * 敵が止まりうる合計値（「N以上になるまで引く」の N 〜 21）ごとの攻撃スキルのダメージ
 * （floor(POW × 倍率) + 加算 + 特性の上乗せ）を、その合計値で止まる確率（standDistribution）の重みで平均して、四捨五入する（最低 1）。
 * ブロックや回復だけのスロットは数えない。プレイヤーのブロック・防具・レリックは考えない（敵そのものの強さ）。
 */
export function enemyLevel(def: EnemyDef): number {
  const standOn = (def.ai as { standOn?: number }).standOn ?? SLOT_MIN;
  let sum = 0;
  let weight = 0;
  for (const [total, p] of standDistribution(Math.max(SLOT_MIN, standOn))) {
    const skill = getSkill(def.slots[total] ?? def.fallbackSkill);
    for (const e of skill.effects) {
      if (e.type === 'attack') {
        sum += p * (attackValue(e, def.attack) + (def.attackBonus ?? 0));
        weight += p;
      }
    }
  }
  return weight === 0 ? 1 : Math.max(1, Math.round(sum / weight));
}

/** HP がこの LV の攻撃で尽きるまでの回数（切り上げ）。例: HP 30・LV 5 → 6 回。 */
export function hitsToDefeat(hp: number, level: number): number {
  return Math.max(1, Math.ceil(hp / Math.max(1, level)));
}
