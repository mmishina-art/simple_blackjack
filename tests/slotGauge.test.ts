import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { DealerAI } from '../src/core/entities/enemies/ai/DealerAI';
import { gaugeKeys, gaugeState } from '../src/ui/slotGauge';

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('スロット表に出すスロット（敵の個性）', () => {
  it('制限のない側（プレイヤー）は、11以下〜21 の全部', () => {
    expect(gaugeKeys()).toEqual(range(11, 21));
  });

  it('「N以上になるまで引く」敵は、N 未満のスロットを出さない', () => {
    expect(gaugeKeys(17)).toEqual(range(17, 21));
    expect(gaugeKeys(18)).toEqual(range(18, 21));
    expect(gaugeKeys(16)).toEqual(range(16, 21));
    expect(gaugeKeys(12)).toEqual(range(12, 21)); // 「11以下」は止まりようがない
    expect(gaugeKeys(5)).toEqual(range(11, 21));
  });

  it('敵ごとの standOn が、そのまま表の左端になる（個性が見える）', () => {
    const lefts = Object.fromEntries(ENEMY_LINEUP.map((e) => [e.id, gaugeKeys(e.ai.standOn)[0]]));
    expect(lefts).toEqual({ slime: 14, skeleton: 15, bat: 18, ghoul: 16, dragon: 18 }); // 弱い敵ほど低い合計で止まり、強い敵ほど高い合計まで引く
    expect(new DealerAI(15).standOn).toBe(15);
  });

  it('その敵が実際に止まりうる合計（standOn 以上）は、すべて表にある', () => {
    for (const e of ENEMY_LINEUP) {
      const keys = gaugeKeys(e.ai.standOn);
      for (let total = e.ai.standOn!; total <= 21; total++) expect(keys).toContain(total);
    }
  });
});

describe('合計値がたまるメーター', () => {
  const all = gaugeKeys();

  it('合計値までの左側がすべて点灯し、いちばん右の点灯が発動するスロット', () => {
    const { lit, tip } = gaugeState(all, 15, true, false);
    expect([...lit]).toEqual(range(11, 15));
    expect(tip).toBe(15);
  });

  it('11以下は「11以下」だけが点灯する。21 は全部点灯', () => {
    expect([...gaugeState(all, 4, true, false).lit]).toEqual([11]);
    expect(gaugeState(all, 4, true, false).tip).toBe(11);
    expect([...gaugeState(all, 21, true, false).lit]).toEqual(range(11, 21));
  });

  it('左端が17の敵: 17 未満はまだ何も点灯せず、17 から1つずつたまる', () => {
    const keys = gaugeKeys(17);
    expect(gaugeState(keys, 14, true, false)).toEqual({ lit: new Set(), tip: null });
    expect([...gaugeState(keys, 17, true, false).lit]).toEqual([17]);
    expect([...gaugeState(keys, 19, true, false).lit]).toEqual([17, 18, 19]);
    expect(gaugeState(keys, 19, true, false).tip).toBe(19);
  });

  it('合計が不明（敵の伏せカード）とバーストは、何も点灯しない', () => {
    expect(gaugeState(all, 15, false, false)).toEqual({ lit: new Set(), tip: null });
    expect(gaugeState(all, 25, true, true)).toEqual({ lit: new Set(), tip: null });
  });
});
