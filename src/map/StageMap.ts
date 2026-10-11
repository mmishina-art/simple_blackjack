export type TileKind = 'start' | 'empty' | 'enemy' | 'chest' | 'inn' | 'shrine' | 'boss';

export interface TileDef {
  id: string;
  kind: TileKind;
  /** 表示位置。col: 左から 0..2、row: 下（スタート）から 0 始まり。 */
  col: number;
  row: number;
  /** 進める隣接マス（一方向）。分岐は複数。 */
  next: string[];
  /** enemy / boss マスで戦う敵。 */
  enemyId?: string;
}

export interface StageMap {
  id: string;
  name: string;
  start: string;
  tiles: Record<string, TileDef>;
}

export const TILE_LABEL: Record<TileKind, string> = {
  start: 'スタート', empty: '何もない', enemy: '敵', chest: '宝箱', inn: '宿屋', shrine: '祠', boss: 'ボス',
};

export function tileOf(map: StageMap, id: string): TileDef {
  const t = map.tiles[id];
  if (!t) throw new Error(`Unknown tile: ${id}`);
  return t;
}

/** 現在位置から1マスで進めるマス。 */
export function nextTiles(map: StageMap, id: string): TileDef[] {
  return tileOf(map, id).next.map((n) => tileOf(map, n));
}
