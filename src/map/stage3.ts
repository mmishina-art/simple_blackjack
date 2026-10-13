import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ3「竜の巣」。灼熱の火山。炎の精霊・溶岩ゴーレム・悪魔が出る。宿屋が少なく、宝箱と祠が頼り。
 *   左ルート: 祠と宝箱（敵は悪魔）
 *   中ルート: 宿屋があるが、溶岩ゴーレムが続く
 *   右ルート: 炎の精霊を倒しながら進む道（宝箱あり）
 * 3つの道は火口の広間（悪魔）で合流し、そのあと祠か精霊を選び、宿屋を経て、ボスの黒竜へ。
 */
export const STAGE_3: StageMap = {
  id: 'stage3',
  name: '竜の巣',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'M1', 'R1'], 'flame'),

    t('L1', 'enemy', 0, 2, ['L2'], 'imp'),
    t('M1', 'enemy', 1, 2, ['M2'], 'golem'),
    t('R1', 'enemy', 2, 2, ['R2'], 'flame'),

    t('L2', 'chest', 0, 3, ['L3', 'M3']),
    t('M2', 'inn', 1, 3, ['M3']),
    t('R2', 'chest', 2, 3, ['R3', 'M3']),

    t('L3', 'shrine', 0, 4, ['J']),
    t('M3', 'enemy', 1, 4, ['J'], 'golem'),
    t('R3', 'enemy', 2, 4, ['J'], 'imp'),

    t('J', 'enemy', 1, 5, ['P1', 'P2'], 'imp'),

    t('P1', 'shrine', 0, 6, ['Q']),
    t('P2', 'enemy', 2, 6, ['Q'], 'flame'),

    t('Q', 'inn', 1, 7, ['B']),
    t('B', 'boss', 1, 8, [], 'dragon'),
  ].map((tile) => [tile.id, tile])),
};
