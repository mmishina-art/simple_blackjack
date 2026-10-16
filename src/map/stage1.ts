import type { StageMap, TileDef, TileKind } from './StageMap';

const t = (id: string, kind: TileKind, col: number, row: number, next: string[], enemyId?: string): TileDef => ({
  id, kind, col, row, next, enemyId,
});

/**
 * ステージ1「忘れられた地下墓所」（9段・祠 1 箇所）。
 *   序盤（2〜3段）:
 *     左【突破・遺物】: 重装の盾兵（高ブロック）を破ってすぐ宝箱を得る
 *     中【連戦・分岐】: 骸骨兵 → 大蝙蝠の連戦でスキルを集め、東西どちらの回廊へも渡れる
 *     右【賞金稼ぎ】: 貪欲なミミック（ゴールド3倍）を倒し、直後のショップで買い込む
 *   中盤〜終盤（4〜7段）:
 *     西回廊（W1）→ 挑戦ルート（屍食鬼 → 宝箱 → 宿屋）または中央ショップへ
 *     東回廊（E1）→ 聖域ルート（階層唯一の祠 H1 で会心の一撃を強化 → ミミック）または中央ショップへ
 *     7段目は宿屋（I1）で万全にするか、さらに骸骨兵（E3）を狩って稼ぐかの二択
 */
export const STAGE_1: StageMap = {
  id: 'stage1',
  name: '忘れられた地下墓所',
  start: 'S',
  tiles: Object.fromEntries([
    t('S', 'start', 1, 0, ['A']),
    t('A', 'enemy', 1, 1, ['L1', 'M1', 'R1'], 'slime'),

    t('L1', 'enemy', 0, 2, ['L2'], 'shield_bearer'),
    t('M1', 'enemy', 1, 2, ['M2'], 'skeleton'),
    t('R1', 'enemy', 2, 2, ['R2'], 'mimic'),

    t('L2', 'chest', 0, 3, ['W1']),
    t('M2', 'enemy', 1, 3, ['W1', 'E1'], 'bat'),
    t('R2', 'shop', 2, 3, ['E1']),

    t('W1', 'enemy', 0, 4, ['G1', 'M3'], 'bat'),
    t('E1', 'enemy', 2, 4, ['M3', 'H1'], 'skeleton'),

    t('G1', 'enemy', 0, 5, ['C2'], 'ghoul'),
    t('M3', 'enemy', 1, 5, ['P2'], 'shield_bearer'),
    t('H1', 'shrine', 2, 5, ['E2']),

    t('C2', 'chest', 0, 6, ['I1']),
    t('P2', 'shop', 1, 6, ['I1', 'E3']),
    t('E2', 'enemy', 2, 6, ['I1', 'E3'], 'mimic'),

    t('I1', 'inn', 0, 7, ['B']),
    t('E3', 'enemy', 2, 7, ['B'], 'skeleton'),

    t('B', 'boss', 1, 8, [], 'knight'),
  ].map((tile) => [tile.id, tile])),
};
