import { describe, expect, it } from 'vitest';
import { audio } from '../src/audio/AudioManager';
import { ENDING_PAGES, endingSummaryLines, showEnding } from '../src/ui/EndingScreen';

describe('エンディング', () => {
  it('文章は複数ページで、どれも空でない', () => {
    expect(ENDING_PAGES.length).toBeGreaterThanOrEqual(3);
    for (const p of ENDING_PAGES) expect(p.trim().length).toBeGreaterThan(0);
  });

  it('結果の行: 倒した敵・遺物・魂片（所持）。素の状態の冒険は、記録されない旨を出す', () => {
    expect(endingSummaryLines({ gained: 90, shards: 130, enemiesDefeated: 21, relics: 5, bare: false })).toEqual([
      '倒した敵　21', '手に入れた遺物　5', '魂片　+90（所持 130）',
    ]);
    const bare = endingSummaryLines({ gained: 0, shards: 50, enemiesDefeated: 20, relics: 3, bare: true });
    expect(bare[2]).toContain('記録されない');
    expect(bare.join('')).not.toContain('+0');
  });

  it('エンディングを開くと BGM が ending になり、最後まで進めて閉じると onClose が呼ばれる', () => {
    const fakeEl = (): Record<string, unknown> => {
      const listeners: Record<string, () => void> = {};
      return {
        className: '', textContent: '', innerHTML: '', hidden: false,
        classList: { add: () => {}, toggle: () => {} },
        setAttribute: () => {},
        append: () => {},
        replaceChildren: () => {},
        addEventListener: (t: string, fn: () => void) => { listeners[t] = fn; },
        click: () => listeners.click?.(),
      };
    };
    const created: Array<Record<string, unknown>> = [];
    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: () => { const e = fakeEl(); created.push(e); return e; },
    } as unknown as Document;
    try {
      audio.setBgm('boss');
      let closed = false;
      const root = fakeEl() as unknown as HTMLElement;
      showEnding(root, { gained: 40, shards: 40, enemiesDefeated: 10, relics: 3, bare: false }, () => {
        audio.setBgm('field');
        closed = true;
      });
      expect(audio.bgm).toBe('ending');
      const skipBtn = created.find((e) => e.className === 'ending__skip')!;
      const nextBtn = created.find((e) => (e.className as string).includes('ending__next'))!;
      (skipBtn.click as () => void)();
      expect(audio.bgm).toBe('ending');
      (nextBtn.click as () => void)();
      expect(closed).toBe(true);
      expect(audio.bgm).toBe('field');
    } finally {
      globalThis.document = prevDoc;
    }
  });
});

