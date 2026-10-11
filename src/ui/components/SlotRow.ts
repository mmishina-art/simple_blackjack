import { BASIC_ICON, describeSkill, fallbackLabel, slotLabel, type SkillDef, type SlotKey } from '../../core/skills/Skill';
import { slotLook } from '../../core/skills/look';
import type { EffectiveSkill } from '../../run/effective';
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
  const tone = look.special ? ` lslot--special lslot--${look.tone}` : '';
  const shown = o.skill ?? o.fallback;
  const eff = o.skill ? o.effective : undefined;

  // レリックで上書きされているときは、上書き後の名前と効果を赤字で示す
  const name = o.skill
    ? eff?.changed && eff.skill.id !== o.skill.id ? `<span class="over">${eff.skill.name}</span>` : o.skill.name
    : `${fallbackLabel(o.fallback)}・空き`;
  const desc = eff?.changed
    ? `<span class="over" title="本来: ${eff.baseText}">${eff.text}</span>`
    : describeSkill(shown, o.atk);
  const interactive = !o.locked && !!o.onTap;

  const row = document.createElement(interactive ? 'button' : 'div');
  row.className = o.locked
    ? `lslot lslot--fixed${tone}`
    : `lslot lslot--set ${rarityClass(look.rarity)}${tone}${o.target ? ' lslot--target' : ''}${interactive ? ' lslot--tap' : ''}`;
  row.innerHTML = `<span class="lslot__key">${slotLabel(o.key)}</span>
    <span class="medal medal--sm">${o.skill ? o.skill.icon : BASIC_ICON}</span>
    <span class="lslot__name">${name}${o.tag ? ` <em class="lslot__tag${o.tagTone === 'custom' ? ' lslot__tag--custom' : ''}">${o.tag}</em>` : ''}</span>
    <span class="lslot__desc">${desc}</span>
    <span class="lslot__go" aria-hidden="true">${interactive ? '›' : ''}</span>`;
  if (interactive) row.addEventListener('click', o.onTap!);
  return row;
}
