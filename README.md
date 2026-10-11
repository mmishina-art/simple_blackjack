# Blackjack Roguelike (MVP / Phase 1)

ブラックジャック×ローグライクの対戦型RPG。スマホ縦画面・PWA。

## 遊び方

ブラックジャックで合計値を作り、その**合計値に対応するスロットのスキル**を発動して戦う。レベル・経験値はなく、強化は「装備スキル（スロット）」と「レリック」だけ。

### ラウンドの流れ

1. 配牌 → Hit / Stand / 撤退 を選ぶ（敵の2枚目は裏向き）
2. 双方スタンド後、合計値を比較して**行動順**を決める
   - 合計値が大きい方が先攻、小さい方が後攻
   - 同値は同時攻撃（防御・回復 → 攻撃 → 死亡判定の順）
   - バーストした側は行動不能。相手は先制クリティカル（攻撃 ×1.5）
   - 初手ブラックジャック（2枚で21）は、その行動がクリティカル
3. 先攻がスロットのスキルを発動 → 後攻の生存確認 → 後攻が発動
4. ラウンド終了時に Block（シールド）が0に戻る。HP が0になった側の負け（相打ちはプレイヤー敗北）

撤退は、スキルも敵のターンも飛ばし、Block 貫通で5ダメージを受けて次のラウンドへ。

### ナンバースロット

合計値 `11以下 / 12 / … / 21` それぞれにスキルをセットできる。未設定の合計値は `fallbackSkill`（既定は基本攻撃・攻撃3）が発動する。
プレイヤーの初期スロット（仮）: `11以下=小攻撃4 / 15=シールド6 / 18=回復6 / 20=大攻撃14 / 21=特大攻撃20`。

### 冒険

5体の敵と連戦。HP とレリックは持ち越し。勝利ごとに休息で最大HPの35%回復し、レリックを3択で1つ獲得。

| # | 敵 | HP | 行動 | 特性 |
|---|---|---|---|---|
| 1 | スライム | 16 | 17で止まる | なし |
| 2 | 骸骨兵 | 28 | 16で止まる | 骨の鎧: 受けるダメージ-2。15-16でシールド |
| 3 | 大蝙蝠 | 26 | 18まで引く | 超音波: 同値なら必ず先攻。18-19で吸血 |
| 4 | 屍食鬼 | 38 | 17で止まる | 屍の渇き: HPを削るたびHP+4 |
| 5 | 黒竜 | 46 | 18で止まる | 竜の息吹: 攻撃ダメージ+3 |

レリック: 血塗れの砥石 / 鋼の胸当て / 吸血の牙 / 身代わりの人形 / 運命の指輪 / 疾風の靴 / 堅牢の盾 / 命の蝋燭

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
| `src/core/battle/` | ステートマシン (`BattleMachine`) と各ステート。遷移表は `types.ts` の `TRANSITIONS` |
| `src/core/skills/` | `SkillDef` / `SlotTable` / スロット解決、スキル実行（`execute.ts`: `applyDamage`・Block・クリティカル）、スキル定義（`catalog.ts`） |
| `src/core/rules/` | `RuleSet`（クリティカル倍率・撤退ダメージ等）、`initiative`（行動順の決定・純関数） |
| `src/core/cards/` | `Card` / `Deck`（注入可能な乱数）/ `Hand`（A の自動計算） |
| `src/core/events/` | `EventBus` とフック定義 |
| `src/core/entities/` | `Entity`（HP・Block・スロット・fallbackSkill）、敵定義、敵AI |
| `src/relics/` | `Relic` インターフェースとレリック一覧（敵の特性も同じ仕組み） |
| `src/run/` | 冒険の状態（HP・スロット・レリックの持ち越し）と報酬の抽選 |
| `src/ui/` | DOM ベースの View（Core には依存されない） |

### ステートマシン

```
Init → Deal → PlayerAction ─ Hit ─→ PlayerAction
                           ├ Stand ─→ EnemyAction ─→ Initiative
                           ├ バースト ─→ Initiative
                           └ 撤退 ─→ Surrender ─→ CheckDeath
Initiative → FirstAction → SurvivalCheck → SecondAction → CheckDeath → Deal / 終了
                         └ (同時攻撃・後攻なし) → CheckDeath
```

## イベントフック（レリック拡張）

`machine.bus.on(name, handler, priority?)` で購読。ハンドラはペイロードを書き換えるか、新しいペイロードを return すると値を改変できる。

```ts
bus.on('onDamageCalculated', (p) => ({ ...p, damage: p.damage + 2 }));                // ダメージ改変
bus.on('onInitiativeDecided', (p) => ({ ...p, turn: { ...p.turn, first: 'player' } })); // 行動順の改変
bus.on('onSkillActivated', (p) => ({ ...p, skill: null }));                           // スキルを不発に
bus.on('onBlockGained', (p) => ({ ...p, amount: p.amount + 3 }));                     // Block 獲得量
```

フック一覧: `onBattleStart` `onRoundStart` `onDealt` `onCardDrawn` `onStand` `onBust` `onInitiativeDecided` `onSkillActivated` `onDamageCalculated` `onDamageDealt` `onBlockGained` `onHealed` `onSurrender` `onRoundEnd` `onBattleEnd`

## ルールの解釈（仕様の補足）

- クリティカルは攻撃効果のみ ×1.5（回復・Block は変わらない）。端数切り捨て
- ディーラーはソフト17でもStand
- 山札はバトル中使い回し、残り15枚未満でラウンド開始時に再シャッフル（`RuleSet.reshuffleThreshold`）
- 難易度: 「16未満でヒット」だけの単純なボットで約1割がクリア（`vite-node` で試算）。敵の表向きカードを見られる実際のプレイヤーは、これより上がる想定
