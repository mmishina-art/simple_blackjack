# Blackjack Roguelike (MVP / Phase 1)

ブラックジャック×ローグライクの対戦型RPG。スマホ縦画面・PWA。

## 遊び方

ブラックジャックで合計値を作り、その**合計値に対応するスロットのスキル**を発動して戦う。レベル・経験値はなく、強化は「装備スキル（スロット）」と「レリック」だけ。

### ラウンドの流れ

1. 配牌 → Hit / Stand / 撤退（防御）を選ぶ（敵の2枚目は裏向き）
2. 双方スタンド後、合計値を比較して**行動順**を決める
   - 合計値が大きい方が先攻、小さい方が後攻
   - 同値は同時攻撃（防御・回復 → 攻撃 → 死亡判定の順）
   - バーストした側は行動不能。相手は先制クリティカル（攻撃 ×1.5）
   - 初手ブラックジャック（2枚で21）は、その行動がクリティカル
3. 先攻がスロットのスキルを発動 → 後攻の生存確認 → 後攻が発動
4. ラウンド終了時に Block（シールド）が0に戻る。HP が0になった側の負け（相打ちはプレイヤー敗北）

撤退（サレンダー）は、自分のスキルを発動せず Block 5 を得る防御行動。敵は通常どおり引いて行動する（行動順の比較なし）。

### ナンバースロット

合計値 `11以下 / 12 / … / 21` それぞれにスキルをセットできる。未設定の合計値は `fallbackSkill`（既定は基本攻撃・攻撃3）が発動する。

- 初期スロット: `11以下=小攻撃 / 15=シールド / 18=回復 / 20=大攻撃`
- **21 は「会心の一撃」（攻撃14・必ずクリティカル）で固定**。付け替えは「封印の鍵」のレリックで解禁。「覇王の宝珠」は会心の一撃を「覇王の一撃」（攻撃16・必ず会心 + Block 8）に変える
- スキルは取得時にスロットへセットし、マップ画面の「編成」でいつでも付け替えられる（外したスキルは持ち物に残る）

### ステージ（ステージ1「忘れられた地下墓所」）

駒を1度に1マスずつ進める。途中で3つの道に分かれ（左=運試し・中=安全・右=スキル稼ぎ）、大広間で合流し、再び分岐してボス（黒竜）のマスへ。

| マス | 効果 |
|---|---|
| 敵 | 戦闘。勝つとスキルを3択で獲得し、そのままスロットへセット |
| 宝箱 | レリックを3択で獲得 |
| 宿屋 | 最大HPの50%回復 |
| 祠 | ランダム効果: 最大HP+8 / HP全回復 / スキル獲得 / 血の契約（HP-10でレリック）/ 呪い（HP-10）/ 静寂 |
| 何もなし | 通過するだけ |
| ボス | 黒竜。倒すと踏破 |

戦闘後の自動回復はなく、HP は持ち越し。回復は宿屋・祠が頼り。済みのマス（倒した敵・開けた宝箱など）は再発動しない。

敵: スライム / 骸骨兵（骨の鎧）/ 大蝙蝠（同値なら先攻）/ 屍食鬼（HPを削ると回復）/ 黒竜（攻撃+3）

レリック: 血塗れの砥石 / 鋼の胸当て / 吸血の牙 / 身代わりの人形 / 運命の指輪 / 疾風の靴 / 堅牢の盾 / 命の蝋燭 / 覇王の宝珠 / 封印の鍵

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
| `src/core/rules/` | `RuleSet`（クリティカル倍率・撤退 Block 等）、`initiative`（行動順の決定・純関数） |
| `src/core/cards/` | `Card` / `Deck`（注入可能な乱数）/ `Hand`（A の自動計算） |
| `src/core/events/` | `EventBus` とフック定義 |
| `src/core/entities/` | `Entity`（HP・Block・スロット・fallbackSkill）、敵定義、敵AI |
| `src/relics/` | `Relic` インターフェースとレリック一覧（敵の特性も同じ仕組み） |
| `src/map/` | マップ定義（`StageMap`・ステージ1）と、宿屋・祠のイベント |
| `src/run/` | 冒険の状態（位置・HP・スロット・持ち物・レリック）、スキルの付け替え、報酬の抽選 |
| `src/ui/` | DOM ベースの View（Core には依存されない） |

### ステートマシン

```
Init → Deal → PlayerAction ─ Hit ─→ PlayerAction
                           ├ Stand ─→ EnemyAction ─→ Initiative
                           ├ バースト ─→ Initiative
                           └ 撤退 ─→ Surrender ─→ EnemyAction ─→ Initiative（敵のみ行動）
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
