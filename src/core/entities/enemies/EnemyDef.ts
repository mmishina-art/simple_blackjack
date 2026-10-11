import type { Relic } from '../../../relics/Relic';
import type { EnemyAI } from './ai/EnemyAI';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  ai: EnemyAI;
  /** 撃破時に得られる経験値。 */
  exp: number;
  /** 特性の説明（バトル開始時にログへ表示）。 */
  trait?: string;
  /** 特性の実体。プレイヤーのレリックと同じフック機構で実装する。 */
  relics?: Relic[];
}
