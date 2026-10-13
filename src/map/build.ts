import type { StageMap, TileDef, TileKind } from './StageMap';

/**
 * 地図を、段ごとの文字列から作る（下の段から順に。1段は左・中・右の3文字）。
 *   '.' = マスなし / 'C' = 宝箱 / 'I' = 宿屋 / 'H' = 祠 / 'O' = 何もない / 英小文字 a, b, c … = 敵（enemies の何番目か）
 * スタート（0段）とボス（最上段）は、中央に1つずつ置く。各マスは、1つ上の段の、左右に1列以内のマスへ進める
 * （中央に1マスだけの段は、合流点になる）。ID は、スタート=S、1段目=A、ボス=B、それ以外は「r段+L/M/R」。
 */
export function buildStage(id: string, name: string, enemies: readonly string[], boss: string, rows: readonly string[]): StageMap {
  const kindOf = (ch: string): { kind: TileKind; enemyId?: string } | null => {
    if (ch === '.') return null;
    if (ch === 'C') return { kind: 'chest' };
    if (ch === 'I') return { kind: 'inn' };
    if (ch === 'H') return { kind: 'shrine' };
    if (ch === 'O') return { kind: 'empty' };
    const idx = ch.charCodeAt(0) - 'a'.charCodeAt(0);
    if (idx >= 0 && idx < enemies.length) return { kind: 'enemy', enemyId: enemies[idx] };
    throw new Error(`Unknown tile char: ${ch}`);
  };
  const tileId = (row: number, col: number, last: number): string =>
    row === 0 ? 'S' : row === last ? 'B' : row === 1 ? 'A' : `r${row}${'LMR'[col]}`;

  const last = rows.length + 1; // 0 = スタート、rows.length + 1 = ボス
  const byRow: TileDef[][] = [];
  byRow[0] = [{ id: 'S', kind: 'start', col: 1, row: 0, next: [] }];
  rows.forEach((line, i) => {
    if (line.length !== 3) throw new Error(`Row ${i + 1} must have 3 columns: "${line}"`);
    const row = i + 1;
    byRow[row] = [...line].flatMap((ch, col) => {
      const k = kindOf(ch);
      return k ? [{ id: tileId(row, col, last), kind: k.kind, col, row, next: [], enemyId: k.enemyId }] : [];
    });
  });
  byRow[last] = [{ id: 'B', kind: 'boss', col: 1, row: last, next: [], enemyId: boss }];
  for (let row = 0; row < last; row++) {
    for (const t of byRow[row]) t.next = byRow[row + 1].filter((n) => Math.abs(n.col - t.col) <= 1).map((n) => n.id);
  }
  return { id, name, start: 'S', tiles: Object.fromEntries(byRow.flat().map((t) => [t.id, t])) };
}
