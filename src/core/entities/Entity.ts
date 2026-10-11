import { Hand } from '../cards/Hand';
import { BASIC_ATTACK_ID, START_ATTACK } from '../skills/catalog';
import type { SkillId, SlotTable } from '../skills/Skill';

export type EntityId = 'player' | 'enemy';

export class Entity {
  hp: number;
  /** シールド値。ダメージは HP より先に Block を減らす。戦闘中は持ち越され、戦闘が終わると消える。 */
  block = 0;
  readonly hand = new Hand();

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

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
