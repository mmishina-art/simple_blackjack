import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('地図画面の「タイトルへ」（冒険をあきらめる）', () => {
  it('地図に「タイトルへ」ボタンがあり、押すと確認が出る。確認で OK のときだけ、タイトルへ戻る', () => {
    const src = read('src/ui/MapView.ts');
    expect(src).toContain('タイトルへ');
    expect(src).toContain("title: '冒険をあきらめる？'");
    expect(src).toContain('onPick: () => handlers.onGiveUp()'); // 確認の決定ボタンだけが、onGiveUp を呼ぶ
    expect(src).toContain('魂片は入らない');
  });

  it('あきらめたときは、魂片が入らず、冒険の回数にも数えない（endRun・finishRun を呼ばない）', () => {
    const main = read('src/main.ts');
    const line = main.split('\n').find((l) => l.includes('onGiveUp'))!.split('//')[0]; // コメントは見ない
    expect(line).toContain('showTitle()');
    expect(line).not.toMatch(/endRun|finishRun/);
  });

  it('ボタンのタップ範囲は 44px 以上（地図の下のボタンの行）', () => {
    expect(read('src/ui/styles/main.css')).toMatch(/\.map-foot__btn \{ min-height: 52px; \}/);
  });
});
