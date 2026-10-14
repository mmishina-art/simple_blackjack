import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('敵の絵（生成 AI の画像）', () => {
  it('スライムの画像があり、ENEMY_IMAGES に登録されている（容量は 200KB 以下）', () => {
    expect(statSync('src/ui/art/enemies/slime.webp').size).toBeLessThan(200_000);
    expect(read('src/ui/components/enemyArt.ts')).toContain('ENEMY_IMAGES: Partial<Record<string, string>> = { slime }');
  });
  it('戦闘・マップ・敵の詳細・図鑑は、画像があれば画像、なければ SVG を出す', () => {
    expect(read('src/ui/components/EnemyView.ts')).toContain('enemyArtHtml(enemyId)');
    expect(read('src/ui/MapView.ts')).toContain('enemyArtHref(t.enemyId)');
    expect(read('src/ui/components/MonsterSheet.ts')).toContain('enemyArtHtml(enemyId)');
    expect(read('src/ui/MetaScreens.ts')).toContain('enemyArtHtml(id)');
  });
  it('画像は Service Worker の precache に入る（オフラインでも出る）', () => {
    expect(read('vite.config.ts')).toMatch(/globPatterns: \['\*\*\/\*\.\{[^}]*webp/);
  });
  it('README に出どころ（Gemini）を書いている', () => {
    expect(read('README.md')).toContain('Google Gemini');
  });
});
