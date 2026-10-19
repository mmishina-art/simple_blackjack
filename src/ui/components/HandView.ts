import type { Entity } from '../../core/entities/Entity';
import type { RuleSet } from '../../core/rules/RuleSet';
import { cardElement } from './CardView';

/** 手札がこの枚数以上になったら、短い画面ではカードを重ねて1行に収める（折り返すと高さが増えるため）。 */
const MANY_CARDS = 5;

/** 手札と合計値の表示。 */
export class HandView {
  /** 合計値の行（上）と、手札の行（下: カードと、右側の「発動するスキル」の表示）をまとめた外枠。 */
  readonly el = document.createElement('div');
  /** 手札の行の右側。いま発動するスキルの名前とダメージなどを出す（SlotStrip の caption を入れる）。 */
  readonly side = document.createElement('div');
  private headerEl = document.createElement('div');
  private rowEl = document.createElement('div');
  private cardsEl = document.createElement('div');
  private totalEl = document.createElement('div');
  private shown = 0;

  constructor() {
    this.el.className = 'hand-block';
    this.headerEl.className = 'hand__header';
    this.rowEl.className = 'hand';
    this.cardsEl.className = 'hand__cards';
    this.side.className = 'hand__side';
    this.totalEl.className = 'hand__total';
    this.headerEl.append(this.totalEl);
    this.rowEl.append(this.cardsEl, this.side);
    this.el.append(this.headerEl, this.rowEl);
  }

  /** 合計値の右側にバッジなどを追加する（魔導士の弱点表示など）。 */
  attachHeaderRight(child: HTMLElement): void {
    this.headerEl.append(child);
  }

  update(entity: Entity, rules: RuleSet): void {
    const { hand } = entity;
    // 枚数が多いときは、短い画面でカードを重ねて1行に収める（CSS の .hand--many）
    this.rowEl.classList.toggle('hand--many', hand.size >= MANY_CARDS);
    const keys = hand.cards.map((c) => c.suit + c.rank + (hand.isFaceDown(c) ? '*' : ''));
    const key = keys.join(',');
    const prevKey = this.cardsEl.dataset.key ?? '';
    if (key !== prevKey) {
      const prev = prevKey.split(',');
      const isGrowth = hand.size > this.shown;
      this.cardsEl.replaceChildren(
        ...hand.cards.map((c, i) => {
          const el = cardElement(c, hand.isFaceDown(c));
          if (isGrowth && i >= this.shown) el.classList.add('card--deal');
          // 伏せられていた札がめくられた
          else if (prev[i] === `${keys[i]}*`) el.classList.add('card--flip');
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
