/**
 * バトル中のルール値。ハードコードを避けるため、すべての判定はここを参照する。
 * レリックはこのオブジェクトを書き換えることでルールを改変できる。
 */
export interface RuleSet {
  /** この値を超えるとバースト。 */
  bustLimit: number;
  /** ブラックジャック（初手2枚）とみなす合計値。 */
  blackjackScore: number;
  /** 防御（サレンダー）したラウンドに、プレイヤーが受けるダメージの上限（防具を渡さない場合の既定値）。 */
  defendCap: number;
  /** 配牌枚数。 */
  initialCards: number;
  /** A を 11 として数える際の加算量（A=1 に対する +10）。 */
  aceBonus: number;
  /** 山札の残りがこの枚数を下回ったらラウンド開始時に再シャッフル。 */
  reshuffleThreshold: number;
  /** バーストした側が、相手の攻撃から受けるダメージの倍率（小数点以下は切り捨て。ブロックが先に吸収する）。 */
  bustDamageMultiplier: number;
}

export function createRuleSet(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    bustLimit: 21,
    blackjackScore: 21,
    defendCap: 5,
    initialCards: 2,
    aceBonus: 10,
    reshuffleThreshold: 15,
    bustDamageMultiplier: 1.5,
    ...overrides,
  };
}
