import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('装備画面のスキルアイコンの説明', () => {
  it('スロット・防御・道具袋のアイコンをタップすると、説明のポップアップが出る（確認のときだけ。セット待ちのときは出さない）', () => {
    const src = read('src/ui/LoadoutScreen.ts');
    expect(src).toContain("onInfo: armed ? undefined");
    expect(src).toContain("where: '防御スロット'");
    expect(src).toContain("where: '道具袋'");
    expect(src).toContain('if (sk && !armed && pouchIcon)'); // 道具袋のアイコンも、確認のときだけ
    expect(src).toContain('e.stopPropagation()'); // アイコンのタップで、行の動作（置く・売る）が開かない
  });

  it('説明は、名前・種類・レア度・計算式と実数値・置ける場所。閉じるボタンは「閉じる」', () => {
    const src = read('src/ui/components/SkillInfo.ts');
    for (const k of ['describeSkill(skill, opts.atk)', 'placementNote(skill)', 'rarityBadge', 'kindTag', "closeLabel: '閉じる'"]) expect(src, k).toContain(k);
  });

  it('アイコンは見た目のまま、タップできる範囲だけ広げる（縦 44px 相当）', () => {
    const css = read('src/ui/styles/main.css');
    expect(css).toMatch(/\.lslot__icon::before \{ content: ''; position: absolute; inset: -10px -8px; \}/);
    expect(read('src/ui/components/SlotRow.ts')).toContain("b.type = 'button'");
  });
});
