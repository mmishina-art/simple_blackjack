// PWA の設定が標準を満たしていること
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

describe('index.html', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? '';

  it('viewport で拡大（ピンチ）を禁止していない', () => {
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });
});

describe('manifest のアイコン', () => {
  const config = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
  const srcs = [...config.matchAll(/src: '([^']+)'/g)].map((m) => m[1]);

  it('参照するアイコンがすべて public/ に実在する', () => {
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) expect(existsSync(resolve(root, 'public', src)), src).toBe(true);
  });

  it('maskable は通常アイコンと別のファイルを使う', () => {
    const maskable = /src: '([^']+)'[^}]*purpose: 'maskable'/.exec(config)?.[1];
    expect(maskable).toBeTruthy();
    expect(srcs.filter((s) => s === maskable)).toHaveLength(1);
  });
});

describe('Service Worker の更新', () => {
  const config = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');

  it('新しい版は待機し、更新ボタンで切り替える（戦闘中に勝手に再読み込みしない）', () => {
    expect(config).toMatch(/registerType:\s*'prompt'/);
    expect(config).not.toMatch(/registerType:\s*'autoUpdate'/);
  });
});

describe('バージョン表示', () => {
  const config = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
  const main = readFileSync(resolve(root, 'src/main.ts'), 'utf8');

  it('package.json の version を埋め込み、タイトル画面に表示する', () => {
    expect(config).toMatch(/__APP_VERSION__:\s*JSON\.stringify\(version\)/);
    expect(main).toMatch(/__APP_VERSION__/);
  });
});

describe('起動失敗時の復旧', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');

  it('boot.js を main.ts より先に読み込み、復旧の表示（#boot-error / #boot-repair）を持つ', () => {
    const boot = html.indexOf('src="boot.js"');
    expect(boot).toBeGreaterThan(-1);
    expect(boot).toBeLessThan(html.indexOf('src="/src/main.ts"'));
    expect(html).toMatch(/id="boot-error"/);
    expect(html).toMatch(/id="boot-repair"/);
    expect(existsSync(resolve(root, 'public/boot.js'))).toBe(true);
  });

  it('main.ts は起動できたら window.__appStarted = true にする', () => {
    expect(readFileSync(resolve(root, 'src/main.ts'), 'utf8')).toMatch(/window\.__appStarted = true/);
  });
});

describe('同じサイトのほかのアプリを消さない', () => {
  const boot = readFileSync(resolve(root, 'public/boot.js'), 'utf8');

  it('boot.js の復旧は、このアプリの Service Worker とキャッシュだけを対象にする', () => {
    expect(boot).toContain('regs.filter(isMyRegistration)');
    expect(boot).toContain('keys.filter(isMyCache)');
    expect(boot).toMatch(/var APP_ID = 'simple-blackjack'/);
  });
});
