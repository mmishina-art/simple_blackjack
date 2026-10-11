/**
 * バトル中のルール値。ハードコードを避けるため、すべての判定はここを参照する。
 * レリックはこのオブジェクトを書き換えることでルールを改変できる。
 */
export interface RuleSet {
  /** この値を超えるとバースト。 */
  bustLimit: number;
  /** ブラックジャック（初手2枚）とみなす合計値。 */
  blackjackScore: number;
  /** クリティカル時の攻撃倍率（端数切り捨て）。 */
  critMultiplier: number;
  /** サレンダー（防御）時にプレイヤーが得る Block。 */
  surrenderBlock: number;
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
    critMultiplier: 1.5,
    surrenderBlock: 5,
    initialCards: 2,
    aceBonus: 10,
    reshuffleThreshold: 15,
    ...overrides,
  };
}
