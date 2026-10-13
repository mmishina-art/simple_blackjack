import type { SkillId } from '../core/skills/Skill';

/**
 * 敵ごとの「落とし物」（報酬のスキルの候補）。敵の姿・特性に合わせたスキルが、報酬に多く並ぶ。
 * 報酬は、これらから count - 1 個 + 全体から 1 個（レア度の割合は階層ごと）。ボスは、スキルではなく遺物が報酬。
 * 道具・防具は報酬には出ない（ショップでだけ買える）。
 */
export const ENEMY_DROPS: Record<string, readonly SkillId[]> = {
  // 第1階層
  slime: ['guard', 'shield', 'mend', 'jab', 'rally'],                       // どろどろの体: 守りと回復
  skeleton: ['slash', 'chop', 'jab', 'lunge', 'heavy'],                      // 骨の剣: 斬る・叩く
  bat: ['drain', 'lunge', 'twin_strike', 'jab', 'siphon'],                   // 血を吸う・素早い
  ghoul: ['drain', 'mend', 'chop', 'berserk', 'holy_light'],                 // 屍を喰らい癒える
  // 第2階層
  merman: ['twin_strike', 'lunge', 'mend', 'drain', 'guard'],                // 素早い連撃・再生
  gargoyle: ['shield', 'bulwark', 'heavy', 'chop', 'pierce_stab'],           // 石の肌: 守りと重い一撃
  wraith: ['drain', 'pierce_stab', 'mend', 'holy_light', 'twin_strike'],     // 霊: 貫く・吸う
  iron_golem: ['pierce_stab', 'heavy', 'smash', 'bulwark', 'shield_bash'],   // 鋼のブロック: 貫く・重い一撃
  // 第3階層
  serpent: ['twin_strike', 'berserk', 'drain', 'impale', 'flurry'],          // 深淵の海蛇: 連撃・再生
  flame: ['berserk', 'rampage', 'chop', 'heavy', 'twin_strike'],             // 炎: 荒々しい攻撃
  golem: ['shield_bash', 'bulwark', 'heavy', 'smash', 'fortress'],           // 溶岩の巨体: 守りと一撃
  imp: ['drain', 'impale', 'siphon', 'berserk', 'pierce_stab'],              // 悪魔: 吸魂・貫く
};

/** 敵の落とし物の候補（なければ空）。 */
export function dropsOf(enemyId: string | undefined): readonly SkillId[] {
  return (enemyId && ENEMY_DROPS[enemyId]) || [];
}
