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
item('wood_shield', '木の盾', '木', { type: 'block', amount: 7 });          // コモン: Block 7
item('iron_shield', '鉄の盾', '鉄', { type: 'block', amount: 12 });         // レア: Block 12
item('bomb', '爆弾', '爆', { type: 'attack', mult: 0, add: 10 });           // コモン: 10 ダメージ（固定）

assignRarity(['big_attack', 'heavy', 'bulwark', 'shield_bash', 'drain', 'ace_strike', 'tonic', 'iron_shield'], 'rare');
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
assignRarity(['smash', 'overlord_strike', 'fortress', 'aegis', 'siphon'], 'legend');

/** 祠のバージョンアップ先。コモン→レア、レア→レジェンド。道具・固定スキルは強化できない。 */
const UPGRADES: Record<SkillId, SkillId> = {
  jab: 'big_attack', slash: 'heavy', big_attack: 'smash', heavy: 'smash',
  guard: 'bulwark', shield: 'bulwark', bulwark: 'fortress',
  rally: 'shield_bash', shield_bash: 'aegis', drain: 'siphon',
};
for (const [from, to] of Object.entries(UPGRADES)) getSkill(from).upgradesTo = to;

/** 報酬として出現するスキル（小攻撃は 11以下に固定なので含めない）。基本攻撃力が基準で、スロットが高いほど強い。 */
export const SKILL_POOL: readonly SkillId[] = [
  'big_attack', 'jab', 'slash', 'heavy', 'smash',
  'guard', 'shield', 'bulwark', 'shield_bash', 'drain', 'rally',
  'fortress', 'aegis', 'siphon',
];

/** 報酬として出現する道具。効果は固定（基本攻撃力に関係ない）。 */
export const ITEM_POOL: readonly SkillId[] = ['herb', 'tonic', 'wood_shield', 'iron_shield', 'bomb'];

/** 入手できるものすべて（スキル + 道具）。図鑑・出撃準備・祠の抽選に使う。 */
export const ALL_POOL: readonly SkillId[] = [...SKILL_POOL, ...ITEM_POOL];

/** プレイヤーの初期スロット。12 は薬草（道具）、21 は会心の一撃で固定。未設定の合計値は fallbackSkill（基本攻撃）が発動する。 */
export const DEFAULT_PLAYER_SLOTS: SlotTable = {
  11: 'small_attack',
  12: 'herb', // 初期から回復を持つ（低い合計値で止まったときの、HP を保つ手段。薬草は固定の回復）
  15: 'guard',
  18: 'shield',
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
atk('slime_acid', '酸の飛沫', 1, 2, '酸');
atk('slime_melt', '溶解', 2, 2, '剛');
atk('slime_engulf', '飲み込み', 4, 0, '絶');

atk('skel_stab', '錆びた突き', 1, 0, '攻');
defineSkill({ id: 'skel_guard', name: '盾を構える', icon: '守', effects: [{ type: 'block', amount: 6 }] });
atk('skel_slash', '斬り下ろし', 2, 0, '剛');
atk('skel_cleave', '兜割り', 3, 0, '絶');

atk('bat_nip', '噛みつき', 1, 0, '攻');
atk('bat_bite', '鋭い牙', 2, 0, '牙');
defineSkill({
  id: 'bat_drain', name: '吸血', icon: '吸',
  effects: [{ type: 'attack', mult: 2, add: 1 }, { type: 'heal', amount: 3 }],
});
atk('bat_dive', '急降下', 4, 0, '剛');
atk('bat_screech', '血の饗宴', 5, 1, '絶');

atk('ghoul_scratch', '引っ掻き', 1, 0, '攻');
atk('ghoul_claw', '腐爪', 1, 3, '爪');
atk('ghoul_rend', '引き裂き', 2, 0, '剛');
atk('ghoul_devour', '貪り喰う', 3, 0, '絶');

atk('dragon_swipe', '尾の一撃', 1, 0, '攻');
atk('dragon_claw', '竜爪', 1, 4, '爪');
atk('dragon_breath', '火炎の息', 2, 3, '剛');
atk('dragon_inferno', '業火', 3, 2, '絶');
atk('dragon_apocalypse', '終焉の炎', 4, 2, '滅');

// 敵のスキルのレア度: 強い技ほど高い（スロット表の色で技の格が分かる）
assignRarity(['slime_melt', 'skel_slash', 'bat_drain', 'bat_dive', 'ghoul_rend', 'dragon_breath'], 'rare');
assignRarity(['slime_engulf', 'skel_cleave', 'bat_screech', 'ghoul_devour', 'dragon_inferno', 'dragon_apocalypse'], 'legend');

export const ENEMY_SLOTS = {
  slime: slotsFromRanges([[14, 16, 'slime_acid'], [17, 19, 'slime_melt'], [20, 21, 'slime_engulf']]),
  skeleton: slotsFromRanges([[15, 16, 'skel_guard'], [17, 19, 'skel_slash'], [20, 21, 'skel_cleave']]),
  bat: slotsFromRanges([[13, 17, 'bat_bite'], [18, 19, 'bat_drain'], [20, 20, 'bat_dive'], [21, 21, 'bat_screech']]),
  ghoul: slotsFromRanges([[12, 16, 'ghoul_claw'], [17, 19, 'ghoul_rend'], [20, 21, 'ghoul_devour']]),
  dragon: slotsFromRanges([
    [13, 17, 'dragon_claw'], [18, 19, 'dragon_breath'], [20, 20, 'dragon_inferno'], [21, 21, 'dragon_apocalypse'],
  ]),
} satisfies Record<string, SlotTable>;
