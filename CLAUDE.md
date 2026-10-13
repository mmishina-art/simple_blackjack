# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

Blackjack Roguelike(`simple_blackjack`): ブラックジャック × ローグライクの対戦型 RPG の PWA。スマホ縦画面。Vite + TypeScript + vite-plugin-pwa。ゲームのルールと仕様は `README.md` を参照(スキル、ブロック、POW、レリック、メタ進行など)。**ルールを変えたら README も更新する。** ユーザー向けの文言は日本語。

## Running / Testing

```bash
npm ci
npm run dev         # 開発サーバー
npm test            # vitest run(tests/*.test.ts)
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build → dist/
```

`src/` は `core`(ルール)、`run`、`map`、`meta`、`relics`、`audio`、`ui`、`main.ts`。ルール・計算は UI から切り離してテストする。戦闘のルールは順序が重要(ブロックを先に付与、行動順など)なので、変えたら `tests/battle.test.ts` などを必ず更新する。

## PWA

- `vite.config.ts` の `VitePWA`(`registerType: 'prompt'`)が Service Worker を自動生成する。ファイル一覧の手動更新は不要。新しい版は待機し、`src/ui/UpdateBanner.ts` の「更新」ボタンで切り替える(戦闘の途中で勝手に切り替えない)。
- Google Fonts は初回アクセス後にキャッシュする(`runtimeCaching`)。
- 配色は「暗い固定」(`theme_color` `#0a0806`)。
- **iPhone の画面の上端**: ホーム画面アプリで、ステータスバーの下に内容が入り込むと、iOS がそこをぼかして文字が読みにくくなる(`simple_chess` と同じ症状)。そのため `index.html` で `apple-mobile-web-app-status-bar-style` を `black`(不透明。`black-translucent` にしない)にし、`main.css` の `--safe-top`(安全領域 + `--top-gap` 24px)を、各画面の上端の余白に使う。上端の余白を足すときは `env(safe-area-inset-top)` だけにせず `--safe-top` を使う(`tests/pwa.test.ts` が確認する)。小さい画面(iPhone SE)でタイトル・地図・戦闘がはみ出さないことを、画面で確認する。
- **戦闘画面は、短い画面で詰めて1画面に収める**(Hit / Stand のボタンが画面の外に出ると押せない)。`main.css` の末尾に、高さ 850px 以下・720px 以下で `.battle` の中だけを詰める指定がある(`tests/layout.test.ts` が確認する)。詰めた分の高さは、残りの高さを使う敵の舞台(`.enemy-stage`。`contain: size` で、中の絵の大きさを最低の高さに数えない)に回る。**戦闘ログ欄は常時は出さない**(`BattleLog`: 読み上げ用の `aria-live` の見えない領域と、「記録」ボタンのシート。行動順は `turnBanner` の帯、ダメージの内訳は数字の下。`tests/layout.test.ts` が確認する)。手札が5枚以上のときは `HandView` が `.hand--many` を付け、カードを重ねて1行に収める。**上のほうにある `@media (max-height)` は、あとに書かれた通常の指定に上書きされて効かない箇所がある**ので、画面を詰めるときは詳しい指定(`.battle .xxx`)で書く。戦闘画面の高さが変わる変更をしたら、375×667(iPhone SE)、375×647(SE のホーム画面アプリ)、390×797 + 下の安全領域 34px(ノッチのある iPhone のホーム画面アプリ)で、敵の舞台が潰れず、下のボタンが見えることを画面で確認する。装備画面（旧・編成画面）も同じ考えで、高さ 750px 以下で `.loadout` の中だけを詰める指定がある(スキル獲得直後の「置くスキルのバナー付き」の画面が、約 695px の高さまで収まる。iPhone SE の 667px のような、さらに低い画面は対象外)。
- **記録のバックアップは `src/meta/backup.ts` と `src/ui/BackupSection.ts`**(「魂の祭壇」の下の「記録のバックアップ」)。メタ進行(`bj-meta-v1`)と音の設定(`bj-muted`)を、`app` 名と `schemaVersion` を入れた JSON ファイルに書き出し / 読み込む。別のアプリのファイル、新しすぎる版、壊れた中身は理由を示して断る。**今の記録より冒険した回数が少ない(古い)バックアップは、置き換えてよいか確認する**。読み込み後はページを読み込み直す。バックアップに入れるキーを増やすときは `BACKUP_KEYS` に足す。`tests/backup.test.ts` がテストする。
- **起動に失敗したときの復旧は `public/boot.js`**(Vite を通さずそのまま配信される普通のスクリプトで、`index.html` で `main.ts` より先に読み込む)。起動できなかったとき、Service Worker とキャッシュを消して読み込み直す(1回目は自動、2分以内の2回目は `#boot-error` の「なおす」ボタン)。保存データは消さない。`src/main.ts` の最後で `window.__appStarted = true` にする(`tests/pwa.test.ts` が確認する)。**消すのは、このアプリの Service Worker(`scope` が自分の置き場所)とキャッシュ(名前が `simple-blackjack-` で始まる、または Workbox の precache の名前の最後に自分の置き場所が付くもの)だけ**(同じサイトのほかのアプリのものを消さない)。
- **公開のたびに `package.json` の `version` を上げる**(`vite.config.ts` が `__APP_VERSION__` として埋め込み、タイトル画面の下に `v0.2.0` のように表示される)。Service Worker のキャッシュは自動生成なので、手で合わせる番号はない。

## 現状と標準のずれ(直すときは別 PR で)

- Lint(ESLint)は入れず、`tsc` の型チェックで代替している。
- メタ進行(`src/meta/Meta.ts`)の `version` が `1` 以外のデータは、`loadMeta` が初期状態に戻す(保存の形を変えるときの移行処理がない)。保存の形を変えるときは、`version` を上げて、古い形を変換する処理を書く(キー名 `bj-meta-v1` は変えない)。
- Google Fonts(外部)に依存している。初回アクセス後はキャッシュされるが、初回がオフラインだと代替フォントになる → フォントを同梱するか、許容する旨を明記する。
- README に、画像・音・文章の出どころの記載がない。

対応済み: 更新ボタン方式(`registerType: 'prompt'`)、ピンチ拡大の許可、専用の maskable アイコン、PR 時のテスト(`test.yml`)、インストール方法の説明(タイトル画面)、デフォルトブランチを `main` に変更(公開は `main` への push のみ)、Dependabot(`.github/dependabot.yml`。npmは毎週、Actions は毎月)、バージョン表示(タイトル画面の下)、起動失敗時の復旧(`public/boot.js`)、バックアップ(`src/meta/backup.ts`)。

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
- **PR は1つの目的にする。** 他の PR の上に積まない(積むときは、本文に「どの PR の上か」を書き、下の PR から順にマージする)。デフォルトブランチは `main`。
- **保存データには版番号(`schemaVersion` など)を持たせ、保存の形を変えるときは移行処理を書く。記録を残すアプリは、ファイルへの書き出し / 読み込みを用意する**(`localStorage` は、ブラウザの都合で消えることがある。特に iPhone)。手本はテンプレートの `src/backup.ts` と `src/storage.ts`、または `simple_quiz` の `js/backup.js`。
- **起動に失敗したときの復旧を用意する。** キャッシュ優先の Service Worker は、ファイルが食い違うと起動しなくなることがある。メインとは別の普通のスクリプトで、起動できなかったとき、キャッシュを消して読み込み直す(1回目は自動、2分以内の2回目は「なおす」ボタン)。保存データは消さない。手本は `simple_quiz` の `js/boot.js` とテンプレートの `public/boot.js`。
- **同じサイトに載るアプリ: 名前をアプリごとに別にする。** GitHub Pages では、すべてのアプリが同じサイト(`mmishina-art.github.io`)に載り、`localStorage`・`sessionStorage`・Service Worker・キャッシュはサイトの単位で共有される。保存データのキー、バックアップの `app` 名、キャッシュ名、`sessionStorage` のキーは、アプリごとに別の名前(接頭辞)にする。起動失敗の復旧(`boot.js`)と、Service Worker の古いキャッシュの片づけは、**自分のアプリの Service Worker とキャッシュだけ**を対象にする(`k !== CACHE` のように「自分以外すべて」を消さない)。
- **外部のリソース(Web フォント、CDN のスクリプトなど)に頼らない。** オフラインで動かなくなるため。使うなら、Service Worker のキャッシュ対象にする。
- **画像・音・問題文・文章は、自作するか、ライセンスを README に明記する。**
- 画面を変えたら、スマホの幅・小さい画面(iPhone SE の大きさ)・ダークモード(対応しているアプリ)で実際に表示して確認する(スクリーンショットを見る)。PR の本文に、確認したこと(実機か、していないか)を書く。
- **利用者が入力した文字は `textContent` で表示し、`innerHTML` に入れない。**
- **依存パッケージと Actions の更新は Dependabot に任せる**(`.github/dependabot.yml`)。更新の PR は、CI が緑なのを確認してからマージする。
  - **`vite`・`vitest`・`vite-plugin-pwa` は、同時に更新しないと組み合わせられないので、1つの PR にまとめる設定**(`dependabot.yml` の `vite-family`)。vite 8 と vitest 5 は、別々だと CI が失敗し、`vite.config.ts` の型の参照(`/// <reference types="vitest/config" />`)の書き換えも必要だった。
  - 更新の PR が失敗したら、閉じる前に、失敗の理由(`gh run view --log-failed`)を確認する。依存の順序の問題のこともある。
- 変更を終える前にテストを通し、`python3 -m http.server` などで実際に起動して動作を確認する。
