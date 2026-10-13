/** デバッグモード（バランス・画面の確認用）。設定画面で切り替える。保存キー `bj-debug` は、記録（bj-meta-v1）とは別で、バックアップには入れない。 */
const KEY = 'bj-debug';

let on = false;
try {
  on = localStorage.getItem(KEY) === '1';
} catch {
  /* 使えなくても動く */
}

export function isDebug(): boolean {
  return on;
}

export function setDebug(value: boolean): void {
  on = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* 使えなくても動く */
  }
}
