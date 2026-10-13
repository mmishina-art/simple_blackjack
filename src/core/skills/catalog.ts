import { assignRarity, defineSkill, getSkill, slotsFromRanges, type SkillDef, type SkillId, type SlotTable } from './Skill';

/**
 * 基本攻撃力（ATK）基準のスキル。攻撃: floor(ATK × mult) + add / Block・回復: floor(ATK × mult) + amount。
 * プレイヤーの ATK は発動するスロットで変わる（11以下=1、+1ずつ）ので、合計値が高いほど強い。
 * 上位のスキルほど、固定の上乗せが大きい（コモン +0〜3 / レア +5 / レジェンド +10 が目安）。
 */
const atk = (id: string, name: string, mult: number, add = 0, icon = '攻'): SkillDef =>
  defineSkill({ id, name, icon, effects: [{ type: 'attack', mult, add }] });

// ---- プレイヤーのスキル ----
export const BASIC_ATTACK_ID: SkillId = atk('basic_attack', '通常攻撃', 1, 0, '攻').id;
atk('small_attack', '小攻撃', 0.5, 0, '小');
atk('jab', '突き', 1, 1, '突');          // コモン: ATK+1
atk('slash', '斬撃', 1, 3, '斬');        // コモン: ATK+3
atk('big_attack', '大攻撃', 1, 5, '大'); // レア: ATK+5
atk('heavy', '重撃', 1.5, 3, '重');      // レア: ATK×1.5+3
atk('smash', '渾身の一撃', 2, 5, '渾');  // レジェンド: ATK×2+5
defineSkill({ id: 'guard', name: 'シールド', icon: '守', effects: [{ type: 'block', mult: 1, amount: 1 }] });   // コモン: ATK+1
defineSkill({ id: 'shield', name: '盾', icon: '盾', effects: [{ type: 'block', mult: 1, amount: 3 }] });       // コモン: ATK+3
defineSkill({ id: 'bulwark', name: '鉄壁の構え', icon: '壁', effects: [{ type: 'block', mult: 1, amount: 5 }] }); // レア: ATK+5
defineSkill({
  id: 'shield_bash', name: '盾打ち', icon: '殴',
  effects: [{ type: 'attack', mult: 1 }, { type: 'block', mult: 1, amount: 0 }],
});
defineSkill({
  id: 'drain', name: '吸精', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 1 }, { type: 'heal', mult: 0.5, amount: 2 }],
});
defineSkill({
  id: 'rally', name: '鼓舞', icon: '鼓',
  effects: [{ type: 'block', mult: 1, amount: 0 }, { type: 'heal', mult: 0.5, amount: 2 }],
});

// ---- 第2・第3階層から手に入るスキル（コモン → レア → レジェンド の強化の道ができる） ----
atk('lunge', '突進', 1, 2, '進');           // コモン: ATK+2 → 破甲の突き → 串刺し
atk('chop', '叩き割り', 1.5, 0, '叩');       // コモン: ATK×1.5 → 狂戦士の一撃 → 暴虐
defineSkill({ id: 'mend', name: '癒しの術', icon: '癒', effects: [{ type: 'heal', mult: 1, amount: 3 }] });       // コモン: 回復 ATK+3 → 聖光 → 奇跡
defineSkill({ id: 'pierce_stab', name: '破甲の突き', icon: '破', effects: [{ type: 'attack', mult: 1, add: 3, pierce: true }] }); // レア: ATK+3・Block無視
atk('berserk', '狂戦士の一撃', 1.5, 2, '狂'); // レア: ATK×1.5+2
defineSkill({ id: 'holy_light', name: '聖光', icon: '聖', effects: [{ type: 'heal', mult: 1, amount: 5 }] });     // レア: 回復 ATK+5
defineSkill({
  id: 'twin_strike', name: '二連斬', icon: '連',
  effects: [{ type: 'attack', mult: 0.8, add: 1 }, { type: 'attack', mult: 0.8, add: 1 }], // レア: 2回攻撃（それぞれ Block に吸われる）
});
defineSkill({ id: 'impale', name: '串刺し', icon: '串', effects: [{ type: 'attack', mult: 1.5, add: 4, pierce: true }] }); // レジェンド: ATK×1.5+4・Block無視
atk('rampage', '暴虐', 2, 3, '暴');          // レジェンド: ATK×2+3
defineSkill({ id: 'miracle', name: '奇跡', icon: '奇', effects: [{ type: 'heal', mult: 1, amount: 10 }] });      // レジェンド: 回復 ATK+10
defineSkill({
  id: 'flurry', name: '乱舞', icon: '乱',
  effects: [{ type: 'attack', mult: 0.7, add: 2 }, { type: 'attack', mult: 0.7, add: 2 }, { type: 'attack', mult: 0.7, add: 2 }], // レジェンド: 3回攻撃
});

/** スロット21に固定されるスキル（封印の鍵のレリックで付け替え可能）。ATK×1.5。相手の Block を無視して破壊する。 */
export const ACE_STRIKE_ID: SkillId = defineSkill({
  id: 'ace_strike', name: '会心の一撃', icon: '会',
  effects: [{ type: 'attack', mult: 1.5, pierce: true }], // Block を無視して破壊する（ほかの攻撃との違い）
}).id;
/** 覇王の宝珠で会心の一撃が置き換わるスキル。会心の一撃の 1.5 倍が 2 倍になり、Block も付く。 */
defineSkill({
  id: 'overlord_strike', name: '覇王の一撃', icon: '覇',
  effects: [{ type: 'attack', mult: 2, pierce: true }, { type: 'block', amount: 8 }],
});

// ---- 道具: 効果は基本攻撃力（ATK）に関係なく固定（低いスロットでも、同じだけ効く）。レリックで強化できるものもある ----
const item = (id: string, name: string, icon: string, effect: SkillDef['effects'][number]): SkillDef =>
  defineSkill({ id, name, icon, kind: 'item', effects: [effect] });
item('herb', '薬草', '草', { type: 'heal', amount: 8 });                    // コモン: 回復 8（固定）
item('tonic', '回復薬', '薬', { type: 'heal', amount: 14 });                // レア: 回復 14
item('bomb', '爆弾', '爆', { type: 'attack', mult: 0, add: 10 });           // コモン: 10 ダメージ（固定）
item('elixir', '霊薬', '霊', { type: 'heal', amount: 22 });                  // レジェンド: 回復 22
item('big_bomb', '大爆弾', '轟', { type: 'attack', mult: 0, add: 16 });      // レア: 16 ダメージ（固定）
item('ward', '守りの巻物', '巻', { type: 'block', amount: 7 });               // コモン: Block 7
item('holy_ward', '聖なる護符', '符', { type: 'block', amount: 12 });         // レア: Block 12

// ---- 防具: 防御スロットに置く。防御したラウンドに受けるダメージ（HP の減少）の上限。数字が小さいほど硬い ----
const armor = (id: string, name: string, icon: string, damageCap: number, defendHeal?: number): SkillDef =>
  defineSkill({ id, name, icon, kind: 'armor', effects: [], damageCap, ...(defendHeal ? { defendHeal } : {}) });
armor('iron_shield', '鉄の盾', '鉄', 5);   // コモン: 上限 5（戦士の初期装備）
armor('steel_shield', '鋼の盾', '鋼', 4);  // レア: 上限 4
armor('saint_robe', '聖衣', '衣', 4, 3);   // レア: 上限 4 + 防御すると HP +3
armor('guard_mail', '守りの鎧', '鎧', 3);  // レジェンド: 上限 3
armor('mithril_mail', 'ミスリルの鎧', '銀', 2, 3); // レジェンド: 上限 2 + 防御すると HP +3

assignRarity(['big_attack', 'heavy', 'bulwark', 'shield_bash', 'drain', 'ace_strike', 'tonic', 'steel_shield', 'pierce_stab', 'berserk', 'holy_light', 'twin_strike', 'big_bomb', 'holy_ward', 'saint_robe'], 'rare');
// レジェンドの Block・複合スキル（祠のバージョンアップの行き先。報酬にも出る）
defineSkill({ id: 'fortress', name: '城塞', icon: '城', effects: [{ type: 'block', mult: 1, amount: 10 }] }); // レジェンド: ATK+10
defineSkill({
  id: 'aegis', name: '守護の一撃', icon: '護',
  effects: [{ type: 'attack', mult: 1.5, add: 3 }, { type: 'block', mult: 1, amount: 5 }],
});
defineSkill({
  id: 'siphon', name: '吸魂', icon: '魂',
  effects: [{ type: 'attack', mult: 1.5, add: 3 }, { type: 'heal', mult: 0.5, amount: 5 }],
});
assignRarity(['smash', 'overlord_strike', 'fortress', 'aegis', 'siphon', 'guard_mail', 'mithril_mail', 'impale', 'rampage', 'miracle', 'flurry', 'elixir'], 'legend');

/** 祠のバージョンアップ先。コモン→レア、レア→レジェンド。道具・固定スキルは強化できない。 */
const UPGRADES: Record<SkillId, SkillId> = {
  jab: 'big_attack', slash: 'heavy', big_attack: 'smash', heavy: 'smash',
  guard: 'bulwark', shield: 'bulwark', bulwark: 'fortress',
  rally: 'shield_bash', shield_bash: 'aegis', drain: 'siphon',
  lunge: 'pierce_stab', pierce_stab: 'impale', chop: 'berserk', berserk: 'rampage',
  mend: 'holy_light', holy_light: 'miracle', twin_strike: 'flurry',
};
for (const [from, to] of Object.entries(UPGRADES)) getSkill(from).upgradesTo = to;

/** 報酬として出現するスキル（小攻撃は 11以下に固定なので含めない）。基本攻撃力が基準で、スロットが高いほど強い。 */
export const SKILL_POOL: readonly SkillId[] = [
  'big_attack', 'jab', 'slash', 'heavy', 'smash',
  'guard', 'shield', 'bulwark', 'shield_bash', 'drain', 'rally',
  'fortress', 'aegis', 'siphon',
  'lunge', 'chop', 'mend', 'pierce_stab', 'berserk', 'holy_light', 'twin_strike', 'impale', 'rampage', 'miracle', 'flurry',
];

/** 報酬として出現する道具。効果は固定（基本攻撃力に関係ない）。 */
export const ITEM_POOL: readonly SkillId[] = ['herb', 'tonic', 'elixir', 'bomb', 'big_bomb', 'ward', 'holy_ward'];

/** 報酬として出現する防具（防御スロットに置く）。 */
export const ARMOR_POOL: readonly SkillId[] = ['iron_shield', 'steel_shield', 'saint_robe', 'guard_mail', 'mithril_mail'];
/** 戦士の初期装備の防具。 */
export const DEFAULT_ARMOR_ID: SkillId = 'iron_shield';

/** スロットに置けるものすべて（スキル + 道具。防具は防御スロット専用）。図鑑・出撃準備・祠の抽選に使う。 */
export const ALL_POOL: readonly SkillId[] = [...SKILL_POOL, ...ITEM_POOL];

/** プレイヤーの初期スロット。12 は薬草（道具）、20 は大攻撃、21 は会心の一撃で固定（守りは防具が受け持つので、シールド・盾は初期装備にしない）。未設定の合計値は fallbackSkill（基本攻撃）が発動する。 */
export const DEFAULT_PLAYER_SLOTS: SlotTable = {
  11: 'small_attack',
  12: 'herb', // 初期から回復を持つ（低い合計値で止まったときの、HP を保つ手段。薬草は固定の回復）
  20: 'big_attack',
  21: ACE_STRIKE_ID,
};
/** プレイヤーの初期の基本攻撃力。 */
export const START_ATTACK = 5;

/**
 * プレイヤーの基本攻撃力は、攻撃スキルが発動するスロットで変わる: 11以下=1、スロットが1上がるごとに +1（21=11）。
 * attack は「START_ATTACK + 強化（祭壇・砥石・祠）」で、強化はどのスロットにも同じだけ足される
 * （標準の attack=5 のとき、スロット15の攻撃力が 5 で、従来の固定値と同じ）。
 */
export function slotAttack(attack: number, key: number): number {
  return attack - START_ATTACK + (Math.max(11, Math.min(key, 21)) - 10);
}
export const DEFAULT_PLAYER_FALLBACK: SkillId = BASIC_ATTACK_ID;

// ---- 敵 ----
atk('slime_touch', 'ぬめる体当たり', 1, 0, '攻');
atk('slime_acid', '酸の飛沫', 1, 0, '酸');
atk('slime_melt', '溶解', 1, 0, '剛');
atk('slime_engulf', '飲み込み', 2, 0, '絶');

atk('skel_stab', '錆びた突き', 1, 0, '攻');
defineSkill({ id: 'skel_guard', name: '盾を構える', icon: '守', effects: [{ type: 'block', amount: 6 }] });
atk('skel_slash', '斬り下ろし', 1, 0, '剛');
atk('skel_cleave', '兜割り', 1, 3, '絶');

atk('bat_nip', '噛みつき', 1, 0, '攻');
atk('bat_bite', '鋭い牙', 1, 0, '牙');
defineSkill({
  id: 'bat_drain', name: '吸血', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 1 }, { type: 'heal', amount: 3 }],
});
atk('bat_dive', '急降下', 1, 3, '剛');
atk('bat_screech', '血の饗宴', 2, 2, '絶');

atk('ghoul_scratch', '引っ掻き', 1, 0, '攻');
atk('ghoul_claw', '腐爪', 1, 0, '爪');
atk('ghoul_rend', '引き裂き', 1, 0, '剛');
atk('ghoul_devour', '貪り喰う', 1, 3, '絶');

atk('dragon_swipe', '尾の一撃', 1, 0, '攻');
atk('dragon_claw', '竜爪', 1, 2, '爪');
atk('dragon_breath', '火炎の息', 1, 6, '剛');
atk('dragon_inferno', '業火', 2, 3, '絶');
atk('dragon_apocalypse', '終焉の炎', 2, 6, '滅');


// ---- 第1階層のボス・第2階層・第3階層の敵 ----
atk('knight_slash', '錆びた大剣', 1, 1, '剣');
atk('knight_bash', '盾打ち', 1, 1, '殴');
defineSkill({ id: 'knight_guard', name: '塔盾を構える', icon: '守', effects: [{ type: 'block', amount: 8 }] });
atk('knight_cleave', '断罪の一閃', 2, 0, '断');

atk('merman_jab', '銛の突き', 1, 1, '銛');
atk('merman_rush', '水流の突進', 1, 2, '流');
defineSkill({ id: 'merman_dive', name: '水に潜る', icon: '潜', effects: [{ type: 'block', amount: 7 }] });
atk('merman_tide', '大渦', 2, 0, '渦');

atk('garg_claw', '石の爪', 1, 1, '爪');
atk('garg_swoop', '急襲', 1, 3, '襲');
defineSkill({ id: 'garg_harden', name: '石化の構え', icon: '石', effects: [{ type: 'block', amount: 9 }] });
atk('garg_crush', '岩砕き', 2, 1, '砕');

atk('wraith_touch', '冷たい手', 1, 0, '冷');
defineSkill({
  id: 'wraith_drain', name: '生気吸収', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 2 }, { type: 'heal', amount: 3 }],
});
atk('wraith_curse', '呪いの囁き', 2, 0, '呪');
defineSkill({
  id: 'wraith_wail', name: '断末魔', icon: '叫',
  effects: [{ type: 'attack', mult: 2, add: 2 }, { type: 'heal', amount: 3 }],
});

atk('serpent_bite', '毒牙', 1, 1, '牙');
atk('serpent_coil', '締めつけ', 1, 3, '締');
defineSkill({ id: 'serpent_scale', name: '鱗の守り', icon: '鱗', effects: [{ type: 'block', amount: 8 }] });
atk('serpent_tide', '津波', 2, 2, '波');
atk('serpent_abyss', '深淵の咆哮', 2, 5, '淵');

atk('flame_spark', '火の粉', 1, 2, '火');
atk('flame_burst', '爆炎', 1, 2, '爆');
atk('flame_inferno', '火炎旋風', 2, 0, '旋');
atk('flame_nova', '紅蓮', 2, 2, '紅');

atk('golem_punch', '岩の拳', 1, 3, '拳');
defineSkill({ id: 'golem_armor', name: '溶岩の殻', icon: '殻', effects: [{ type: 'block', amount: 8 }] });
atk('golem_slam', '地割れ', 1, 4, '割');
atk('golem_eruption', '噴火', 2, 4, '噴');

atk('imp_stab', '三叉の突き', 1, 3, '叉');
atk('imp_hex', '悪魔の取引', 1, 5, '契');
defineSkill({
  id: 'imp_siphon', name: '魂の搾取', icon: '搾',
  effects: [{ type: 'attack', mult: 1, add: 5 }, { type: 'heal', amount: 4 }],
});
atk('imp_hellfire', '地獄の業火', 2, 3, '獄');

// 敵のスキルのレア度: 強い技ほど高い（スロット表の色で技の格が分かる）
assignRarity(['slime_melt', 'skel_slash', 'bat_drain', 'bat_dive', 'ghoul_rend', 'dragon_breath', 'knight_bash', 'merman_rush', 'garg_swoop', 'wraith_drain', 'serpent_coil', 'flame_burst', 'golem_slam', 'imp_hex'], 'rare');
assignRarity(['slime_engulf', 'skel_cleave', 'bat_screech', 'ghoul_devour', 'dragon_inferno', 'dragon_apocalypse', 'knight_cleave', 'merman_tide', 'garg_crush', 'wraith_curse', 'wraith_wail', 'serpent_tide', 'serpent_abyss', 'flame_inferno', 'flame_nova', 'golem_eruption', 'imp_siphon', 'imp_hellfire'], 'legend');

export const ENEMY_SLOTS = {
  slime: slotsFromRanges([[14, 16, 'slime_acid'], [17, 19, 'slime_melt'], [20, 21, 'slime_engulf']]),
  skeleton: slotsFromRanges([[15, 16, 'skel_guard'], [17, 19, 'skel_slash'], [20, 21, 'skel_cleave']]),
  bat: slotsFromRanges([[13, 17, 'bat_bite'], [18, 19, 'bat_drain'], [20, 20, 'bat_dive'], [21, 21, 'bat_screech']]),
  ghoul: slotsFromRanges([[12, 16, 'ghoul_claw'], [17, 19, 'ghoul_rend'], [20, 21, 'ghoul_devour']]),
  knight: slotsFromRanges([[15, 16, 'knight_guard'], [17, 19, 'knight_bash'], [20, 21, 'knight_cleave']]),
  merman: slotsFromRanges([[13, 15, 'merman_dive'], [16, 18, 'merman_rush'], [19, 21, 'merman_tide']]),
  gargoyle: slotsFromRanges([[14, 16, 'garg_harden'], [17, 19, 'garg_swoop'], [20, 21, 'garg_crush']]),
  wraith: slotsFromRanges([[14, 17, 'wraith_drain'], [18, 19, 'wraith_curse'], [20, 21, 'wraith_wail']]),
  serpent: slotsFromRanges([[16, 17, 'serpent_scale'], [18, 19, 'serpent_coil'], [20, 20, 'serpent_tide'], [21, 21, 'serpent_abyss']]),
  flame: slotsFromRanges([[15, 17, 'flame_burst'], [18, 19, 'flame_inferno'], [20, 21, 'flame_nova']]),
  golem: slotsFromRanges([[15, 16, 'golem_armor'], [17, 19, 'golem_slam'], [20, 21, 'golem_eruption']]),
  imp: slotsFromRanges([[15, 17, 'imp_hex'], [18, 19, 'imp_siphon'], [20, 21, 'imp_hellfire']]),
  dragon: slotsFromRanges([
    [13, 17, 'dragon_claw'], [18, 19, 'dragon_breath'], [20, 20, 'dragon_inferno'], [21, 21, 'dragon_apocalypse'],
  ]),
} satisfies Record<string, SlotTable>;
