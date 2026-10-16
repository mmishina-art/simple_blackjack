import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMY_IMAGES } from '../src/ui/components/enemyArt';
import { backdropHtml, mapBackdropHtml, titleArtHtml } from '../src/ui/components/art';
import { STAGE_BACKDROP, TITLE_ART } from '../src/ui/components/enemySprites';

const read = (p: string) => readFileSync(p, 'utf8');

describe('敵の絵（生成 AI の画像）', () => {
  it('届いた敵の画像があり、ENEMY_IMAGES に登録されている（1 枚 200KB 以下）', () => {
    for (const id of ['slime', 'skeleton', 'bat', 'ghoul', 'shield_bearer', 'mimic', 'knight', 'merman', 'gargoyle', 'wraith', 'gambler', 'colossus', 'iron_golem', 'drowned_knight', 'serpent', 'flame', 'golem', 'imp', 'magma_serpent', 'dragon']) {
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
  it('タイトルの絵・階層ごとの背景 3 枚・挿絵 5 枚が画像になっている（1 枚 250KB 以下）', () => {
    expect(titleArtHtml()).not.toBe(TITLE_ART);
    expect(titleArtHtml().startsWith('<img')).toBe(true);
    for (const st of [1, 2, 3]) {
      const bd = backdropHtml(st);
      expect(bd.image, `stage${st}`).toBe(true);
      expect(bd.html).not.toBe(STAGE_BACKDROP);
    }
    for (const f of ['title', 'stages/stage1', 'stages/stage2', 'stages/stage3', 'scenes/shop', 'scenes/shrine', 'scenes/inn', 'scenes/reward', 'scenes/chest']) {
      expect(statSync(`src/ui/art/${f}.webp`).size, f).toBeLessThan(250_000);
    }
    expect(read('src/ui/components/scenes.ts')).toContain("import.meta.glob<string>('../art/scenes/*.webp'");
  });
  it('戦闘・タイトル・エンディングが、art.ts から背景とタイトルの絵を取る', () => {
    expect(read('src/ui/components/EnemyView.ts')).toContain('backdropHtml(stage)');
    expect(read('src/main.ts')).toContain('titleArtHtml()');
    expect(read('src/ui/EndingScreen.ts')).toContain('titleArtHtml()');
  });
  it('マップの背景（階層ごと 3 枚）が画像になっている（1 枚 350KB 以下）', () => {
    for (const st of [1, 2, 3]) {
      const bd = mapBackdropHtml(st);
      expect(bd.image, `map stage${st}`).toBe(true);
      expect(bd.html.startsWith('<img')).toBe(true);
      expect(statSync(`src/ui/art/maps/stage${st}.webp`).size, `stage${st}`).toBeLessThan(350_000);
    }
    expect(read('src/ui/MapView.ts')).toContain('mapBackdropHtml(run.stage)');
  });
});

