// 記録のバックアップ（ファイルに書き出す / 読み込む）。
// localStorage の記録は、ブラウザの都合で消えることがある（特に iPhone）ので、ファイルに残せるようにする。
// ファイルには app 名と schemaVersion を入れ、別のアプリや新しすぎる版のファイルは読み込まない。
import { META_KEY } from './Meta';

/** バックアップファイルの形（schemaVersion）。形を変えるときは上げ、読み込み側で古い形を変換する。 */
export const SCHEMA_VERSION = 1;
export const BACKUP_APP = 'simple-blackjack';
/** バックアップに入れる保存データのキー: メタ進行（魂片・祭壇・図鑑）と、音の設定 */
export const BACKUP_KEYS = [META_KEY, 'bj-muted'] as const;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, string>;
}

export function createBackup(data: Record<string, string>, now = new Date()): string {
  const file: BackupFile = { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data };
  return JSON.stringify(file, null, 2);
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** ファイルの中身を検査して、保存するデータ（キー → 文字列）を返す。おかしいときは理由つきで例外を投げる。 */
export function parseBackup(text: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error('バックアップファイルではありません', { cause });
  }
  if (!isRecord(parsed) || parsed.app !== BACKUP_APP) throw new Error('このゲームのバックアップではありません');
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error('新しい版のバックアップです。アプリを更新してから読み込んでください');
  }
  if (!isRecord(parsed.data)) throw new Error('バックアップの中身がありません');
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value !== 'string') throw new Error(`バックアップの中身が壊れています: ${key}`);
    data[key] = value;
  }
  const meta = data[META_KEY];
  if (meta !== undefined) {
    let m: unknown;
    try {
      m = JSON.parse(meta);
    } catch (cause) {
      throw new Error('バックアップの中身が壊れています: 魂片・祭壇・図鑑', { cause });
    }
    if (!isRecord(m) || m.version !== 1 || typeof m.shards !== 'number') {
      throw new Error('バックアップの中身が壊れています: 魂片・祭壇・図鑑');
    }
  }
  return data;
}

/** このゲームの保存データ（キー → 文字列）を集める */
export function collectEntries(storage: StorageLike): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const v = storage.getItem(key);
    if (v !== null) data[key] = v;
  }
  return data;
}

/** 「魂の祭壇」などの進み具合の目安（冒険した回数）。取り出せなければ 0。 */
export function runsOf(rawMeta: string | null | undefined): number {
  try {
    const m = JSON.parse(rawMeta ?? 'null') as { stats?: { runs?: unknown } } | null;
    const runs = m?.stats?.runs;
    return typeof runs === 'number' && Number.isFinite(runs) ? runs : 0;
  } catch {
    return 0;
  }
}

/** 読み込もうとしているバックアップが、今の記録より古い（冒険した回数が少ない）か */
export function isOlderThanCurrent(current: StorageLike, incoming: Record<string, string>): boolean {
  if (incoming[META_KEY] === undefined) return false;
  return runsOf(incoming[META_KEY]) < runsOf(current.getItem(META_KEY));
}

/** バックアップの中身を保存する（バックアップに入れる対象のキーだけ）。保存した件数を返す。 */
export function applyEntries(data: Record<string, string>, storage: StorageLike): number {
  let count = 0;
  for (const key of BACKUP_KEYS) {
    if (data[key] === undefined) continue;
    storage.setItem(key, data[key]);
    count++;
  }
  return count;
}
