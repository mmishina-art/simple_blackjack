import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ2「沈んだ大聖堂」。水に沈んだ聖堂。魚人・ガーゴイル・亡霊が出る。
 *   左ルート: 宝箱と祠、石像の守り
 *   中ルート: 宿屋を通るが、亡霊の冷気がある
 *   右ルート: 魚人と戦い続ける道（宝箱あり）
 * 3つの道は大聖堂の広間（亡霊）で合流し、そのあと祠か魚人を選び、宿屋を経て、ボスの海蛇へ。
 */
export const STAGE_2: StageMap = {
  id: 'stage2',
  name: '沈んだ大聖堂',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'M1', 'R1'], 'merman'),

    t('L1', 'chest', 0, 2, ['L2']),
    t('M1', 'enemy', 1, 2, ['M2'], 'gargoyle'),
    t('R1', 'enemy', 2, 2, ['R2'], 'merman'),

    t('L2', 'shrine', 0, 3, ['L3', 'M3']),
    t('M2', 'inn', 1, 3, ['M3']),
    t('R2', 'chest', 2, 3, ['R3', 'M3']),

    t('L3', 'enemy', 0, 4, ['J'], 'gargoyle'),
    t('M3', 'enemy', 1, 4, ['J'], 'wraith'),
    t('R3', 'enemy', 2, 4, ['J'], 'merman'),

    t('J', 'enemy', 1, 5, ['P1', 'P2'], 'wraith'),

    t('P1', 'shrine', 0, 6, ['Q']),
    t('P2', 'enemy', 2, 6, ['Q'], 'gargoyle'),

    t('Q', 'inn', 1, 7, ['B']),
    t('B', 'boss', 1, 8, [], 'serpent'),
  ].map((tile) => [tile.id, tile])),
};
