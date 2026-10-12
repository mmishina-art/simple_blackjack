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
