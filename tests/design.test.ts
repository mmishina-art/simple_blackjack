import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('全体の見た目のルール（段階1）', () => {
  it('戻る操作は左上の「‹ 戻る」（ショップの「出る」・祠の「立ち去る」をやめた）', () => {
    expect(read('src/ui/ShopScreen.ts')).toContain("buildTopBar('ショップ', opts.onLeave)");
    const shrine = read('src/ui/ShrineScreen.ts');
    expect(shrine).not.toContain("name: '立ち去る'");
    expect(shrine).toContain('onBack: opts.onLeave');
    expect(read('src/ui/ChoiceScreen.ts')).toContain('if (cfg.onBack) screen.append(buildTopBar(cfg.heading, cfg.onBack))');
  });
  it('ボタンの色の役割: 進む = 金（btn--primary）、危険 = 赤（danger）', () => {
    expect(read('src/main.ts')).toContain("'btn btn--primary title__start'");
    expect(read('src/ui/InnScreen.ts')).toContain("'btn btn--primary'");
    expect(read('src/ui/EndingScreen.ts')).toContain('btn--primary');
    expect(read('src/ui/SettingsScreen.ts')).toContain("kind: 'danger'");
    expect(read('src/ui/MapView.ts')).toContain("kind: 'danger', icon: '去'");
    const css = read('src/ui/styles/main.css');
    for (const k of ['.btn--primary {', '.pick--danger {', '--primary-line', '--danger-line', '--popup-hi']) expect(css, k).toContain(k);
  });
  it('一覧のレア度は色だけ（読み上げ用の見えない文字つき）。札は説明のポップアップだけ', () => {
    for (const f of ['src/ui/ChoiceScreen.ts', 'src/ui/ShopScreen.ts', 'src/ui/components/SkillSheet.ts', 'src/ui/components/relicMedal.ts', 'src/ui/MetaScreens.ts', 'src/ui/LoadoutScreen.ts']) {
      expect(read(f), f).not.toContain('rarityBadge(');
      expect(read(f), f).toContain('rarityNote(');
    }
    expect(read('src/ui/components/SkillInfo.ts')).toContain('rarityBadge(');
    expect(read('src/ui/rarity.ts')).toContain('class="sr-only"');
  });
});

describe('全体の見た目のルール（段階2）', () => {
  it('スキル獲得・宝箱・踏破の褒美も、上に挿絵（店・祠・宿屋と同じ形）', () => {
    const main = read('src/main.ts');
    expect(main).toContain("scene: { kind: 'reward'");
    expect(main).toContain("scene: { kind: 'chest', line");
    expect(main).toContain("scene: { kind: 'chest', title: '踏破の褒美'");
    expect(read('src/ui/styles/main.css')).toContain('.choice:has(.scene) { justify-content: flex-start;');
  });
});

describe('レリックのメダルは六角形', () => {
  it('所持・図鑑・ショップ・宝箱の遺物に medal--relic を付ける', () => {
    expect(read('src/ui/components/relicMedal.ts')).toContain('medal--relic');
    expect(read('src/ui/MetaScreens.ts')).toContain('medal--relic');
    expect(read('src/ui/ShopScreen.ts')).toContain('medal--relic');
    expect(read('src/ui/ChoiceScreen.ts')).toContain("opt.relic ? ' medal--relic' : ''");
    expect(read('src/main.ts')).toContain('relics.map((r) => ({ ...r, relic: true }))');
    expect(read('src/ui/styles/main.css')).toContain('--hex: polygon(');
  });
});

describe('枠とボタン: 鉄と鋲', () => {
  it('窓・札・ボタンは鋲つきの鉄板。役割の色は --plate で残す', () => {
    const css = read('src/ui/styles/main.css');
    const block = css.slice(css.indexOf('枠とボタン: 鉄と鋲'));
    expect(block).toContain('background: var(--rivets), var(--plate);');
    for (const k of ['.btn--primary, .pick--confirm', '.btn--hit, .pick--danger', '.btn--stand', '.btn--surrender']) expect(block, k).toContain(k);
    // 影は要素ごとの --plate-edge を使うので、:root で決めない（決めると、すべて同じ色になる）
    const root = block.slice(block.indexOf(':root {'), block.indexOf('}', block.indexOf(':root {')));
    expect(root).not.toContain('--iron-shadow');
  });
});
