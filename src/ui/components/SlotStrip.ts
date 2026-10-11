import type { Entity } from '../../core/entities/Entity';
import type { RuleSet } from '../../core/rules/RuleSet';
import { BASIC_ICON, describeSkill, fallbackLabel, getSkill, SLOT_KEYS, slotKeyOf, slotLabel } from '../../core/skills/Skill';
import { slotLook } from '../../core/skills/look';
import { rarityClass } from '../rarity';

/** 合計値スロット表（11以下〜21）と、現在の合計値で発動するスキルの表示。プレイヤーと敵の両方で使う。 */
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

  /**
   * preview: 現在の合計値で発動するスキルの予測テキスト（レリック補正込み）。
   * totalHidden: 手札が伏せられていて合計値が分からない（敵の行動前）。
   */
  update(entity: Entity, rules: RuleSet, preview?: string, totalHidden = false): void {
    const size = entity.hand.size;
    const total = entity.hand.total(rules);
    const known = size > 0 && !totalHidden;
    const bust = known && total > rules.bustLimit;
    const active = known && !bust ? slotKeyOf(total) : null;
    const fallback = getSkill(entity.fallbackSkill);

    for (const [key, cell] of this.cells) {
      const id = entity.slots[key];
      const skill = id ? getSkill(id) : null;
      // 11以下と21は特殊スロット（金）。ほかはスキルのレア度に合わせる（空きはコモン）
      const look = slotLook(key, skill);
      cell.className = `slot ${look.special ? `slot--special slot--${look.tone}` : `slot--set ${rarityClass(look.rarity)}`}${key === active ? ' slot--active' : ''}`;
      cell.innerHTML = `<span class="slot__key">${slotLabel(key)}</span><span class="slot__icon">${skill ? skill.icon : BASIC_ICON}</span>`;
      cell.title = skill
        ? `${skill.name}（${describeSkill(skill, entity.attack)}）`
        : `${fallbackLabel(fallback)}（空きスロット・${describeSkill(fallback, entity.attack)}）`;
    }

    if (size === 0) this.caption.textContent = '';
    else if (totalHidden) this.caption.textContent = '手札が伏せられている（合計は不明）';
    else if (bust) this.caption.textContent = 'バースト！ スキルは発動しない';
    else {
      const id = entity.slots[slotKeyOf(total)];
      const skill = getSkill(id ?? entity.fallbackSkill);
      this.caption.textContent = preview
        ? `予測: ${preview}`
        : `発動: ${id ? skill.name : fallbackLabel(skill)}（${describeSkill(skill, entity.attack)}）`;
    }
    this.el.classList.toggle('slots--bust', bust);
  }
}
