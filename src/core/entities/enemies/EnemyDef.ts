import type { Relic } from '../../../relics/Relic';
import type { ElementType, SkillId, SlotTable } from '../../skills/Skill';
import type { EnemyAI } from './ai/EnemyAI';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** 基本パワー（POW）。 */
  attack: number;
  /** 特性による攻撃ダメージの上乗せ（LV の計算用。黒竜の息吹の +3 など）。 */
  attackBonus?: number;
  /** 倒したときの獲得ゴールド倍率（貪欲なミミックの 3 倍など）。 */
  goldMultiplier?: number;
  /** 中ボス（通常の敵マスに置く、前の階層のボスの強化版）。マップでは専用の枠で示す。 */
  midBoss?: boolean;
  /** 弱点属性（魔導士の同じ属性の魔法で 2 倍ダメージ）。 */
  weakness?: ElementType;
  /** 敵の攻撃が持つ属性（魔導士が同じ属性を帯びていると吸収して回復できる）。 */
  attackElement?: ElementType;
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
