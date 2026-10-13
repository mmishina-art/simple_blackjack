import type { Relic } from '../../../relics/Relic';
import type { SkillId, SlotTable } from '../../skills/Skill';
import type { EnemyAI } from './ai/EnemyAI';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** 基本攻撃力（ATK）。 */
  attack: number;
  /** 特性による攻撃ダメージの上乗せ（LV の計算用。黒竜の息吹の +3 など）。 */
  attackBonus?: number;
  ai: EnemyAI;
  /** 合計値スロットにセットされたスキル。 */
  slots: SlotTable;
  /** スロット未設定の合計値で発動するスキル。 */
  fallbackSkill: SkillId;
  /** 特性の説明（バトル開始時にログへ表示）。 */
  trait?: string;
  /** 特性の実体。プレイヤーのレリックと同じフック機構で実装する。 */
  relics?: Relic[];
}
