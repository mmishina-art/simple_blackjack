import { BASIC_ICON, circledNumber, describeSkill, describeSkillShort, fallbackLabel, kindOfSkill, slotLabel, type SkillDef, type SlotKey } from '../../core/skills/Skill';
import { slotLook } from '../../core/skills/look';
import type { EffectiveSkill } from '../../run/effective';
import { kindTag, medalKindClass } from '../kind';
import { rarityClass } from '../rarity';

export interface SlotRowOptions {
  key: SlotKey;
  /** セットされているスキル。空き（通常攻撃）なら null。 */
  skill: SkillDef | null;
  /** 空きのときに発動するスキル（通常攻撃）。 */
  fallback: SkillDef;
  atk: number;
  /** 固定スロット: 選べない平らな行にする。 */
  locked?: boolean;
  /** レリックで上書きされている場合の、上書き後のスキル（赤字で表示）。 */
  effective?: EffectiveSkill;
  /** 名前の横の小さなタグ（「変更」「初期」など）。 */
  tag?: string;
  /** custom ならタグを目立つ色にする（変更済みの印）。 */
  tagTone?: 'custom';
  /** スキルを置く先として強調する（セット待ちのとき）。 */
  target?: boolean;
  onTap?(): void;
}

/**
 * スロット一覧の1行（編成・出撃準備で共通）。
 * 選べる行は右端に「›」が付く。固定スロットは枠なしの平らな行。11以下・21 は専用の色、ほかはレア度の色。
 */
export function buildSlotRow(o: SlotRowOptions): HTMLElement {
  const look = slotLook(o.key, o.skill);
  const shown = o.skill ?? o.fallback;
  const eff = o.skill ? o.effective : undefined;

  // レリックで上書きされているときは、上書き後の名前と効果を赤字で示す
  const name = o.skill
    ? eff?.changed && eff.skill.id !== o.skill.id ? `<span class="over">${eff.skill.name}</span>` : o.skill.name
    : `${fallbackLabel(o.fallback)}・空き`;
  // 右側は「種類と値」だけ（攻撃 15 / Block 6 / 回復 8）。計算式は、行にマウスを乗せたとき（title）に出る
  const short = describeSkillShort(eff?.changed ? eff.skill : shown, eff?.changed ? eff.atk : o.atk);
  const formula = eff?.changed ? eff.text : describeSkill(shown, o.atk);
  const baseNote = eff?.changed ? `\n本来: ${eff.baseText}` : '';
  const desc = eff?.changed ? `<span class="over">${short}</span>` : short;
  const detail = `${o.skill ? o.skill.name : fallbackLabel(o.fallback)}\n${formula}${baseNote}\n基本値（ATK）${o.atk}（合計 ${slotLabel(o.key)} のスロット）`;
  const interactive = !o.locked && !!o.onTap;

  const row = document.createElement(interactive ? 'button' : 'div');
  // 枠はどの行も同じデザイン。レア度は、アイコン（メダル）の色と光だけで示す。固定スロットは、少し薄く出す
  row.className = `lslot lslot--set${o.locked ? ' lslot--fixed' : ''}${o.target ? ' lslot--target' : ''}${interactive ? ' lslot--tap' : ''}`;
  row.title = detail;
  row.innerHTML = `<span class="lslot__key">${slotLabel(o.key)}<span class="lslot__atk" aria-label="基本値 ${o.atk}">${circledNumber(o.atk)}</span></span>
    <span class="medal medal--sm ${rarityClass(look.rarity)}${o.skill ? medalKindClass(kindOfSkill(o.skill)) : ''}">${o.skill ? o.skill.icon : BASIC_ICON}</span>
    <span class="lslot__name">${name}${o.skill ? ` ${kindTag(o.skill)}` : ''}${o.tag ? ` <em class="lslot__tag${o.tagTone === 'custom' ? ' lslot__tag--custom' : ''}">${o.tag}</em>` : ''}</span>
    <span class="lslot__desc">${desc}</span>
    <span class="lslot__go" aria-hidden="true">${interactive ? '›' : ''}</span>`;
  if (interactive) row.addEventListener('click', o.onTap!);
  return row;
}
