import { defineSkill, slotsFromRanges, type SkillDef, type SkillId, type SlotTable } from './Skill';

/** 基本攻撃力（ATK）基準の攻撃スキル: ダメージ = floor(ATK × mult) + add */
const atk = (id: string, name: string, mult: number, add = 0, icon = '攻'): SkillDef =>
  defineSkill({ id, name, icon, effects: [{ type: 'attack', mult, add }] });

// ---- プレイヤーのスキル ----
export const BASIC_ATTACK_ID: SkillId = atk('basic_attack', '通常攻撃', 1, 0, '撃').id;
atk('small_attack', '小攻撃', 0.5, 0);
atk('big_attack', '大攻撃', 1, 5, '剛');
atk('jab', '突き', 1, 1, '突');
atk('slash', '斬撃', 1, 3, '斬');
atk('heavy', '重撃', 2, 1, '重');
atk('smash', '渾身の一撃', 3, 0, '渾');
defineSkill({ id: 'guard', name: 'シールド', icon: '守', effects: [{ type: 'block', amount: 6 }] });
defineSkill({ id: 'bulwark', name: '鉄壁の構え', icon: '壁', effects: [{ type: 'block', amount: 10 }] });
defineSkill({ id: 'shield', name: '盾', icon: '盾', effects: [{ type: 'block', amount: 8 }] });
defineSkill({ id: 'recover', name: '治癒', icon: '治', effects: [{ type: 'heal', amount: 10 }] });
defineSkill({
  id: 'shield_bash', name: '盾打ち', icon: '殴',
  effects: [{ type: 'attack', mult: 1 }, { type: 'block', amount: 5 }],
});
defineSkill({
  id: 'drain', name: '吸精', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 1 }, { type: 'heal', amount: 4 }],
});
defineSkill({
  id: 'rally', name: '鼓舞', icon: '鼓',
  effects: [{ type: 'block', amount: 5 }, { type: 'heal', amount: 4 }],
});

/** スロット21に固定されるスキル。必ずクリティカルになる（封印の鍵のレリックで付け替え可能）。 */
export const CRITICAL_STRIKE_ID: SkillId = defineSkill({
  id: 'critical_strike', name: '会心の一撃', icon: '会', alwaysCrit: true,
  effects: [{ type: 'attack', mult: 3 }],
}).id;
/** 覇王の宝珠で会心の一撃が置き換わるスキル。 */
defineSkill({
  id: 'overlord_strike', name: '覇王の一撃', icon: '覇', alwaysCrit: true,
  effects: [{ type: 'attack', mult: 4 }, { type: 'block', amount: 8 }],
});

/** 報酬として出現するスキル。 */
export const SKILL_POOL: readonly SkillId[] = [
  'small_attack', 'big_attack', 'jab', 'slash', 'heavy', 'smash',
  'guard', 'shield', 'bulwark', 'recover', 'shield_bash', 'drain', 'rally',
];

/** プレイヤーの初期スロット。21 は会心の一撃で固定。未設定の合計値は fallbackSkill（基本攻撃）が発動する。 */
export const DEFAULT_PLAYER_SLOTS: SlotTable = {
  11: 'small_attack',
  15: 'guard',
  18: 'shield',
  20: 'big_attack',
  21: CRITICAL_STRIKE_ID,
};
/** プレイヤーの初期の基本攻撃力。 */
export const START_ATTACK = 5;
export const DEFAULT_PLAYER_FALLBACK: SkillId = BASIC_ATTACK_ID;

// ---- 敵 ----
atk('slime_touch', 'ぬめる体当たり', 1, 0, '撃');
atk('slime_acid', '酸の飛沫', 1, 2);
atk('slime_melt', '溶解', 2, 2, '剛');
atk('slime_engulf', '飲み込み', 4, 0, '絶');

atk('skel_stab', '錆びた突き', 1, 0, '撃');
defineSkill({ id: 'skel_guard', name: '盾を構える', icon: '守', effects: [{ type: 'block', amount: 6 }] });
atk('skel_slash', '斬り下ろし', 2, 0, '剛');
atk('skel_cleave', '兜割り', 3, 0, '絶');

atk('bat_nip', '噛みつき', 1, 0, '撃');
atk('bat_bite', '鋭い牙', 2, 0);
defineSkill({
  id: 'bat_drain', name: '吸血', icon: '吸',
  effects: [{ type: 'attack', mult: 2, add: 1 }, { type: 'heal', amount: 3 }],
});
atk('bat_dive', '急降下', 4, 0, '剛');
atk('bat_screech', '血の饗宴', 5, 1, '絶');

atk('ghoul_scratch', '引っ掻き', 1, 0, '撃');
atk('ghoul_claw', '腐爪', 1, 3);
atk('ghoul_rend', '引き裂き', 2, 0, '剛');
atk('ghoul_devour', '貪り喰う', 3, 0, '絶');

atk('dragon_swipe', '尾の一撃', 1, 0, '撃');
atk('dragon_claw', '竜爪', 1, 4);
atk('dragon_breath', '火炎の息', 2, 3, '剛');
atk('dragon_inferno', '業火', 3, 2, '絶');
atk('dragon_apocalypse', '終焉の炎', 4, 2, '滅');

export const ENEMY_SLOTS = {
  slime: slotsFromRanges([[14, 16, 'slime_acid'], [17, 19, 'slime_melt'], [20, 21, 'slime_engulf']]),
  skeleton: slotsFromRanges([[15, 16, 'skel_guard'], [17, 19, 'skel_slash'], [20, 21, 'skel_cleave']]),
  bat: slotsFromRanges([[13, 17, 'bat_bite'], [18, 19, 'bat_drain'], [20, 20, 'bat_dive'], [21, 21, 'bat_screech']]),
  ghoul: slotsFromRanges([[12, 16, 'ghoul_claw'], [17, 19, 'ghoul_rend'], [20, 21, 'ghoul_devour']]),
  dragon: slotsFromRanges([
    [13, 17, 'dragon_claw'], [18, 19, 'dragon_breath'], [20, 20, 'dragon_inferno'], [21, 21, 'dragon_apocalypse'],
  ]),
} satisfies Record<string, SlotTable>;
