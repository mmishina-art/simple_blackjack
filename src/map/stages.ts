import { STAGE_1 } from './stage1';
import { STAGE_2 } from './stage2';
import { STAGE_3 } from './stage3';
import type { StageMap } from './StageMap';

/** 冒険の階層（ステージ）の並び。最後の階層のボスを倒すとクリア。 */
export const STAGES: readonly StageMap[] = [STAGE_1, STAGE_2, STAGE_3];

/** 1つの階層の段数（スタート 0 〜 ボス 8）。魂片の計算で、深さを通算するために使う。 */
export const STAGE_ROWS = 9;
