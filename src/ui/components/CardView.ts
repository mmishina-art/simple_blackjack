import type { Card } from '../../core/cards/Card';

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' } as const;

export function cardElement(card: Card, faceDown: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card';
  if (faceDown) {
    el.classList.add('card--back');
    return el;
  }
  if (card.suit === 'H' || card.suit === 'D') el.classList.add('card--red');
  el.innerHTML = `<span class="card__rank">${card.rank}</span><span class="card__suit">${SUIT_SYMBOL[card.suit]}</span>`;
  return el;
}
