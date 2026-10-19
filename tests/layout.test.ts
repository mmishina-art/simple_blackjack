// 短い画面（iPhone SE など）で、戦闘画面が1画面に収まるための指定が残っていること。
// 高さがぴったり収まるかは、ブラウザで 375×667 などの画面を実際に見て確認する（CLAUDE.md）。ここでは指定の有無と範囲だけを確認する。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
// コメントの中の { } や文言が、解析のじゃまにならないよう取り除く
const css = readFileSync(resolve(root, 'src/ui/styles/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const handView = readFileSync(resolve(root, 'src/ui/components/HandView.ts'), 'utf8');
const battleView = readFileSync(resolve(root, 'src/ui/BattleView.ts'), 'utf8');
const battleLog = readFileSync(resolve(root, 'src/ui/components/BattleLog.ts'), 'utf8');

/** `@media (max-height: Npx) { ... }` の中身を、すべて連結して返す（{ } の数を数えて閉じ括弧を探す）。 */
function mediaBlocks(maxHeight: number): string {
  const head = `@media (max-height: ${maxHeight}px) {`;
  let out = '';
  let from = 0;
  for (;;) {
    const start = css.indexOf(head, from);
    if (start < 0) return out;
    let depth = 1;
    let i = start + head.length;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    out += `${css.slice(start + head.length, i - 1)}\n`;
    from = i;
  }
}

/** 中身から `セレクタ { 宣言 }` を取り出す。 */
function rulesOf(block: string): Array<{ selector: string; body: string }> {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2].trim() }));
}

const TIERS = [850, 720];

describe('短い画面の戦闘画面', () => {
  it.each(TIERS)('高さ %ipx 以下で、戦闘画面を詰める指定がある', (height) => {
    const block = mediaBlocks(height);
    for (const selector of ['.battle .enemy-stage', '.battle .hand', '.battle .card', '.battle .actions .btn']) {
      expect(block, `${height}px: ${selector}`).toContain(selector);
    }
  });

  it('詰める指定は .battle の中だけにして、ほかの画面（タイトル・地図など）に及ばない', () => {
    for (const height of TIERS) {
      const rules = rulesOf(mediaBlocks(height));
      expect(rules.length).toBeGreaterThan(0);
      for (const { selector } of rules) {
        for (const one of selector.split(',').map((s) => s.trim())) expect(one, `${height}px: ${one}`).toMatch(/^\.battle\b/);
      }
    }
  });

  it('ボタンは、詰めても高さ 44px 以上にする（タップしやすさ）', () => {
    let checked = 0;
    for (const height of TIERS) {
      for (const { selector, body } of rulesOf(mediaBlocks(height))) {
        if (!selector.startsWith('.battle .actions .btn')) continue;
        const min = /min-height:\s*(\d+)px/.exec(body);
        if (!min) continue;
        checked++;
        expect(Number(min[1]), `${height}px ${selector}`).toBeGreaterThanOrEqual(44);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('手札が多いときは折り返さずカードを重ねる（HandView が .hand--many を付け、CSS が重ねる）', () => {
    expect(handView).toMatch(/classList\.toggle\('hand--many'/);
    expect(mediaBlocks(850)).toMatch(/\.battle \.hand--many \.card \+ \.card\s*\{[^}]*margin-left:\s*-\d+px/);
  });
});

describe('戦闘ログ欄（なくした）', () => {
  it('中央のログ欄は出さない。空いた高さは敵の舞台が使う', () => {
    expect(css).not.toMatch(/\.log\b/);
    expect(battleView).not.toMatch(/className = 'log'/);
    expect(css).toMatch(/\.battle \.enemy-stage\s*\{[^}]*flex:\s*1 1 auto/);
  });

  it('ログは読み上げ用（aria-live）の領域に残し、「記録」ボタンのシートで見返せる', () => {
    expect(battleLog).toMatch(/setAttribute\('aria-live', 'polite'\)/);
    expect(battleView).toMatch(/liveEl/);
    expect(battleView).toMatch(/'記録'/);
    expect(css).toMatch(/\.sr-only\s*\{[^}]*clip:/);
  });
});

describe('スロット表のメーター', () => {
  it('点灯したスロット（.slot--on）は下から光が満ちて明るく、まだのスロットは暗い', () => {
    expect(css).toMatch(/\.slot\s*\{[^}]*opacity:\s*0\.4/);
    expect(css).toMatch(/\.slot--on\s*\{[^}]*opacity:\s*1/);
    expect(css).toMatch(/\.slot--on::after\s*\{[^}]*scaleY\(1\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.slot,\s*\.slot::after\s*\{[^}]*transition:\s*none/);
  });

  it('各マスの効果の色は、攻撃・回復・ブロックで分ける', () => {
    for (const type of ['attack', 'heal', 'block']) expect(css).toContain(`.slot__badge--${type}`);
  });
});

describe('短い画面の装備画面', () => {
  const LOADOUT_HEIGHT = 750;

  it(`高さ ${LOADOUT_HEIGHT}px 以下で、装備画面を詰める指定がある（スキル獲得直後の「セットしない（売る）」が画面の外に出ない）`, () => {
    const block = mediaBlocks(LOADOUT_HEIGHT);
    for (const selector of ['.loadout .topbar__title', '.loadout .loadout__slots', '.loadout .armed', '.loadout .loadout__btn']) {
      expect(block, selector).toContain(selector);
    }
  });

  it('詰める指定は .loadout の中だけにして、同じ部品を使う出撃準備など、ほかの画面に及ばない', () => {
    const rules = rulesOf(mediaBlocks(LOADOUT_HEIGHT));
    expect(rules.length).toBeGreaterThan(0);
    for (const { selector } of rules) {
      for (const one of selector.split(',').map((s) => s.trim())) expect(one, one).toMatch(/^\.loadout\b/);
    }
  });

  it('スロットの行は詰めず、ボタンは 44px 以上にする（タップしやすさ）', () => {
    const rules = rulesOf(mediaBlocks(LOADOUT_HEIGHT));
    expect(rules.some((r) => /\.lslot/.test(r.selector))).toBe(false);
    const button = rules.find((r) => r.selector === '.loadout .loadout__btn');
    expect(Number(/min-height:\s*(\d+)px/.exec(button?.body ?? '')?.[1])).toBeGreaterThanOrEqual(44);
  });
});

describe('CSS の形', () => {
  it('{ } の数が合っていて、深さが 0 未満にならない（不要なルールを消したときの消し残しを検出する）', () => {
    let depth = 0;
    for (const ch of css) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});

describe('敵エリアのレイアウトと特性・弱点表示', () => {
  it('敵スキルスロット表は敵ステージと手札の間に配置され、モンスター表示を遮らない', () => {
    expect(battleView).toContain("section('enemy-area', this.enemyHp.el, this.enemyView.el, this.enemySlotStrip.el, this.enemyHand.el)");
    expect(css).toContain('.enemy-area > .slots');
    expect(css).toContain('.enemy-area .slot');
  });

  it('特性は敵画像ステージ内に配置され、先頭アイコン（medal）が排除されている', () => {
    expect(battleView).toContain('this.enemyView.el.append(this.buildTraits())');
    // buildTraits 内で medal アイコンを生成していない
    const buildTraitsBody = /buildTraits\(\): HTMLElement \{([\s\S]*?)\n  \}/.exec(battleView)?.[1] ?? '';
    expect(buildTraitsBody).not.toContain('medal');
    // CSS でステージ内下部に配置され、1行収まり（nowrap / ellipsis）が指定されている
    expect(css).toContain('.enemy-trait {');
    expect(css).toContain('bottom: 4px;');
    expect(css).toContain('.enemy-trait__text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis;');
  });

  it('魔導士用の弱点表示は特性から分離され、手札ヘッダーに配置され右寄せされる', () => {
    expect(battleView).toContain('buildWeakness()');
    expect(battleView).toContain('this.enemyHand.attachHeaderRight(weaknessEl)');
    expect(handView).toContain('attachHeaderRight');
    expect(handView).toContain('hand__header');
    expect(css).toContain('.hand__header { display: flex; align-items: center; justify-content: space-between;');
    expect(css).toContain('.enemy-weakness');
  });
});

describe('手札を引く前後のレイアウト安定性（動的シフト・ガクつき防止）', () => {
  it('.hand-block と .hand__total の間に直下セレクタ（>）を使わず、hand__header 経由でもスタイルが崩れない', () => {
    // 直下セレクタ（>）があると、div.hand__header が挟まった際にスタイル（font-size, line-height, min-height）が失われる
    expect(css).not.toMatch(/\.hand-block\s*>\s*\.hand__total/);
    expect(css).toMatch(/\.hand-block\s+\.hand__total\s*\{[^}]*min-height:\s*1\.1em/);
    expect(css).toMatch(/\.hand-block\s+\.hand__total\s*\{[^}]*line-height:\s*1\.1/);
  });

  it('手札ヘッダー（.hand__header）は全ブレークポイントで最小高さを固定し、手札が0枚〜バーストでもガクつかない', () => {
    // 基本（通常時）: 38px
    expect(css).toMatch(/\.hand__header\s*\{[^}]*min-height:\s*38px/);
    // 高度 850px 以下: 32px
    const block850 = mediaBlocks(850);
    expect(block850).toMatch(/\.battle \.hand__header\s*\{[^}]*min-height:\s*32px/);
    // 高度 720px 以下: 28px
    const block720 = mediaBlocks(720);
    expect(block720).toMatch(/\.battle \.hand__header\s*\{[^}]*min-height:\s*28px/);
  });

  it('戦闘中の手札カード（.battle .hand__cards）は折り返さず（nowrap）、4枚以上で重ねて1行に収める', () => {
    expect(css).toMatch(/\.battle \.hand__cards\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(handView).toMatch(/const MANY_CARDS = 4;/);
    expect(css).toMatch(/\.battle \.hand--many \.card \+ \.card\s*\{[^}]*margin-left:\s*-\d+px/);
  });

  it('手札枚数の変化（0枚→2枚→3枚→4枚以上）やバーストによって手札領域のレイアウト構造が破綻しない', () => {
    // HandView の実装において、カードが引かれるたびにクラス名と構造が一貫していること
    expect(handView).toContain("this.headerEl.className = 'hand__header'");
    expect(handView).toContain("this.rowEl.className = 'hand'");
    expect(handView).toContain("this.totalEl.className = 'hand__total'");
    expect(handView).toContain("this.rowEl.classList.toggle('hand--many', hand.size >= MANY_CARDS)");
    expect(handView).toContain("this.totalEl.classList.toggle('hand__total--bust', bust)");
  });

  it('.battle .hand はブレークポイントごとに高さを固定（84px / 64px / 58px）し、カード追加やスキル変化で伸縮しない', () => {
    expect(css).toMatch(/\.battle \.hand\s*\{[^}]*height:\s*84px/);
    expect(mediaBlocks(850)).toMatch(/\.battle \.hand\s*\{[^}]*height:\s*64px/);
    expect(mediaBlocks(720)).toMatch(/\.battle \.hand\s*\{[^}]*height:\s*58px/);
  });
});

describe('戦闘画面のユーティリティボタン（記録・BGMオンオフ）', () => {
  it('敵HPバーの右端に「記録」と「BGMオンオフ（♪）」が配置されている', () => {
    expect(battleView).toContain("historyBtn.textContent = '記録'");
    expect(battleView).toContain('topRight.append(historyBtn, this.muteBtn)');
    expect(battleView).toContain('this.enemyHp.attachRight(topRight)');
    expect(css).toContain('.hpbar--enemy .top-row__right');
    expect(css).toContain('.hpbar--enemy .mute');
    expect(css).toContain('.hpbar--enemy .info-btn');
  });
});

describe('メニューパーツの鋲（リベット）の基本ルールとモンスター表示領域の最大化', () => {
  it('基本ルール: 押せるパネル（ボタン、選択カード、選択肢）には鋲を残し、押せない枠（敵枠、味方枠、シート外枠、インベントリ枠）は鋲を持たない', () => {
    // 押せない表示枠（.enemy-area, .player-area, .sheet, .loadout__inv）は var(--plate) のみで鋲を持たない
    const frameMatch = css.match(/\.enemy-area,\s*\.player-area,\s*\.sheet,\s*\.loadout__inv[^{]*\{([^}]+)\}/);
    expect(frameMatch).not.toBeNull();
    const frameRules = frameMatch![1];
    expect(frameRules).toContain('background: var(--plate);');
    expect(frameRules).not.toContain('var(--rivets)');

    // 押せるパネル・ボタン・選択札（.choice__card, .btn, .pick 等）は四隅に鋲（--rivets）を持つ
    const clickableMatch = css.match(/\.choice__card,\s*\.btn,\s*\.pick,\s*\.sheet__close,\s*\.codex-tabs__btn,\s*\.topbar__back[^{]*\{([^}]+)\}/);
    expect(clickableMatch).not.toBeNull();
    const clickableRules = clickableMatch![1];
    expect(clickableRules).toContain('background: var(--rivets), var(--plate);');
  });

  it('戦闘画面の敵モンスター表示領域（.enemy-stage / .enemy-sprite）が拡大設定されている', () => {
    expect(css).toMatch(/\.battle \.enemy-stage\s*\{[^}]*flex:\s*1\s+1\s+auto/);
    expect(css).toMatch(/\.battle \.enemy-sprite\s*\{[^}]*height:\s*98%/);
    expect(css).toMatch(/\.battle \.enemy-sprite\s*\{[^}]*max-height:\s*280px/);
    expect(css).toMatch(/\.battle \.enemy-sprite\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*12px\)/);
  });

  it('敵のサイズ感（小・中・大・飛行）に応じた表示スタイルが定義されている', () => {
    expect(css).toMatch(/\.battle \.enemy-sprite--lg,\s*\.battle \.enemy-sprite--large\s*\{[^}]*height:\s*100%/);
    expect(css).toMatch(/\.battle \.enemy-sprite--md,\s*\.battle \.enemy-sprite--medium\s*\{[^}]*height:\s*78%/);
    expect(css).toMatch(/\.battle \.enemy-sprite--sm,\s*\.battle \.enemy-sprite--small\s*\{[^}]*height:\s*52%/);
    expect(css).toMatch(/\.battle \.enemy-sprite--flying\s*\{[^}]*align-self:\s*center/);
  });
});

