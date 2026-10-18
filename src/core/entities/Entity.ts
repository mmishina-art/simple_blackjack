import { Hand } from '../cards/Hand';
import { BASIC_ATTACK_ID, slotAttack, START_ATTACK } from '../skills/catalog';
import type { CharacterId, ElementType, SkillId, SlotTable } from '../skills/Skill';

export type EntityId = 'player' | 'enemy';

export class Entity {
  hp: number;
  /** ブロック値。ダメージは HP より先にブロックを減らす。戦闘中は持ち越され、戦闘が終わると消える。 */
  block = 0;
  readonly hand = new Hand();
  /** キャラクターの種別（プレイヤー用。既定は戦士）。 */
  character: CharacterId = 'warrior';
  /** 装備している防具の「被ダメージ上限」（防御したラウンドに効く）。プレイヤーのみ。 */
  armorCap?: number;
  /** 装備している防具の反射割合（魔導士のローブなど。防御したラウンドに効く）。 */
  armorReflect = 0;
  /** このラウンドの被ダメージの上限（防御したときだけ。HP の減少がこの値を超えない）。null なら上限なし。 */
  damageCap: number | null = null;
  /** このラウンドに、上限の対象として受けたダメージ（HP の減少）の合計。 */
  capTaken = 0;
  /** バーストしても、受けるダメージが増えない（レリック「破滅の加護」）。 */
  bustPenaltyFree = false;
  /** 弱点属性（敵のみ。この属性の攻撃を受けるとダメージが weaknessMultiplier 倍になる）。 */
  weakness?: ElementType;
  /** 敵が攻撃するときに帯びている属性。 */
  attackElement?: ElementType;
  /** このラウンドに帯びている属性（同じ属性の攻撃を受けると、ダメージを 0 にして HP を回復する）。 */
  activeElement: ElementType | null = null;
  /** このラウンド、すべての属性攻撃を吸収して回復するか（上位の吸収魔法）。 */
  absorbAllElements = false;
  /** 常時すべての属性攻撃を吸収するか（レリック「賢者の秘石」）。 */
  alwaysAbsorbElements = false;
  /** このラウンドの攻撃反射率（0 なら反射しない。防御や反射魔法で設定される）。 */
  reflectRatio = 0;
  /** 弱点を突いたときのダメージ倍率（標準は 2 倍。レリック「元素の指輪」で 2.5 倍）。 */
  weaknessMultiplier = 2;
  /** 反射ダメージの倍率（標準は 1 倍。レリック「鏡面のブローチ」で 1.5 倍）。 */
  reflectMultiplier = 1;

  constructor(
    readonly id: EntityId,
    readonly name: string,
    public maxHp: number,
    /** 合計値スロットにセットされたスキル。 */
    public slots: SlotTable = {},
    /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
    public fallbackSkill: SkillId = BASIC_ATTACK_ID,
    /** 基本パワー（POW）。攻撃スキルのダメージはこれを基準に ×・＋で決まる。 */
    public attack = START_ATTACK,
  ) {
    this.hp = maxHp;
  }

  /**
   * true なら、基本パワーが発動するスロットで変わる（プレイヤー）: 11以下=1、スロットが上がるごとに +1。attack の強化分は、その上に足す。
   * false なら attack で固定（敵）。
   */
  scaleAttackBySlot = false;

  /** 合計値 total のスロットで発動するスキルの基本パワー。 */
  attackAt(total: number): number {
    return this.scaleAttackBySlot ? slotAttack(this.attack, total) : this.attack;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
