import { defineSkill, slotsFromRanges, type SkillDef, type SkillId, type SlotTable } from './Skill';

const atk = (id: string, name: string, power: number, icon = '攻'): SkillDef =>
  defineSkill({ id, name, icon, effects: [{ type: 'attack', power }] });

// ---- プレイヤー（テスト用の仮スキル） ----
export const BASIC_ATTACK_ID: SkillId = atk('basic_attack', '基本攻撃', 3, '撃').id;
atk('small_attack', '小攻撃', 4);
atk('big_attack', '大攻撃', 14, '剛');
atk('huge_attack', '特大攻撃', 20, '絶');
defineSkill({ id: 'guard', name: 'シールド', icon: '守', effects: [{ type: 'block', amount: 6 }] });
defineSkill({ id: 'mend', name: '回復', icon: '癒', effects: [{ type: 'heal', amount: 6 }] });

/** プレイヤーの初期スロット（仮）。未設定の合計値は fallbackSkill（基本攻撃）が発動する。 */
export const DEFAULT_PLAYER_SLOTS: SlotTable = {
  11: 'small_attack',
  15: 'guard',
  18: 'mend',
  20: 'big_attack',
  21: 'huge_attack',
};
export const DEFAULT_PLAYER_FALLBACK: SkillId = BASIC_ATTACK_ID;

// ---- 敵 ----
atk('slime_touch', 'ぬめる体当たり', 3, '撃');
atk('slime_acid', '酸の飛沫', 5);
atk('slime_melt', '溶解', 8, '剛');
atk('slime_engulf', '飲み込み', 12, '絶');

atk('skel_stab', '錆びた突き', 4, '撃');
defineSkill({ id: 'skel_guard', name: '盾を構える', icon: '守', effects: [{ type: 'block', amount: 6 }] });
atk('skel_slash', '斬り下ろし', 8, '剛');
atk('skel_cleave', '兜割り', 12, '絶');

atk('bat_nip', '噛みつき', 3, '撃');
atk('bat_bite', '鋭い牙', 6);
defineSkill({
  id: 'bat_drain', name: '吸血', icon: '吸',
  effects: [{ type: 'attack', power: 7 }, { type: 'heal', amount: 3 }],
});
atk('bat_dive', '急降下', 12, '剛');
atk('bat_screech', '血の饗宴', 16, '絶');

atk('ghoul_scratch', '引っ掻き', 4, '撃');
atk('ghoul_claw', '腐爪', 7);
atk('ghoul_rend', '引き裂き', 10, '剛');
atk('ghoul_devour', '貪り喰う', 14, '絶');

atk('dragon_swipe', '尾の一撃', 5, '撃');
atk('dragon_claw', '竜爪', 9);
atk('dragon_breath', '火炎の息', 13, '剛');
atk('dragon_inferno', '業火', 17, '絶');
atk('dragon_apocalypse', '終焉の炎', 22, '滅');

export const ENEMY_SLOTS = {
  slime: slotsFromRanges([[14, 16, 'slime_acid'], [17, 19, 'slime_melt'], [20, 21, 'slime_engulf']]),
  skeleton: slotsFromRanges([[15, 16, 'skel_guard'], [17, 19, 'skel_slash'], [20, 21, 'skel_cleave']]),
  bat: slotsFromRanges([[13, 17, 'bat_bite'], [18, 19, 'bat_drain'], [20, 20, 'bat_dive'], [21, 21, 'bat_screech']]),
  ghoul: slotsFromRanges([[12, 16, 'ghoul_claw'], [17, 19, 'ghoul_rend'], [20, 21, 'ghoul_devour']]),
  dragon: slotsFromRanges([
    [13, 17, 'dragon_claw'], [18, 19, 'dragon_breath'], [20, 20, 'dragon_inferno'], [21, 21, 'dragon_apocalypse'],
  ]),
} satisfies Record<string, SlotTable>;
