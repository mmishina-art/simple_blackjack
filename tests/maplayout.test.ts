import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('地図画面の整理（HP・ゴールドは、画面の上端に出さない）', () => {
  it('上部は、階層名・ゴールド（右上）・HP バー（数字つき）・遺物の順。遺物がないときは「遺物なし」', () => {
    const src = read('src/ui/MapView.ts');
    const order = ['map-hud__stage', 'map-hud__gold', 'map-hud__hp', "relics.className = 'map-hud__relics'"].map((k) => src.indexOf(k));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(src).toContain("relics.textContent = '遺物なし'");
    expect(src).toContain('aria-label="HP ${run.hp} / ${run.maxHp}"'); // 色だけでなく、数字と読み上げでも伝える
  });

  it('下部は、メッセージ（1 行）と、ボタンの行（「タイトルへ」と「装備」）に分かれている', () => {
    const src = read('src/ui/MapView.ts');
    expect(src).toContain("msg.className = 'map-foot__msg'");
    expect(src).toContain("actions.className = 'map-foot__actions'");
    expect(src).toContain('actions.append(giveUp, loadout)');
  });

  it('「装備」ボタンは、文字だけ（「確認」の小さな文字はない）', () => {
    const src = read('src/ui/MapView.ts');
    expect(src).toContain('<span class="btn__main">装備</span>');
    expect(src).not.toContain('btn__sub">確認');
  });

  it('画面の上端の HP・ゴールドのカプセル（run-status）はなくなった。上端の余白は 28px', () => {
    for (const f of ['src/main.ts', 'src/ui/styles/main.css']) expect(read(f), f).not.toContain('run-status');
    expect(read('src/ui/styles/main.css')).toMatch(/--top-gap:\s*28px/);
  });

  it('ゴールドが要る祠のバージョンアップには、所持金を出す', () => {
    expect(read('src/ui/ShrineScreen.ts')).toContain('所持 ${run.gold} G');
  });
});
