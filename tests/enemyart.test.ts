import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMY_IMAGES } from '../src/ui/components/enemyArt';
import { backdropHtml, titleArtHtml } from '../src/ui/components/art';
import { STAGE_BACKDROP, TITLE_ART } from '../src/ui/components/enemySprites';

const read = (p: string) => readFileSync(p, 'utf8');

describe('敵の絵（生成 AI の画像）', () => {
  it('届いた敵の画像があり、ENEMY_IMAGES に登録されている（1 枚 200KB 以下）', () => {
    for (const id of ['slime', 'skeleton', 'bat', 'ghoul', 'knight', 'merman', 'gargoyle', 'wraith', 'iron_golem', 'serpent', 'flame', 'golem', 'imp', 'dragon']) {
      expect(statSync(`src/ui/art/enemies/${id}.webp`).size, id).toBeLessThan(200_000);
      expect(ENEMY_IMAGES[id], id).toBeTruthy();
    }
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

describe('敵以外の絵（タイトル・戦闘の舞台の背景・場面の挿絵）', () => {
  it('src/ui/art に画像があれば画像、なければ手書きの SVG を使う', () => {
    const title = titleArtHtml();
    expect(title === TITLE_ART || title.startsWith('<img')).toBe(true);
    for (const st of [1, 2, 3]) {
      const bd = backdropHtml(st);
      expect(bd.image ? bd.html.startsWith('<img') : bd.html === STAGE_BACKDROP).toBe(true);
    }
    expect(read('src/ui/components/scenes.ts')).toContain("import.meta.glob<string>('../art/scenes/*.webp'");
  });
  it('戦闘・タイトル・エンディングが、art.ts から背景とタイトルの絵を取る', () => {
    expect(read('src/ui/components/EnemyView.ts')).toContain('backdropHtml(stage)');
    expect(read('src/main.ts')).toContain('titleArtHtml()');
    expect(read('src/ui/EndingScreen.ts')).toContain('titleArtHtml()');
  });
});
