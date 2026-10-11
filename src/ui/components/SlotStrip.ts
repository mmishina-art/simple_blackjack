import type { Entity } from '../../core/entities/Entity';
import type { RuleSet } from '../../core/rules/RuleSet';
import { describeSkill, getSkill, SLOT_KEYS, slotKeyOf, slotLabel } from '../../core/skills/Skill';

/** 合計値スロット表（11以下〜21）と、現在の合計値で発動するスキルの表示。 */
export class SlotStrip {
  readonly el = document.createElement('div');
  private cells = new Map<number, HTMLElement>();
  private caption = document.createElement('div');

  constructor() {
    this.el.className = 'slots';
    const row = document.createElement('div');
    row.className = 'slots__row';
    for (const key of SLOT_KEYS) {
      const cell = document.createElement('div');
      cell.className = 'slot';
      this.cells.set(key, cell);
      row.append(cell);
    }
    this.caption.className = 'slots__caption';
    this.el.append(row, this.caption);
  }

  /** preview: 現在の合計値で発動するスキルの予測テキスト（レリック補正込み）。省略時は簡易表示。 */
  update(entity: Entity, rules: RuleSet, preview?: string): void {
    const size = entity.hand.size;
    const total = entity.hand.total(rules);
    const bust = size > 0 && total > rules.bustLimit;
    const active = size > 0 && !bust ? slotKeyOf(total) : null;

    for (const [key, cell] of this.cells) {
      const id = entity.slots[key];
      const icon = id ? getSkill(id).icon : '·';
      cell.className = `slot${id ? ' slot--set' : ''}${key === active ? ' slot--active' : ''}`;
      cell.innerHTML = `<span class="slot__key">${slotLabel(key)}</span><span class="slot__icon">${icon}</span>`;
      cell.title = id ? `${getSkill(id).name}（${describeSkill(getSkill(id), entity.attack)}）` : `${getSkill(entity.fallbackSkill).name}（未設定・${describeSkill(getSkill(entity.fallbackSkill), entity.attack)}）`;
    }

    if (size === 0) this.caption.textContent = '';
    else if (bust) this.caption.textContent = 'バースト！ スキルは発動しない';
    else {
      const id = entity.slots[slotKeyOf(total)];
      const skill = getSkill(id ?? entity.fallbackSkill);
      this.caption.textContent = preview
        ? `予測: ${preview}${id ? '' : '（未設定）'}`
        : `発動: ${skill.name}（${describeSkill(skill, entity.attack)}）${id ? '' : ' ※未設定'}`;
    }
    this.el.classList.toggle('slots--bust', bust);
  }
}
