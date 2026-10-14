import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/ui/components/scenes';

const css = readFileSync('src/ui/styles/main.css', 'utf8');

describe('場所の挿絵（お店・祠・宿屋）', () => {
  it('3 つの場面があり、読み上げ用の説明（aria-label）がある', () => {
    expect(Object.keys(SCENES).sort()).toEqual(['inn', 'shop', 'shrine']);
    for (const [kind, svg] of Object.entries(SCENES)) {
      expect(svg, kind).toMatch(/role="img"/);
      expect(svg, kind).toMatch(/aria-label="[^"]{10,}"/);
    }
  });

  it('参照している id（url(#…)）が、その挿絵の中にそろっている。id は場面ごとに別（画面の中で重ならない）', () => {
    const ids = new Set<string>();
    for (const [kind, svg] of Object.entries(SCENES)) {
      const own = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      for (const id of own) { expect(ids.has(id), `${kind}: id ${id} が重なっている`).toBe(false); ids.add(id); }
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(own, `${kind}: #${m[1]} がない`).toContain(m[1]);
    }
  });

  it('動く装飾は、動きを減らす設定で止まる。低い画面では、祠のメニューを詰める', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.sc-glow, \.sc-flame \{ animation: none; \}/);
    expect(css).toMatch(/@media \(max-height: 700px\) \{[^@]*\.choice--shrine \.choice__card \{ padding: 8px 12px/);
  });

  it('場所ごとの色は、:root の変数にまとめてある（挿絵・メニューに色を直書きしない）', () => {
    for (const v of ['--shop-accent', '--shrine-accent', '--inn-accent', '--tone-a', '--tone-d']) expect(css).toContain(`${v}:`);
  });
});
