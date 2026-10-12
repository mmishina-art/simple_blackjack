import { describe, expect, it } from 'vitest';
import { applyEntries, BACKUP_APP, collectEntries, createBackup, isOlderThanCurrent, parseBackup, runsOf, SCHEMA_VERSION } from '../src/meta/backup';
import { emptyMeta, META_KEY } from '../src/meta/Meta';

const NOW = new Date('2026-10-12T00:00:00Z');

/** localStorage の代わり */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    dump: () => Object.fromEntries(map),
  };
}

const metaWith = (runs: number, shards = 0) => JSON.stringify({ ...emptyMeta(), shards, stats: { runs, clears: 0, bestRow: 0 } });

describe('書き出しと読み込み', () => {
  it('書き出した内容を、そのまま読み込める', () => {
    const data = { [META_KEY]: metaWith(3, 50), 'bj-muted': '1' };
    expect(parseBackup(createBackup(data, NOW))).toEqual(data);
  });

  it('app 名・schemaVersion・日時が入っている', () => {
    expect(JSON.parse(createBackup({}, NOW))).toMatchObject({ app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: NOW.toISOString() });
  });

  it('JSON ではないファイルは読み込まない', () => {
    expect(() => parseBackup('これは JSON ではない')).toThrow('バックアップファイルではありません');
  });

  it('別のアプリのバックアップは読み込まない', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', schemaVersion: 1, data: {} }))).toThrow('このゲームのバックアップではありません');
  });

  it('新しすぎる版のバックアップは、アプリの更新を促して読み込まない', () => {
    expect(() => parseBackup(JSON.stringify({ app: BACKUP_APP, schemaVersion: SCHEMA_VERSION + 1, data: {} }))).toThrow('アプリを更新');
  });

  it('中身が壊れているものは読み込まない（文字列でない値、壊れたメタ進行）', () => {
    const wrap = (data: unknown) => JSON.stringify({ app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, data });
    expect(() => parseBackup(wrap({ 'bj-muted': 1 }))).toThrow('壊れています');
    expect(() => parseBackup(wrap({ [META_KEY]: 'not json' }))).toThrow('魂片・祭壇・図鑑');
    expect(() => parseBackup(wrap({ [META_KEY]: JSON.stringify({ version: 2, shards: 0 }) }))).toThrow('魂片・祭壇・図鑑');
    expect(() => parseBackup(wrap({ [META_KEY]: JSON.stringify([1]) }))).toThrow('魂片・祭壇・図鑑');
  });
});

describe('保存データの集め方と書き戻し', () => {
  it('collectEntries: メタ進行と音の設定だけを集める', () => {
    const s = fakeStorage({ [META_KEY]: metaWith(1), 'bj-muted': '0', 'other-app-key': 'x' });
    expect(Object.keys(collectEntries(s)).sort()).toEqual(['bj-muted', META_KEY].sort());
  });

  it('applyEntries: 対象のキーだけを保存し、それ以外は保存しない', () => {
    const s = fakeStorage();
    const count = applyEntries({ [META_KEY]: metaWith(2), 'bj-muted': '1', 'evil-key': 'x' }, s);
    expect(count).toBe(2);
    expect(s.getItem('evil-key')).toBeNull();
    expect(s.getItem('bj-muted')).toBe('1');
  });
});

describe('古いバックアップの確認', () => {
  it('runsOf: 冒険した回数を取り出す（取り出せなければ 0）', () => {
    expect(runsOf(metaWith(7))).toBe(7);
    expect(runsOf(null)).toBe(0);
    expect(runsOf('壊れたデータ')).toBe(0);
  });

  it('今の記録より冒険した回数が少ないバックアップは「古い」', () => {
    const s = fakeStorage({ [META_KEY]: metaWith(10) });
    expect(isOlderThanCurrent(s, { [META_KEY]: metaWith(4) })).toBe(true);
    expect(isOlderThanCurrent(s, { [META_KEY]: metaWith(10) })).toBe(false);
    expect(isOlderThanCurrent(s, { [META_KEY]: metaWith(12) })).toBe(false);
  });

  it('今の記録がなければ古くない / バックアップにメタ進行がなければ古くない', () => {
    expect(isOlderThanCurrent(fakeStorage(), { [META_KEY]: metaWith(3) })).toBe(false);
    expect(isOlderThanCurrent(fakeStorage({ [META_KEY]: metaWith(10) }), { 'bj-muted': '1' })).toBe(false);
  });
});
