import type { CharacterId, SkillId } from '../core/skills/Skill';

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
  shield_bearer: ['pierce_stab', 'shield', 'bulwark', 'shield_bash', 'heavy'], // 大盾: 貫通と盾技
  mimic: ['heavy', 'chop', 'drain', 'bulwark', 'pierce_stab'],               // 貪欲な宝箱: 重撃と吸収
  // 第2階層
  merman: ['twin_strike', 'lunge', 'mend', 'drain', 'guard'],                // 素早い連撃・再生
  gargoyle: ['shield', 'bulwark', 'heavy', 'chop', 'pierce_stab'],           // 石の肌: 守りと重い一撃
  wraith: ['drain', 'pierce_stab', 'mend', 'holy_light', 'twin_strike'],     // 霊: 貫く・吸う
  gambler: ['twin_strike', 'pierce_stab', 'lunge', 'siphon', 'flurry'],      // 賭博師: 連撃と急所突き
  colossus: ['smash', 'heavy', 'bulwark', 'mend', 'berserk'],                // 腐肉の巨兵: 豪打と再生
  iron_golem: ['pierce_stab', 'heavy', 'smash', 'bulwark', 'shield_bash'],   // 鋼のブロック: 貫く・重い一撃
  drowned_knight: ['slash', 'bulwark', 'heavy', 'pierce_stab', 'twin_strike'], // 水没した騎士: 守りと重撃・連撃
  // 第3階層
  serpent: ['twin_strike', 'berserk', 'drain', 'impale', 'flurry'],          // 深淵の海蛇: 連撃・再生
  flame: ['berserk', 'rampage', 'chop', 'heavy', 'twin_strike'],             // 炎: 荒々しい攻撃
  golem: ['shield_bash', 'bulwark', 'heavy', 'smash', 'fortress'],           // 溶岩の巨体: 守りと一撃
  imp: ['drain', 'impale', 'siphon', 'berserk', 'pierce_stab'],              // 悪魔: 吸魂・貫く
  magma_serpent: ['twin_strike', 'berserk', 'rampage', 'impale', 'flurry'], // 溶岩の大蛇: 荒々しい連撃・貫通
};

/** 魔導士で冒険しているときの、敵ごとの落とし物（属性魔法・反射・吸収）。 */
export const MAGE_ENEMY_DROPS: Record<string, readonly SkillId[]> = {
  // 第1階層
  slime: ['frost_shield', 'aqua_mend', 'fire_bolt', 'mana_ward'],
  skeleton: ['fire_bolt', 'flame_wave', 'mana_ward', 'fire_magic'],
  bat: ['spark', 'ice_needle', 'element_drain', 'twin_thunder'],
  ghoul: ['fire_bolt', 'flame_wave', 'aqua_mend', 'element_drain'],
  shield_bearer: ['thunder_lance', 'mana_ward', 'mirror_coat', 'spark'],
  mimic: ['spark', 'thunder_lance', 'mirror_coat', 'element_drain'],
  // 第2階層
  merman: ['spark', 'twin_thunder', 'aqua_mend', 'blizzard'],
  gargoyle: ['mana_ward', 'mirror_coat', 'thunder_lance', 'spark'],
  wraith: ['fire_bolt', 'flame_wave', 'fire_magic', 'element_drain'],
  gambler: ['twin_thunder', 'thunder_lance', 'ice_needle', 'judgement_bolt'],
  colossus: ['fire_magic', 'meteor', 'frost_shield', 'aqua_mend'],
  iron_golem: ['thunder_lance', 'mirror_coat', 'aegis_mirror', 'twin_thunder'],
  drowned_knight: ['spark', 'thunder_lance', 'mirror_coat', 'blizzard'],
  // 第3階層
  serpent: ['twin_thunder', 'blizzard', 'absolute_zero', 'judgement_bolt'],
  flame: ['ice_needle', 'blizzard', 'frost_shield', 'meteor'],
  golem: ['blizzard', 'absolute_zero', 'mirror_coat', 'aegis_mirror'],
  imp: ['element_drain', 'astral_drain', 'blizzard', 'absolute_zero'],
  magma_serpent: ['blizzard', 'absolute_zero', 'astral_drain', 'meteor'],
};

/** 敵の落とし物の候補（なければ空）。 */
export function dropsOf(enemyId: string | undefined, character: CharacterId = 'warrior'): readonly SkillId[] {
  const table = character === 'mage' ? MAGE_ENEMY_DROPS : ENEMY_DROPS;
  return (enemyId && table[enemyId]) || [];
}
