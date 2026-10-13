import type { RuleSet } from '../rules/RuleSet';
import type { Card } from './Card';
import type { Deck } from './Deck';
import { Hand } from './Hand';

export interface DrawOdds {
  /** 次に引いたカードでバースト（合計が上限超え）になる確率（0〜1）。 */
  bust: number;
  /** 次に引いたカードで合計がちょうど 21（ブラックジャックの得点）になる確率（0〜1）。 */
  twentyOne: number;
}

/**
 * 次に1枚引いたときのバースト・21 の確率。
 * プレイヤーから見て「まだ見えていないカード」= 山札 + 敵の伏せカード、のどれが次に来るかは等確率なので、
 * その集合から数える（伏せカードの中身は、山札と合わせた集合の中では区別できず、情報は漏れない）。
 * 見えていないカードがなければ null。レリックでカードの数字が変わる効果は反映しない。
 */
export function drawOdds(deck: Deck, mine: Hand, enemy: Hand, rules: RuleSet): DrawOdds | null {
  const unseen: Card[] = [...deck.contents, ...enemy.cards.filter((c) => enemy.isFaceDown(c))];
  if (unseen.length === 0) return null;
  let bust = 0;
  let twentyOne = 0;
  for (const card of unseen) {
    const total = Hand.totalOf([...mine.cards, card], rules);
    if (total > rules.bustLimit) bust++;
    else if (total === rules.blackjackScore) twentyOne++;
  }
  return { bust: bust / unseen.length, twentyOne: twentyOne / unseen.length };
}

/** 「31%」のような表示。0 でも 100 でもないのに丸めて 0 / 100 になるときは、「<1%」「>99%」にする。 */
export function formatPercent(p: number): string {
  const pct = Math.round(p * 100);
  if (pct === 0 && p > 0) return '<1%';
  if (pct === 100 && p < 1) return '>99%';
  return `${pct}%`;
}
