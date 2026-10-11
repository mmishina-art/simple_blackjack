# Blackjack Roguelike (MVP / Phase 1)

ブラックジャック×ローグライクの対戦型RPG。スマホ縦画面・PWA。Phase 1 は「プレイヤー vs スライム」の1on1バトルループ。

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm test           # Core のユニットテスト (Vitest)
npm run build      # 型チェック + 本番ビルド (PWA の SW / manifest 生成)
```

## 構成

| パス | 役割 |
|---|---|
| `src/core/battle/` | ステートマシン (`BattleMachine`) と各ステート（Init→Deal→PlayerAction→EnemyAction→Resolve→CheckDeath）。遷移表は `types.ts` の `TRANSITIONS` |
| `src/core/cards/` | `Card` / `Deck`（注入可能な乱数）/ `Hand`（A の自動計算） |
| `src/core/rules/` | `RuleSet`（バースト上限などの可変ルール）、`judge`、`computeDamage`（純関数） |
| `src/core/events/` | `EventBus` とフック定義 |
| `src/core/entities/` | `Entity`、敵定義（`Slime`）、敵AI（`DealerAI`: 17以上でStand） |
| `src/relics/` | レリックのインターフェース（MVPでは実装なし） |
| `src/ui/` | DOM ベースの View（Core には依存されない） |

## イベントフック（レリック拡張）

`machine.bus.on(name, handler, priority?)` で購読。ハンドラはペイロードを書き換えるか、新しいペイロードを return すると値を改変できる。

```ts
bus.on('onCardDrawn', ({ card }) => { card.value = 5; });                         // 引いたカードの数字を変える
bus.on('onDamageCalculated', (p) => ({ ...p, damage: p.damage + 2 }));            // ダメージ改変
relic.apply = (bus, rules) => { rules.bustLimit = 24; };                          // バースト上限を24に
```

フック一覧: `onBattleStart` `onRoundStart` `onDealt` `onCardDrawn` `onStand` `onBust` `onDamageCalculated` `onResolve` `onRoundEnd` `onBattleEnd`

## ルールの解釈（仕様の補足）

- ブラックジャック勝利の1.5倍は敵側にも対称に適用。ブラックジャック同士・同値は引き分け（ブラックジャック vs 通常21は同値扱い）
- プレイヤーが配牌でブラックジャックなら自動でStand
- ディーラーはソフト17でもStand
- 山札はバトル中使い回し、残り15枚未満でラウンド開始時に再シャッフル（`RuleSet.reshuffleThreshold`）
- HP: プレイヤー50 / スライム40（`EnemyDef` と `BattleOptions.playerMaxHp`）
