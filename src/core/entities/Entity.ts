import { Hand } from '../cards/Hand';
import { BASIC_ATTACK_ID, slotAttack, START_ATTACK } from '../skills/catalog';
import type { SkillId, SlotTable } from '../skills/Skill';

export type EntityId = 'player' | 'enemy';

export class Entity {
  hp: number;
  /** シールド値。ダメージは HP より先に Block を減らす。戦闘中は持ち越され、戦闘が終わると消える。 */
  block = 0;
  readonly hand = new Hand();
  /** 装備している防具の「被ダメージ上限」（防御したラウンドに効く）。プレイヤーのみ。 */
  armorCap?: number;
  /** このラウンドの被ダメージの上限（防御したときだけ。HP の減少がこの値を超えない）。null なら上限なし。 */
  damageCap: number | null = null;
  /** このラウンドに、上限の対象として受けたダメージ（HP の減少）の合計。 */
  capTaken = 0;

  constructor(
    readonly id: EntityId,
    readonly name: string,
    public maxHp: number,
    /** 合計値スロットにセットされたスキル。 */
    public slots: SlotTable = {},
    /** スロット未設定の合計値で発動するスキル（キャラクターごとの初期能力）。 */
    public fallbackSkill: SkillId = BASIC_ATTACK_ID,
    /** 基本攻撃力（ATK）。攻撃スキルのダメージはこれを基準に ×・＋で決まる。 */
    public attack = START_ATTACK,
  ) {
    this.hp = maxHp;
  }

  /**
   * true なら、基本攻撃力が発動するスロットで変わる（プレイヤー）: 11以下=1、スロットが上がるごとに +1。attack の強化分は、その上に足す。
   * false なら attack で固定（敵）。
   */
  scaleAttackBySlot = false;

  /** 合計値 total のスロットで発動するスキルの基本攻撃力。 */
  attackAt(total: number): number {
    return this.scaleAttackBySlot ? slotAttack(this.attack, total) : this.attack;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
