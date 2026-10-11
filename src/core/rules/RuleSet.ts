/**
 * バトル中のルール値。ハードコードを避けるため、すべての判定はここを参照する。
 * レリックはこのオブジェクトを書き換えることでルールを改変できる（例: bustLimit = 24）。
 */
export interface RuleSet {
  /** この値を超えるとバースト。 */
  bustLimit: number;
  /** ブラックジャック（初手2枚）とみなす合計値。 */
  blackjackScore: number;
  /** ブラックジャック勝利時のダメージ倍率（端数切り捨て）。 */
  blackjackMultiplier: number;
  /** 配牌枚数。 */
  initialCards: number;
  /** A を 11 として数える際の加算量（A=1 に対する +10）。 */
  aceBonus: number;
  /** 山札の残りがこの枚数を下回ったらラウンド開始時に再シャッフル。 */
  reshuffleThreshold: number;
}

export function createRuleSet(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    bustLimit: 21,
    blackjackScore: 21,
    blackjackMultiplier: 1.5,
    initialCards: 2,
    aceBonus: 10,
    reshuffleThreshold: 15,
    ...overrides,
  };
}
