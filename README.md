# Blackjack Roguelike (MVP / Phase 1)

ブラックジャック×ローグライクの対戦型RPG。スマホ縦画面・PWA。

## 遊び方（冒険）

5体の敵と連戦する。HP・レベル・レリックは戦闘をまたいで持ち越し。勝利ごとに「経験値 → レベルアップ強化（レベルが上がった分）→ 遺物（レリック）選択」。

| # | 敵 | HP | 行動 | 特性 |
|---|---|---|---|---|
| 1 | スライム | 16 | 17で止まる | なし |
| 2 | 骸骨兵 | 28 | 16で止まる | 骨の鎧: 受けるダメージ-2 |
| 3 | 大蝙蝠 | 26 | 18まで引く | 超音波: 引き分けで3ダメージ |
| 4 | 屍食鬼 | 38 | 17で止まる | 屍の渇き: 勝つたびHP+4 |
| 5 | 黒竜 | 56 | 18で止まる | 竜の息吹: 勝利時ダメージ+3 |

- レベルアップ強化: 生命の祝福 / 剛腕 / 鉄壁 / 癒やしの祈り（3択）
- レリック: 血塗れの砥石 / 鋼の胸当て / 吸血の牙 / 二十二の刻印 / 賭博師の金貨 / 身代わりの人形 / 運命の指輪 / 命の蝋燭
- 戦闘後の休息で最大HPの35%回復。プレイヤーの初期HPは60

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm test           # Core のユニットテスト (Vitest)
npm run build      # 型チェック + 本番ビルド (PWA の SW / manifest 生成)
```

## 公開（GitHub Pages）

`.github/workflows/pages.yml` が push のたびにテスト・ビルドして Pages へデプロイする。
初回のみ、リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にする。
公開URL: `https://<ユーザー名>.github.io/simple_blackjack/`

## 構成

| パス | 役割 |
|---|---|
| `src/core/battle/` | ステートマシン (`BattleMachine`) と各ステート（Init→Deal→PlayerAction→EnemyAction→Resolve→CheckDeath）。遷移表は `types.ts` の `TRANSITIONS` |
| `src/core/cards/` | `Card` / `Deck`（注入可能な乱数）/ `Hand`（A の自動計算） |
| `src/core/rules/` | `RuleSet`（バースト上限などの可変ルール）、`judge`、`computeDamage`（純関数） |
| `src/core/events/` | `EventBus` とフック定義 |
| `src/core/entities/` | `Entity`、敵定義（`Slime`）、敵AI（`DealerAI`: 17以上でStand） |
| `src/relics/` | `Relic` インターフェースとレリック一覧（敵の特性も同じ仕組みで実装） |
| `src/run/` | 冒険の状態（`Run`）、経験値・レベル、強化（`perks`）、報酬の抽選 |
| `src/ui/` | DOM ベースの View（Core には依存されない） |

## イベントフック（レリック拡張）

`machine.bus.on(name, handler, priority?)` で購読。ハンドラはペイロードを書き換えるか、新しいペイロードを return すると値を改変できる。

```ts
bus.on('onCardDrawn', ({ card }) => { card.value = 5; });                         // 引いたカードの数字を変える
bus.on('onDamageCalculated', (p) => ({ ...p, damage: p.damage + 2 }));            // ダメージ改変
relic.apply = ({ rules }) => { rules.bustLimit += 1; };                            // バースト上限を22に
```

フック一覧: `onBattleStart` `onRoundStart` `onDealt` `onCardDrawn` `onStand` `onBust` `onDamageCalculated` `onResolve` `onRoundEnd` `onBattleEnd`

## ルールの解釈（仕様の補足）

- ブラックジャック勝利の1.5倍は敵側にも対称に適用。ブラックジャック同士・同値は引き分け（ブラックジャック vs 通常21は同値扱い）
- プレイヤーが配牌でブラックジャックなら自動でStand
- ディーラーはソフト17でもStand
- 山札はバトル中使い回し、残り15枚未満でラウンド開始時に再シャッフル（`RuleSet.reshuffleThreshold`）
- 難易度: 「17未満でヒット」だけの単純なボットで約16%がクリア（`vite-node` で試算）。実際のプレイヤーは敵の表向きカードを見られるのでこれより上がる想定
