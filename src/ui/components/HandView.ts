import type { Entity } from '../../core/entities/Entity';
import type { RuleSet } from '../../core/rules/RuleSet';
import { cardElement } from './CardView';

/** 手札と合計値の表示。 */
export class HandView {
  readonly el = document.createElement('div');
  private cardsEl = document.createElement('div');
  private totalEl = document.createElement('div');
  private shown = 0;

  constructor() {
    this.el.className = 'hand';
    this.cardsEl.className = 'hand__cards';
    this.totalEl.className = 'hand__total';
    this.el.append(this.cardsEl, this.totalEl);
  }

  update(entity: Entity, rules: RuleSet): void {
    const { hand } = entity;
    const key = hand.cards.map((c) => c.suit + c.rank + (hand.isFaceDown(c) ? '*' : '')).join(',');
    if (key !== (this.cardsEl.dataset.key ?? '')) {
      const isGrowth = hand.size > this.shown;
      this.cardsEl.replaceChildren(
        ...hand.cards.map((c, i) => {
          const el = cardElement(c, hand.isFaceDown(c));
          if (isGrowth && i >= this.shown) el.classList.add('card--deal');
          return el;
        }),
      );
      this.cardsEl.dataset.key = key;
      this.shown = hand.size;
    }

    if (hand.size === 0) this.totalEl.textContent = '';
    else {
      const total = hand.hasHidden ? `${hand.visibleTotal(rules)} + ?` : String(hand.total(rules));
      const bust = !hand.hasHidden && hand.isBust(rules);
      this.totalEl.textContent = bust ? `${total} BUST` : total;
      this.totalEl.classList.toggle('hand__total--bust', bust);
    }
  }
}
