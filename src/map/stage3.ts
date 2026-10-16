import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ3「竜の巣」（19段・祠 1 箇所）。
 *   序盤（1〜6段）:
 *     溶岩ゴーレム→悪魔の連戦から宝箱を得る左路、賭博師から宝箱/宿屋を選べる中央路、ミミック→ショップ→宿屋の右路。
 *     5段目では高HPの「腐肉の巨兵(L3)」と高ブロックの「鋼鉄のゴーレム(M3)」のどちらに自分のデッキが向くかを選択。
 *   中盤（7〜10段）:
 *     7段目の業火の悪魔(B1)を突破すると3ルートに分岐:
 *       左【中ボス挑戦】: 溶岩の大蛇(L5) → 宝箱(C3) → 宿屋(I2)
 *       中【賞金・商業】: ミミック(M5) → ショップ(P3) → 宿屋(I2) または 宝箱(C4)
 *       右【重装連戦】: 溶岩ゴーレム(R5) → 腐肉の巨兵(R6) → 宝箱(C4)
 *   終盤（11〜18段）:
 *     12段目で、炎の精霊→宝箱(C5)の財宝ルートと、階層唯一の祠(H1・終焉の一撃への最終強化)の聖域ルートが分かれる。
 *     14段目の宿屋(I3)で一息ついた後、黒竜前の最終3分岐（巨兵→宝箱 / ミミック→最終ショップ / 悪魔→賭博師）を経て決戦へ。
 */
export const STAGE_3: StageMap = {
  id: 'stage3',
  name: '竜の巣',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'R1'], 'flame'),

    t('L1', 'enemy', 0, 2, ['L2', 'M2'], 'golem'),
    t('R1', 'enemy', 2, 2, ['M2', 'R2'], 'mimic'),

    t('L2', 'enemy', 0, 3, ['C1'], 'imp'),
    t('M2', 'enemy', 1, 3, ['C1', 'I1'], 'gambler'),
    t('R2', 'shop', 2, 3, ['I1']),

    t('C1', 'chest', 0, 4, ['L3']),
    t('I1', 'inn', 2, 4, ['L3', 'M3']),

    t('L3', 'enemy', 0, 5, ['C2', 'M4'], 'colossus'),
    t('M3', 'enemy', 1, 5, ['M4', 'P2'], 'iron_golem'),

    t('C2', 'chest', 0, 6, ['B1']),
    t('M4', 'enemy', 1, 6, ['B1'], 'flame'),
    t('P2', 'shop', 2, 6, ['B1']),

    t('B1', 'enemy', 1, 7, ['L5', 'M5', 'R5'], 'imp'),

    t('L5', 'enemy', 0, 8, ['C3'], 'magma_serpent'),
    t('M5', 'enemy', 1, 8, ['P3'], 'mimic'),
    t('R5', 'enemy', 2, 8, ['R6'], 'golem'),

    t('C3', 'chest', 0, 9, ['I2']),
    t('P3', 'shop', 1, 9, ['I2', 'C4']),
    t('R6', 'enemy', 2, 9, ['C4'], 'colossus'),

    t('I2', 'inn', 0, 10, ['M7']),
    t('C4', 'chest', 2, 10, ['M7', 'R7']),

    t('M7', 'enemy', 1, 11, ['L8', 'H1'], 'gambler'),
    t('R7', 'enemy', 2, 11, ['H1'], 'iron_golem'),

    t('L8', 'enemy', 0, 12, ['C5'], 'flame'),
    t('H1', 'shrine', 2, 12, ['M9']),

    t('C5', 'chest', 0, 13, ['I3']),
    t('M9', 'enemy', 1, 13, ['I3'], 'golem'),

    t('I3', 'inn', 1, 14, ['L10', 'M10', 'R10']),

    t('L10', 'enemy', 0, 15, ['C6'], 'colossus'),
    t('M10', 'enemy', 1, 15, ['P4'], 'mimic'),
    t('R10', 'enemy', 2, 15, ['R11'], 'imp'),

    t('C6', 'chest', 0, 16, ['I4']),
    t('P4', 'shop', 1, 16, ['I4', 'E12']),
    t('R11', 'enemy', 2, 16, ['I4', 'E12'], 'gambler'),

    t('I4', 'inn', 0, 17, ['B']),
    t('E12', 'enemy', 2, 17, ['B'], 'iron_golem'),

    t('B', 'boss', 1, 18, [], 'dragon'),
  ].map((tile) => [tile.id, tile])),
};
