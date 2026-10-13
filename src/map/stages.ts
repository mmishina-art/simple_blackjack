import { STAGE_1 } from './stage1';
import { STAGE_2 } from './stage2';
import { STAGE_3 } from './stage3';
import type { StageMap } from './StageMap';

/** 冒険の階層（ステージ）の並び。最後の階層のボスを倒すとクリア。階層が進むほど、長い（段が多い）。 */
export const STAGES: readonly StageMap[] = [STAGE_1, STAGE_2, STAGE_3];

/** 地図の段数（スタート 0 〜 ボス）。 */
export function stageRows(map: StageMap): number {
  return Math.max(...Object.values(map.tiles).map((t) => t.row)) + 1;
}

/** 魂片の計算で深さを通算するための、その階層の手前までの段数の合計。stage は 1 始まり。 */
export function stageRowOffset(stage: number): number {
  return STAGES.slice(0, Math.max(0, stage - 1)).reduce((sum, m) => sum + stageRows(m), 0);
}
