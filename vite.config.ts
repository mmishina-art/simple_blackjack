/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: './',
  // 画面に表示するバージョン（package.json の version。公開のたびに上げる）
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    VitePWA({
      // 'prompt': 新しい版は待機させ、画面の「更新」ボタン（src/ui/UpdateBanner.ts）で切り替える
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Blackjack Roguelike',
        short_name: 'BJ Rogue',
        description: 'ブラックジャック×ローグライクの対戦型RPG',
        lang: 'ja',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0806',
        theme_color: '#0a0806',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // maskable は端末が円や角丸に切り抜くので、図柄を縮めた専用画像を使う
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'], // webp = 敵の絵（src/ui/art/enemies）
        // Google Fonts は初回アクセス後にキャッシュし、オフラインでも表示できるようにする
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
