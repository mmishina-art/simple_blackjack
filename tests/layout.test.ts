// 短い画面（iPhone SE など）で、戦闘画面が1画面に収まるための指定が残っていること。
// 高さがぴったり収まるかは、ブラウザで 375×667 などの画面を実際に見て確認する（CLAUDE.md）。ここでは指定の有無と範囲だけを確認する。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
// コメントの中の { } や文言が、解析のじゃまにならないよう取り除く
const css = readFileSync(resolve(root, 'src/ui/styles/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const handView = readFileSync(resolve(root, 'src/ui/components/HandView.ts'), 'utf8');

/** `@media (max-height: Npx) { ... }` の中身を、すべて連結して返す（{ } の数を数えて閉じ括弧を探す）。 */
function mediaBlocks(maxHeight: number): string {
  const head = `@media (max-height: ${maxHeight}px) {`;
  let out = '';
  let from = 0;
  for (;;) {
    const start = css.indexOf(head, from);
    if (start < 0) return out;
    let depth = 1;
    let i = start + head.length;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out += `${css.slice(start + head.length, i - 1)}\n`;
    from = i;
  }
}

/** 中身から `セレクタ { 宣言 }` を取り出す。 */
function rulesOf(block: string): Array<{ selector: string; body: string }> {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2].trim() }));
}

const TIERS = [850, 720];

describe('短い画面の戦闘画面', () => {
  it.each(TIERS)('高さ %ipx 以下で、戦闘画面を詰める指定がある', (height) => {
    const block = mediaBlocks(height);
    for (const selector of ['.battle .enemy-stage', '.battle .enemy-sprite', '.battle .hand', '.battle .card', '.battle .actions .btn', '.battle .log']) {
      expect(block, `${height}px: ${selector}`).toContain(selector);
    }
  });

  it('詰める指定は .battle の中だけにして、ほかの画面（タイトル・地図など）に及ばない', () => {
    for (const height of TIERS) {
      const rules = rulesOf(mediaBlocks(height));
      expect(rules.length).toBeGreaterThan(0);
      for (const { selector } of rules) {
        for (const one of selector.split(',').map((s) => s.trim())) expect(one, `${height}px: ${one}`).toMatch(/^\.battle\b/);
      }
    }
  });

  it('ボタンは、詰めても高さ 44px 以上にする（タップしやすさ）', () => {
    let checked = 0;
    for (const height of TIERS) {
      for (const { selector, body } of rulesOf(mediaBlocks(height))) {
        if (!selector.startsWith('.battle .actions .btn')) continue;
        const min = /min-height:\s*(\d+)px/.exec(body);
        if (!min) continue;
        checked++;
        expect(Number(min[1]), `${height}px ${selector}`).toBeGreaterThanOrEqual(44);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('手札が多いときは折り返さずカードを重ねる（HandView が .hand--many を付け、CSS が重ねる）', () => {
    expect(handView).toMatch(/classList\.toggle\('hand--many'/);
    expect(mediaBlocks(850)).toMatch(/\.battle \.hand--many \.card \+ \.card\s*\{[^}]*margin-left:\s*-\d+px/);
  });
});
