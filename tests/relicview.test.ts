import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RELIC_POOL } from '../src/relics/catalog';
import { relicsByRarityDesc } from '../src/ui/components/relicMedal';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('所持レリックの確認', () => {
  it('一覧は、レア度の高い順（レジェンド → レア → コモン）。同じレア度は、持った順', () => {
    const pick = (...ids: string[]) => ids.map((id) => RELIC_POOL.find((r) => r.id === id)!);
    const sorted = relicsByRarityDesc(pick('shield', 'whetstone', 'cup', 'candle', 'fullring', 'breastplate'));
    expect(sorted.map((r) => r.id)).toEqual(['cup', 'breastplate', 'whetstone', 'fullring', 'shield', 'candle']);
    expect(relicsByRarityDesc([])).toEqual([]);
  });

  it('装備画面にレリックのタブがある（確認のときだけ。置き先を決めるセット待ちのときは出さない）', () => {
    const src = read('src/ui/LoadoutScreen.ts');
    expect(src).toContain("tab: 'skills' | 'relics'");
    expect(src).toContain('if (!armed) {'); // タブはセット待ちでないときだけ
    expect(src).toContain('relicsByRarityDesc(run.relics)');
    expect(src).toContain('レリックは、まだ持っていない');
  });

  it('地図・戦闘画面のレリックのアイコンは、タップで説明が出る（ボタン）。タップできる範囲は、見た目より広い', () => {
    expect(read('src/ui/MapView.ts')).toContain('relicButton(r, run.slots)');
    expect(read('src/ui/BattleView.ts')).toContain('relicButton(r, this.run.slots)');
    const css = read('src/ui/styles/main.css');
    expect(css).toMatch(/\.relic-btn::before \{ content: ''; position: absolute; inset: -10px -4px; \}/); // 24px + 20px = 縦 44px
    expect(read('src/ui/components/relicMedal.ts')).toContain("b.type = 'button'");
    expect(read('src/ui/components/RelicSheet.ts')).toContain("closeLabel: '閉じる'");
  });
});
