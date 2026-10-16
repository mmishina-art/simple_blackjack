import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ2「沈んだ大聖堂」（14段・祠 1 箇所）。
 *   序盤（1〜5段）:
 *     魚人(A)から左右二手に分かれ、左はガーゴイル→宝箱、右はミミック（3倍ゴールド）→ショップ。
 *     中央の亡霊(M2)や彷徨う賭博師(M3)を経由して、5段目で宿屋(I1)か宝箱(C2)を選ぶ非対称構造。
 *   中盤（6〜9段）:
 *     6段目の大聖堂橋を塞ぐ高HPの「腐肉の巨兵(B1)」を突破すると、3つの回廊へ分岐:
 *       左【中ボス挑戦】: 水没した騎士(L4) → 宝箱(L5) → 宿屋(I2)
 *       中【鉄壁連戦】: 鋼鉄のゴーレム(M4) → 亡霊(M5) → 宿屋(I2) または ショップ(P2)
 *       右【聖域・唯一祠】: 彷徨う賭博師(R4) → 階層唯一の祠(H2) → ショップ(P2)
 *   終盤（10〜13段）:
 *     ガーゴイル→宝箱の西路、腐肉の巨兵に挑む中央路、ミミック→ショップの東路から、
 *     ボス直前は宿屋(I3)で休むか、鋼鉄のゴーレム(E8)で最後の稼ぎを狙うかを選択。
 */
export const STAGE_2: StageMap = {
  id: 'stage2',
  name: '沈んだ大聖堂',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'R1'], 'merman'),

    t('L1', 'enemy', 0, 2, ['L2', 'M2'], 'gargoyle'),
    t('R1', 'enemy', 2, 2, ['M2', 'R2'], 'mimic'),

    t('L2', 'chest', 0, 3, ['M3']),
    t('M2', 'enemy', 1, 3, ['M3', 'R3'], 'wraith'),
    t('R2', 'shop', 2, 3, ['R3']),

    t('M3', 'enemy', 1, 4, ['I1', 'C2'], 'gambler'),
    t('R3', 'enemy', 2, 4, ['C2'], 'merman'),

    t('I1', 'inn', 0, 5, ['B1']),
    t('C2', 'chest', 2, 5, ['B1']),

    t('B1', 'enemy', 1, 6, ['L4', 'M4', 'R4'], 'colossus'),

    t('L4', 'enemy', 0, 7, ['L5'], 'drowned_knight'),
    t('M4', 'enemy', 1, 7, ['M5'], 'iron_golem'),
    t('R4', 'enemy', 2, 7, ['H2'], 'gambler'),

    t('L5', 'chest', 0, 8, ['I2']),
    t('M5', 'enemy', 1, 8, ['I2', 'P2'], 'wraith'),
    t('H2', 'shrine', 2, 8, ['P2']),

    t('I2', 'inn', 0, 9, ['L6']),
    t('P2', 'shop', 1, 9, ['L6', 'R6']),

    t('L6', 'enemy', 0, 10, ['C3', 'M7'], 'gargoyle'),
    t('R6', 'enemy', 2, 10, ['M7', 'P3'], 'mimic'),

    t('C3', 'chest', 0, 11, ['I3']),
    t('M7', 'enemy', 1, 11, ['I3', 'E8'], 'colossus'),
    t('P3', 'shop', 2, 11, ['I3', 'E8']),

    t('I3', 'inn', 0, 12, ['B']),
    t('E8', 'enemy', 2, 12, ['B'], 'iron_golem'),

    t('B', 'boss', 1, 13, [], 'serpent'),
  ].map((tile) => [tile.id, tile])),
};
