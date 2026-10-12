# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

Blackjack Roguelike(`simple_blackjack`): ブラックジャック × ローグライクの対戦型 RPG の PWA。スマホ縦画面。Vite + TypeScript + vite-plugin-pwa。ゲームのルールと仕様は `README.md` を参照(スキル、Block、ATK、レリック、メタ進行など)。**ルールを変えたら README も更新する。** ユーザー向けの文言は日本語。

## Running / Testing

```bash
npm ci
npm run dev         # 開発サーバー
npm test            # vitest run(tests/*.test.ts)
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build → dist/
```

`src/` は `core`(ルール)、`run`、`map`、`meta`、`relics`、`audio`、`ui`、`main.ts`。ルール・計算は UI から切り離してテストする。戦闘のルールは順序が重要(Block を先に付与、行動順など)なので、変えたら `tests/battle.test.ts` などを必ず更新する。

## PWA

- `vite.config.ts` の `VitePWA`(`registerType: 'prompt'`)が Service Worker を自動生成する。ファイル一覧の手動更新は不要。新しい版は待機し、`src/ui/UpdateBanner.ts` の「更新」ボタンで切り替える(戦闘の途中で勝手に切り替えない)。
- Google Fonts は初回アクセス後にキャッシュする(`runtimeCaching`)。
- 配色は「暗い固定」(`theme_color` `#0a0806`)。

## 現状と標準のずれ(直すときは別 PR で)

- バージョン表示がない → タイトル画面に表示したい(元は `package.json` の `version`)。
- デフォルトブランチが `claude/determined-einstein-moflfm`(`main` がない)で、`pages.yml` は `main` と `claude/**` への push で公開する(作業ブランチが公開 URL に載りうる)。標準は「`main` のみ公開 + PR でテスト」。
- Lint(ESLint)は入れず、`tsc` の型チェックで代替している。

対応済み: 更新ボタン方式(`registerType: 'prompt'`)、ピンチ拡大の許可、専用の maskable アイコン、PR 時のテスト(`test.yml`)、インストール方法の説明(タイトル画面)。

## 共通ルール(PWA アプリ共通)

新しい PWA アプリは、テンプレート `mmishina-art/pwa-template`(Vite + TypeScript)から作る。このリポジトリは作成時期の都合でテンプレートより前の構成だが、次のルールは共通で守る。

- オーナーは Claude Code での開発を学習中。変更は小さく、理由を添えて説明する。
- ユーザー向けの文言・説明は日本語。コードの識別子とコミットメッセージは英語(命令形、1コミット1目的)。
- 作業は feature ブランチ → PR → CI が通ったらマージ。デフォルトブランチへ直接 push しない。
- 配信は GitHub Pages のサブパス。参照パスは相対(`./`)にし、`/` から始めない。
- ユーザーデータは `localStorage` を `try/catch` で囲んで読み書きし、使えなくても動くこと。**保存キー名は変更しない**(利用者の記録が消える)。変えるなら移行処理を書く。
- 色は CSS の `:root` 変数に集約し、直書きしない。`[hidden] { display: none !important; }` を残す。
- ズーム: ピンチ拡大は許可し、ダブルタップ拡大だけ `touch-action: manipulation` で防ぐ。viewport に `user-scalable=no` / `maximum-scale` を新たに入れない。
- タップ領域は 44px 以上。`prefers-reduced-motion: reduce` でアニメーションを無効化する。結果表示は `aria-live` でも読み上げ、色だけで状態を伝えない。
- 効果音は Web Audio で合成し、オン/オフ設定を用意する。
- iPhone の安全領域(`env(safe-area-inset-*)`)を考慮する。
- **最初の画面(タイトル/ホーム)に、インストール方法の説明への入口を置く。** iPhone は自動のインストール案内が出ないため、手順(iPhone / iPad は Safari の共有 → ホーム画面に追加、Android は Chrome のメニュー → アプリをインストール、パソコンはアドレスバーのインストールのマーク)を見せる。今使っている端末の説明を最初から開き、`beforeinstallprompt` が使えるときは「今すぐインストール」も出す。インストール済み(`display-mode: standalone`)のときは入口を出さない。実装の手本はテンプレート `mmishina-art/pwa-template` の `src/install.ts`。
- **タイトル画面(最初の画面)にバージョンを表示する**(例: `v1.2`)。更新が反映されたかを、利用者がひと目で確認できるようにするため。バージョンの元は1か所に置き、公開のたびに上げる。キャッシュ優先の Service Worker を手で書いている場合は、キャッシュ名の番号と同じにして、食い違いをテストで検出する。
- 変更を終える前にテストを通し、`python3 -m http.server` などで実際に起動して動作を確認する。
