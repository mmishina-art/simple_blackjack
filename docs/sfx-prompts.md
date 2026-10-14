# 効果音のプロンプト（生成 AI 用）

ダークファンタジーの絵（`docs/enemy-art-prompts.md`）に合わせた、重く暗い効果音を作ってもらうための頼み方。**1 音ずつ**頼む。音の生成 AI は英語の指示のほうが通りやすいので、プロンプトは英語にしてある（日本語は説明）。

## 形式

| 項目 | 指定 |
|---|---|
| 形式 | WAV（なければ MP3） |
| 長さ | 下の表のとおり（短いほど、戦闘のテンポがよい） |
| 中身 | 効果音だけ。音楽・メロディ（指定したもの以外）・人の言葉は入れない |
| 始まり | 音の前に無音を入れない（押した瞬間に鳴るように） |
| 保存 | Google ドライブの「blackjack-enemies」フォルダに、下の「ファイル名」で |

## 共通の指定（毎回、最初に付ける）

```
Create a single short sound effect for a dark fantasy roguelike card game.
Mood: heavy, dark, grim, medieval dungeon. Not bright, not cartoonish, not 8-bit or chiptune.
No music, no melody (unless asked), no speech. Start immediately with no leading silence. A short, natural stone-room reverb tail is fine.
```

## 1 音ずつの指定

**敵にダメージ（`sfx_attack.wav`、0.4〜0.6 秒）**: 刃が肉を断つ鈍い衝撃、骨のきしむ音、怪物のうめき
```
A sword slashes into a monster's flesh: a quick blade swish, a wet heavy impact, a short crack of bone, and a pained low growl from the monster. Painful and visceral, but not gory or splattery. Length about 0.5 seconds.
```

**自分がダメージを受ける（`sfx_damage.wav`、0.4〜0.6 秒）**: 体に響く、低く重い打撃
```
A heavy blunt blow hits an armored human body: a deep thud that you feel in the chest, a dull clink of chainmail, and a short muffled grunt. Length about 0.5 seconds.
```

**防いだ（`sfx_guard.wav`、0.2〜0.3 秒）**: 盾で受け止める、短く硬い金属音
```
A weapon strikes a steel shield and is blocked: a short, hard, dull metallic clang with a quick low thump. Very short decay. Length about 0.25 seconds.
```

**ブロックを得る（`sfx_block.wav`、0.4〜0.6 秒）**: 盾を構える、どっしりした響き
```
A warrior raises a heavy iron shield into position: a low solid whoosh and thump, followed by a dark, resonant metallic ring that rises slightly. Length about 0.5 seconds.
```

**ブロックを破壊（`sfx_break.wav`、0.4〜0.6 秒）**: 盾が砕ける
```
A powerful critical strike shatters a magical shield: a sharp crack and shattering of crystal or glass shards over a deep booming impact. Length about 0.5 seconds.
```

**回復（`sfx_heal.wav`、0.8〜1.0 秒）**: 暗いが、静かに癒える響き
```
A quiet dark healing spell: soft, low chime-like tones rising slowly in a minor key, with a gentle warm hum underneath. Calm and mysterious, not cheerful. Length about 0.9 seconds.
```

**カードを配る（`sfx_deal.wav`、0.1 秒）**: 古いカードが木の台をすべる音
```
An old, worn playing card slides and lands softly on a wooden table: a short, dry paper swish. Length about 0.1 seconds.
```

**カードをめくる（`sfx_flip.wav`、0.2 秒）**: 伏せたカードをめくる音
```
A face-down playing card is flipped over quickly: a crisp, short rising paper flick. Length about 0.2 seconds.
```

**ボタン（`sfx_click.wav`、0.1 秒）**: 低くこもった木を叩く音
```
A muted, low wooden knock, like tapping an old oak table once. Dark and soft. Length about 0.1 seconds.
```

**選ぶ（`sfx_pick.wav`、0.3〜0.4 秒）**: 石を置く音と、暗い鐘の小さな余韻
```
A small stone token is placed down with a low clunk, followed by a faint, dark, small bell ring. Length about 0.35 seconds.
```

**引き分け（`sfx_push.wav`、0.4 秒）**: 中身のない低い 2 つのノック
```
Two hollow, low knocks on a wooden door, evenly spaced. Neutral and empty. Length about 0.4 seconds.
```

**バースト（`sfx_bust.wav`、0.7〜0.9 秒）**: 不吉に下がる音
```
An ominous failure sting: a few low notes falling in a dissonant, unsettling way, ending on a deep dark drone. Not comedic. Length about 0.8 seconds.
```

**ブラックジャック（`sfx_blackjack.wav`、0.8〜1.0 秒）**: 低い鐘と、上へ積み上がる暗い和音
```
A dark triumphant sting: a deep church bell toll with a minor-key chord of bell tones rising upward. Powerful but grim. Length about 0.9 seconds.
```

**勝利（`sfx_victory.wav`、1.5〜2 秒）**: 重い銅鑼と、最後だけ長調で終わる和音
```
A grim victory sting after defeating a monster: a heavy gong-like bell, then a slow swelling chord that resolves to a major chord at the end. Dark, solemn, and conclusive, not cheerful. Length about 1.8 seconds.
```

**敗北（`sfx_defeat.wav`、2 秒）**: 沈んでいく低い 4 音と、長く消える最低音
```
A somber defeat sting: four slow, low notes sinking downward, ending with a very deep tone that fades away for a long time. Mournful. Length about 2 seconds.
```
