import { describe, expect, it } from 'vitest';
import { ENDING_PAGES, endingSummaryLines } from '../src/ui/EndingScreen';

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
});
