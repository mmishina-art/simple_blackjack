import type { Rarity } from '../rarity';
import { assignRarity, defineSkill, getSkill, rarityOfSkill, slotsFromRanges, type SkillDef, type SkillId, type SlotTable } from './Skill';

/**
 * 基本パワー（POW）基準のスキル。攻撃: floor(POW × mult) + add / ブロック・回復: floor(POW × mult) + amount。
 * プレイヤーの POW は発動するスロットで変わる（11以下=1、+1ずつ）ので、合計値が高いほど強い。
 * 上位のスキルほど、固定の上乗せが大きい（コモン +0〜3 / レア +5 / レジェンド +10 が目安）。
 */
const atk = (id: string, name: string, mult: number, add = 0, icon = '攻'): SkillDef =>
  defineSkill({ id, name, icon, effects: [{ type: 'attack', mult, add }] });

// ---- プレイヤーのスキル ----
export const BASIC_ATTACK_ID: SkillId = atk('basic_attack', '通常攻撃', 1, 0, '攻').id;
atk('small_attack', '小攻撃', 0.5, 0, '小');
atk('jab', '突き', 1, 1, '突');          // コモン: POW+1
atk('slash', '斬撃', 1, 3, '斬');        // コモン: POW+3
atk('big_attack', '大攻撃', 1, 5, '大'); // レア: POW+5
atk('heavy', '重撃', 1.5, 3, '重');      // レア: POW×1.5+3
atk('smash', '渾身の一撃', 2, 5, '渾');  // レジェンド: POW×2+5
defineSkill({ id: 'guard', name: '受け流し', icon: '守', effects: [{ type: 'block', mult: 1, amount: 1 }] });   // コモン: POW+1
defineSkill({ id: 'shield', name: '身構え', icon: '構', effects: [{ type: 'block', mult: 1, amount: 3 }] });       // コモン: POW+3
defineSkill({ id: 'bulwark', name: '鉄壁の構え', icon: '壁', effects: [{ type: 'block', mult: 1, amount: 5 }] }); // レア: POW+5
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
atk('lunge', '突進', 1, 2, '進');           // コモン: POW+2 → 破甲の突き → 串刺し
atk('chop', '叩き割り', 1.5, 0, '叩');       // コモン: POW×1.5 → 狂戦士の一撃 → 暴虐
defineSkill({ id: 'mend', name: '癒しの術', icon: '癒', effects: [{ type: 'heal', mult: 1, amount: 3 }] });       // コモン: 回復 POW+3 → 聖光 → 奇跡
defineSkill({ id: 'pierce_stab', name: '破甲の突き', icon: '破', effects: [{ type: 'attack', mult: 1, add: 3, pierce: true }] }); // レア: POW+3・ブロック無視
atk('berserk', '狂戦士の一撃', 1.5, 2, '狂'); // レア: POW×1.5+2
defineSkill({ id: 'holy_light', name: '聖光', icon: '聖', effects: [{ type: 'heal', mult: 1, amount: 5 }] });     // レア: 回復 POW+5
defineSkill({
  id: 'twin_strike', name: '二連斬', icon: '連',
  effects: [{ type: 'attack', mult: 0.8, add: 1 }, { type: 'attack', mult: 0.8, add: 1 }], // レア: 2回攻撃（それぞれブロックに吸われる）
});
defineSkill({ id: 'impale', name: '串刺し', icon: '串', effects: [{ type: 'attack', mult: 1.5, add: 4, pierce: true }] }); // レジェンド: POW×1.5+4・ブロック無視
atk('rampage', '暴虐', 2, 3, '暴');          // レジェンド: POW×2+3
defineSkill({ id: 'miracle', name: '奇跡', icon: '奇', effects: [{ type: 'heal', mult: 1, amount: 10 }] });      // レジェンド: 回復 POW+10
defineSkill({
  id: 'flurry', name: '乱舞', icon: '乱',
  effects: [{ type: 'attack', mult: 0.7, add: 2 }, { type: 'attack', mult: 0.7, add: 2 }, { type: 'attack', mult: 0.7, add: 2 }], // レジェンド: 3回攻撃
});

/** スロット21に固定されるスキル（封印の鍵のレリックで付け替え可能）。POW×1.5。相手のブロックを無視して破壊する。 */
export const ACE_STRIKE_ID: SkillId = defineSkill({
  id: 'ace_strike', name: '会心の一撃', icon: '会',
  effects: [{ type: 'attack', mult: 1.5, pierce: true }], // ブロックを無視して破壊する（ほかの攻撃との違い）
}).id;
/**
 * 祠のバージョンアップで、会心の一撃が育つ系統（報酬には出ない。固定スロット 21 のまま）。一撃必殺のイメージで、効果は攻撃だけ（ブロックを無視して破壊する）。
 * 会心の一撃（コモン POW×1.5）→ 覇王の一撃（レア ×2）→ 終焉の一撃（レジェンド ×3）。
 */
const overlord = (id: string, name: string, icon: string, mult: number): void => {
  defineSkill({ id, name, icon, effects: [{ type: 'attack', mult, pierce: true }] });
};
overlord('overlord_strike', '覇王の一撃', '覇', 2);
overlord('final_strike', '終焉の一撃', '終', 3);

// ---- 道具: 効果は基本パワー（POW）に関係なく固定（低いスロットでも、同じだけ効く）。レリックで強化できるものもある ----
const item = (id: string, name: string, icon: string, effect: SkillDef['effects'][number]): SkillDef =>
  defineSkill({ id, name, icon, kind: 'item', effects: [effect] });
item('herb', '薬草', '草', { type: 'heal', amount: 8 });                    // コモン: 回復 8（固定）
item('tonic', '回復薬', '薬', { type: 'heal', amount: 14 });                // レア: 回復 14
item('bomb', '爆弾', '爆', { type: 'attack', mult: 0, add: 10 });           // コモン: 10 ダメージ（固定）
item('elixir', '霊薬', '霊', { type: 'heal', amount: 22 });                  // レジェンド: 回復 22
item('big_bomb', '大爆弾', '轟', { type: 'attack', mult: 0, add: 16 });      // レア: 16 ダメージ（固定）
item('ward', '守りの巻物', '巻', { type: 'block', amount: 7 });               // コモン: ブロック 7
item('holy_ward', '聖なる護符', '符', { type: 'block', amount: 12 });         // レア: ブロック 12

// ---- 防具: 防御スロットに置く。防御したラウンドに受けるダメージ（HP の減少）の上限。数字が小さいほど硬い ----
const armor = (id: string, name: string, icon: string, damageCap: number): SkillDef =>
  defineSkill({ id, name, icon, kind: 'armor', effects: [], damageCap });
armor('iron_shield', '鉄の盾', '鉄', 5);   // コモン: 上限 5（戦士の初期装備）
armor('steel_shield', '鋼の盾', '鋼', 4);  // レア: 上限 4
armor('mithril_shield', 'ミスリルの盾', '銀', 3); // レジェンド: 上限 3（防具はショップでだけ買える）

assignRarity(['big_attack', 'heavy', 'bulwark', 'shield_bash', 'drain', 'overlord_strike', 'tonic', 'steel_shield', 'pierce_stab', 'berserk', 'holy_light', 'twin_strike', 'big_bomb', 'holy_ward'], 'rare');
// レジェンドのブロック・複合スキル（祠のバージョンアップの行き先。報酬にも出る）
defineSkill({ id: 'fortress', name: '城塞', icon: '城', effects: [{ type: 'block', mult: 1, amount: 10 }] }); // レジェンド: POW+10
defineSkill({
  id: 'aegis', name: '守護の一撃', icon: '護',
  effects: [{ type: 'attack', mult: 1.5, add: 3 }, { type: 'block', mult: 1, amount: 5 }],
});
defineSkill({
  id: 'siphon', name: '吸魂', icon: '魂',
  effects: [{ type: 'attack', mult: 1.5, add: 3 }, { type: 'heal', mult: 0.5, amount: 5 }],
});
assignRarity(['smash', 'final_strike', 'fortress', 'aegis', 'siphon', 'mithril_shield', 'impale', 'rampage', 'miracle', 'flurry', 'elixir'], 'legend');

/**
 * 祠のバージョンアップ: **レア度は変えず、一段階だけ強くする**（スキル名に「＋」が付き、効果が上がる）。道具・防具は強化できない。
 * ただし 21 の会心の一撃は、レジェンドのまま、別に 2 段階育つ（会心の一撃 → 覇王の一撃 → 終焉の一撃。名前と効果が変わる）。
 */
const ACE_CHAIN: Record<SkillId, SkillId> = { ace_strike: 'overlord_strike', overlord_strike: 'final_strike' };
for (const [from, to] of Object.entries(ACE_CHAIN)) getSkill(from).upgradesTo = to;
assignRarity(['ace_strike', 'overlord_strike', 'final_strike'], 'legend'); // 会心の一撃の系統は、どの段階もレジェンド

/** 報酬には出ず、バージョンアップでだけ手に入るスキル（図鑑には載る）。 */
export const UPGRADE_ONLY_SKILLS: readonly SkillId[] = ['overlord_strike', 'final_strike'];

/** 報酬として出現するスキル（小攻撃は 11以下に固定なので含めない）。基本パワーが基準で、スロットが高いほど強い。 */
export const SKILL_POOL: readonly SkillId[] = [
  'big_attack', 'jab', 'slash', 'heavy', 'smash',
  'guard', 'shield', 'bulwark', 'shield_bash', 'drain', 'rally',
  'fortress', 'aegis', 'siphon',
  'lunge', 'chop', 'mend', 'pierce_stab', 'berserk', 'holy_light', 'twin_strike', 'impale', 'rampage', 'miracle', 'flurry',
];

/** 「＋」のスキルの ID と名前の目印。 */
export const PLUS_ID_SUFFIX = '_plus';
export const PLUS_NAME_SUFFIX = '＋';
/** 「＋」で増える固定の上乗せ（レア度ごと）。複数の効果があるスキルは、効果ごとに半分（切り上げ）ずつ。 */
export const PLUS_BONUS: Record<Rarity, number> = { common: 3, rare: 5, legend: 7 };

/** 強化したスキル（「＋」）か。 */
export const isPlusSkill = (id: SkillId): boolean => id.endsWith(PLUS_ID_SUFFIX);
/** 「＋」を外した、もとのスキルの ID（図鑑は、もとのスキルだけを数える）。 */
export const baseSkillId = (id: SkillId): SkillId => (isPlusSkill(id) ? id.slice(0, -PLUS_ID_SUFFIX.length) : id);

/** 報酬に出るスキルごとに、「＋」のスキルを作る。レア度は同じで、攻撃・ブロック・回復の上乗せが増える。 */
for (const id of SKILL_POOL) {
  const base = getSkill(id);
  const rarity = rarityOfSkill(base);
  const n = PLUS_BONUS[rarity];
  const per = base.effects.length === 1 ? n : Math.ceil(n / 2);
  const effects = base.effects.map((e): SkillDef['effects'][number] => (e.type === 'attack' ? { ...e, add: (e.add ?? 0) + per } : { ...e, amount: e.amount + per }));
  defineSkill({ ...base, id: `${id}${PLUS_ID_SUFFIX}`, name: `${base.name}${PLUS_NAME_SUFFIX}`, effects, upgradesTo: undefined });
  base.upgradesTo = `${id}${PLUS_ID_SUFFIX}`;
}

/** 報酬として出現する道具。効果は固定（基本パワーに関係ない）。 */
export const ITEM_POOL: readonly SkillId[] = ['herb', 'tonic', 'elixir', 'bomb', 'big_bomb', 'ward', 'holy_ward'];

/** 防具（防御スロットに置く）。敵の報酬には出ず、ショップでだけ買える。 */
export const ARMOR_POOL: readonly SkillId[] = ['iron_shield', 'steel_shield', 'mithril_shield'];
/** 戦士の初期装備の防具。 */
export const DEFAULT_ARMOR_ID: SkillId = 'iron_shield';

/** スロットに置けるものすべて（スキル + 道具。防具は防御スロット専用）。図鑑・出撃準備・祠の抽選に使う。 */
export const ALL_POOL: readonly SkillId[] = [...SKILL_POOL, ...ITEM_POOL];

/** プレイヤーの初期スロット。15 は薬草（道具）、20 は大攻撃、21 は会心の一撃で固定（守りは防具が受け持つので、シールド・盾は初期装備にしない）。未設定の合計値は fallbackSkill（基本攻撃）が発動する。 */
export const DEFAULT_PLAYER_SLOTS: SlotTable = {
  11: 'small_attack',
  15: 'herb', // 初期から回復を持つ。15 は「止まるか、引くか」を迷う合計値（バースト確率が約 54%）なので、止まる理由になる。試算でも最もクリア率が高い位置（14 と並ぶ）
  20: 'big_attack',
  21: ACE_STRIKE_ID,
};
/** プレイヤーの初期の基本パワー。 */
export const START_ATTACK = 5;

/**
 * プレイヤーの基本パワーは、攻撃スキルが発動するスロットで変わる: 11以下=1、スロットが1上がるごとに +1（21=11）。
 * attack は「START_ATTACK + 強化（祭壇・砥石・祠）」で、強化はどのスロットにも同じだけ足される
 * （標準の attack=5 のとき、スロット15の基本パワーが 5 で、従来の固定値と同じ）。
 */
export function slotAttack(attack: number, key: number): number {
  return attack - START_ATTACK + (Math.max(11, Math.min(key, 21)) - 10);
}
export const DEFAULT_PLAYER_FALLBACK: SkillId = BASIC_ATTACK_ID;

// ---- 敵 ----
atk('slime_touch', 'ぬめる体当たり', 0.5, 0, '攻');
atk('slime_acid', '酸の飛沫', 0.5, 0, '酸');
atk('slime_melt', '溶解', 1, 0, '剛');
atk('slime_engulf', '飲み込み', 2, 4, '絶');

atk('skel_stab', '錆びた突き', 0.5, 0, '攻');
defineSkill({ id: 'skel_guard', name: '盾を構える', icon: '守', effects: [{ type: 'block', amount: 6 }] });
atk('skel_slash', '斬り下ろし', 1, 0, '剛');
atk('skel_cleave', '兜割り', 2, 2, '絶');

atk('bat_nip', '噛みつき', 1, 0, '攻');
atk('bat_bite', '鋭い牙', 1, 0, '牙');
defineSkill({
  id: 'bat_drain', name: '吸血', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 0 }, { type: 'heal', amount: 3 }],
});
atk('bat_dive', '急降下', 2, 4, '剛');
atk('bat_screech', '血の饗宴', 1, 2, '絶');

atk('ghoul_scratch', '引っ掻き', 0.5, 0, '攻');
atk('ghoul_claw', '腐爪', 1, 0, '爪');
atk('ghoul_rend', '引き裂き', 1, 2, '剛');
atk('ghoul_devour', '貪り喰う', 2, 2, '絶');

atk('dragon_swipe', '尾の一撃', 1, 0, '攻');
atk('dragon_claw', '竜爪', 1, 2, '爪');
atk('dragon_breath', '火炎の息', 2, 4, '剛');
atk('dragon_inferno', '業火', 3, 2, '絶');
atk('dragon_apocalypse', '終焉の炎', 1, 4, '滅');


// ---- 第1階層のボス・第2階層・第3階層の敵 ----
atk('knight_slash', '錆びた大剣', 1, 0, '剣');
atk('knight_bash', '盾打ち', 1, 1, '殴');
defineSkill({ id: 'knight_guard', name: '塔盾を構える', icon: '守', effects: [{ type: 'block', amount: 8 }] });
atk('knight_cleave', '断罪の一閃', 3, 0, '断');

atk('merman_jab', '銛の突き', 1, 1, '銛');
atk('merman_rush', '水流の突進', 2, 4, '流');
defineSkill({ id: 'merman_dive', name: '水に潜る', icon: '潜', effects: [{ type: 'block', amount: 7 }] });
atk('merman_tide', '大渦', 1, 2, '渦');

atk('garg_claw', '石の爪', 1, 0, '爪');
atk('garg_swoop', '急襲', 1, 2, '襲');
defineSkill({ id: 'garg_harden', name: '石化の構え', icon: '石', effects: [{ type: 'block', amount: 9 }] });
atk('garg_crush', '岩砕き', 3, 2, '砕');

atk('wraith_touch', '冷たい手', 1, 0, '冷');
defineSkill({
  id: 'wraith_drain', name: '生気吸収', icon: '吸',
  effects: [{ type: 'attack', mult: 1, add: 0 }, { type: 'heal', amount: 3 }],
});
atk('wraith_curse', '呪いの囁き', 3, 3, '呪');
defineSkill({
  id: 'wraith_wail', name: '断末魔', icon: '叫',
  effects: [{ type: 'attack', mult: 1, add: 4 }, { type: 'heal', amount: 3 }],
});

atk('serpent_bite', '毒牙', 1, 0, '牙');
atk('serpent_coil', '締めつけ', 1, 3, '締');
defineSkill({ id: 'serpent_scale', name: '鱗の守り', icon: '鱗', effects: [{ type: 'block', amount: 8 }] });
atk('serpent_tide', '津波', 3, 2, '波');
atk('serpent_abyss', '深淵の咆哮', 1, 4, '淵');

atk('flame_spark', '火の粉', 1, 0, '火');
atk('flame_burst', '爆炎', 1, 2, '爆');
atk('flame_inferno', '火炎旋風', 1, 2, '旋');
atk('flame_nova', '紅蓮', 2, 4, '紅');

atk('golem_punch', '岩の拳', 1, 0, '拳');
defineSkill({ id: 'golem_armor', name: '溶岩の殻', icon: '殻', effects: [{ type: 'block', amount: 8 }] });
atk('golem_slam', '地割れ', 1, 3, '割');
atk('golem_eruption', '噴火', 3, 2, '噴');

atk('imp_stab', '三叉の突き', 1, 0, '叉');
atk('imp_hex', '悪魔の取引', 3, 3, '契');
defineSkill({
  id: 'imp_siphon', name: '魂の搾取', icon: '搾',
  effects: [{ type: 'attack', mult: 1, add: 0 }, { type: 'heal', amount: 4 }],
});
atk('imp_hellfire', '地獄の業火', 1, 4, '獄');

// 鋼鉄のゴーレム（ブロックを多用する敵）。壁で守りを固め、盾で殴り、ブロックを重ねる
atk('ig_punch', '鉄の拳', 1, 1, '拳');
defineSkill({ id: 'ig_wall', name: '鋼の壁', icon: '壁', effects: [{ type: 'block', amount: 8 }] });
defineSkill({ id: 'ig_bash', name: '盾叩き', icon: '叩', effects: [{ type: 'attack', mult: 1, add: 3 }, { type: 'block', amount: 6 }] });
defineSkill({ id: 'ig_crush', name: '鉄塊の一撃', icon: '塊', effects: [{ type: 'attack', mult: 3, add: 3 }, { type: 'block', amount: 5 }] });

// 21 の必殺技（敵の合計値がちょうど 21 で出る。攻撃 2 倍で、危険の一撃と同じくらいの重さ）
atk('slime_deluge', '酸の奔流', 1, 2, '奔');
atk('skel_execution', '処刑の一太刀', 1, 1, '処');
atk('knight_judgement', '審判の剣', 1, 2, '審');
atk('garg_fall', '落石の一撃', 1, 3, '落');
defineSkill({ id: 'ig_quake', name: '鉄槌', icon: '槌', effects: [{ type: 'attack', mult: 1, add: 4 }, { type: 'block', amount: 5 }] });
atk('golem_meteor', '溶岩流', 1, 4, '流');

// 中ボス用スキル（前階ボスの色違い・強化）
atk('drowned_slash', '水没した大剣', 1, 0, '剣');
atk('drowned_bash', '浸水の盾打ち', 1, 2, '殴');
defineSkill({ id: 'drowned_guard', name: '水没の塔盾', icon: '守', effects: [{ type: 'block', amount: 10 }] });
atk('drowned_cleave', '深海の断罪', 3, 1, '断');
atk('drowned_judgement', '底無き審判', 1, 3, '審');

atk('magma_bite', '溶岩の牙', 1, 0, '牙');
atk('magma_coil', '灼熱の締めつけ', 1, 4, '締');
defineSkill({ id: 'magma_scale', name: '溶岩の鱗', icon: '鱗', effects: [{ type: 'block', amount: 10 }] });
atk('magma_eruption', 'マグマの大津波', 3, 3, '波');
atk('magma_roar', '紅蓮の咆哮', 1, 5, '咆');

// 敵のスキルには、レア度を付けない（色分けしない）。危ない場所は「危険」（赤）、21 は「必殺」で示す。レア度の色は、プレイヤーが手に入れるスキルの価値だけを表す

/**
 * 敵の危険な合計値: 敵ごとに決まった合計値でだけ出る、一撃の重い技。それ以外の合計値の技は軽い。
 * 敵の札は最後の1枚以外が見えているので、「この手は危ない → 防御」と読める（敵ごとの場所を覚えるほど勝てる）。
 * 21 は危険にしない。21 は「必殺」（どの敵も攻撃 2 倍で、「BUST or DIE」の予告が出る。RuleSet.enemy21Multiplier）で、
 * 21 の技は、2 倍したときに、危険の一撃と同じくらい（以上）になるようにしてある。
 * スロット表では赤い印、一覧では「危険」の札で示す。
 */
export const FATAL_SKILLS: readonly SkillId[] = [
  'slime_engulf', 'skel_cleave', 'bat_dive', 'ghoul_devour', 'knight_cleave',
  'merman_rush', 'garg_crush', 'wraith_curse', 'ig_crush', 'serpent_tide',
  'flame_nova', 'golem_eruption', 'imp_hex', 'dragon_breath', 'dragon_inferno',
  'drowned_cleave', 'magma_eruption',
];
for (const id of FATAL_SKILLS) getSkill(id).fatal = true;

export const ENEMY_SLOTS = {
  slime: slotsFromRanges([[14, 17, 'slime_acid'], [18, 19, 'slime_melt'], [20, 20, 'slime_engulf'], [21, 21, 'slime_deluge']]),
  skeleton: slotsFromRanges([[15, 16, 'skel_guard'], [17, 18, 'skel_slash'], [19, 20, 'skel_cleave'], [21, 21, 'skel_execution']]),
  bat: slotsFromRanges([[13, 14, 'bat_dive'], [15, 17, 'bat_bite'], [18, 19, 'bat_drain'], [20, 21, 'bat_screech']]),
  ghoul: slotsFromRanges([[16, 17, 'ghoul_devour'], [18, 19, 'ghoul_claw'], [20, 21, 'ghoul_rend']]),
  knight: slotsFromRanges([[17, 18, 'knight_guard'], [19, 19, 'knight_bash'], [20, 20, 'knight_cleave'], [21, 21, 'knight_judgement']]),
  merman: slotsFromRanges([[15, 16, 'merman_rush'], [17, 18, 'merman_dive'], [19, 21, 'merman_tide']]),
  gargoyle: slotsFromRanges([[16, 18, 'garg_harden'], [19, 19, 'garg_swoop'], [20, 20, 'garg_crush'], [21, 21, 'garg_fall']]),
  wraith: slotsFromRanges([[16, 16, 'wraith_drain'], [17, 18, 'wraith_curse'], [19, 20, 'wraith_touch'], [21, 21, 'wraith_wail']]),
  drowned_knight: slotsFromRanges([[17, 18, 'drowned_guard'], [19, 19, 'drowned_bash'], [20, 20, 'drowned_cleave'], [21, 21, 'drowned_judgement']]),
  serpent: slotsFromRanges([[18, 18, 'serpent_scale'], [19, 19, 'serpent_coil'], [20, 20, 'serpent_tide'], [21, 21, 'serpent_abyss']]),
  flame: slotsFromRanges([[17, 18, 'flame_burst'], [19, 20, 'flame_nova'], [21, 21, 'flame_burst']]),
  golem: slotsFromRanges([[15, 16, 'golem_armor'], [17, 18, 'golem_slam'], [19, 20, 'golem_eruption'], [21, 21, 'golem_meteor']]),
  imp: slotsFromRanges([[17, 18, 'imp_hex'], [19, 20, 'imp_siphon'], [21, 21, 'imp_hellfire']]),
  iron_golem: slotsFromRanges([[15, 17, 'ig_wall'], [18, 19, 'ig_bash'], [20, 20, 'ig_crush'], [21, 21, 'ig_quake']]),
  magma_serpent: slotsFromRanges([[18, 18, 'magma_scale'], [19, 19, 'magma_coil'], [20, 20, 'magma_eruption'], [21, 21, 'magma_roar']]),
  dragon: slotsFromRanges([
    [18, 18, 'dragon_claw'], [19, 19, 'dragon_breath'], [20, 20, 'dragon_inferno'], [21, 21, 'dragon_apocalypse'],
  ]),
} satisfies Record<string, SlotTable>;
