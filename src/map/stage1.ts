import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ1「忘れられた地下墓所」。
 *   左ルート: 宝箱と祠で運試し（敵は少なめ）
 *   中ルート: 宿屋を通る安全な道
 *   右ルート: 敵が多く、スキルを稼げる
 * 3つの道は大広間（屍食鬼）で合流し、その先で再び分岐して、ボスの墓守の騎士へ向かう。
 */
export const STAGE_1: StageMap = {
  id: 'stage1',
  name: '忘れられた地下墓所',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'M1', 'R1'], 'slime'),

    t('L1', 'chest', 0, 2, ['L2']),
    t('M1', 'shop', 1, 2, ['M2']),
    t('R1', 'enemy', 2, 2, ['R2'], 'skeleton'),

    t('L2', 'shrine', 0, 3, ['L3', 'M3']),
    t('M2', 'enemy', 1, 3, ['M3'], 'bat'),
    t('R2', 'empty', 2, 3, ['R3', 'M3']),

    t('L3', 'enemy', 0, 4, ['J'], 'skeleton'),
    t('M3', 'inn', 1, 4, ['J']),
    t('R3', 'chest', 2, 4, ['J']),

    t('J', 'enemy', 1, 5, ['P1', 'P2'], 'ghoul'),

    t('P1', 'shrine', 0, 6, ['Q']),
    t('P2', 'enemy', 2, 6, ['Q'], 'bat'),

    t('Q', 'inn', 1, 7, ['B']),
    t('B', 'boss', 1, 8, [], 'knight'),
  ].map((tile) => [tile.id, tile])),
};
