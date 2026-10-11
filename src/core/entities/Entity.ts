import { Hand } from '../cards/Hand';
import { BASIC_ATTACK_ID } from '../skills/catalog';
import type { SkillId, SlotTable } from '../skills/Skill';

export type EntityId = 'player' | 'enemy';

export class Entity {
  hp: number;
  /** ラウンド終了時にリセットされるシールド値。ダメージは HP より先に Block を減らす。 */
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
  ) {
    this.hp = maxHp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }
}
