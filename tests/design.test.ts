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
