import { applyEntries, collectEntries, createBackup, isOlderThanCurrent, parseBackup } from '../meta/backup';

/**
 * 「魂の祭壇」の下に置く「記録のバックアップ」。
 * 読み込んだら、画面（と、メモリにある記録）を作り直すために、ページを読み込み直す。
 * 今の記録より古いバックアップのときは、置き換えてよいか確かめる。
 */
export function createBackupSection(): HTMLElement {
  const details = document.createElement('details');
  details.className = 'backup';

  const summary = document.createElement('summary');
  summary.textContent = '記録のバックアップ';
  const note = document.createElement('p');
  note.textContent = '記録は、このブラウザの中にだけ保存されています。ファイルに残しておくと、消えたときに戻せます。';
  const message = document.createElement('p');
  message.id = 'backup-message';
  message.setAttribute('role', 'status');

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'backup-export';
  exportButton.className = 'backup__btn';
  exportButton.textContent = 'ファイルに書き出す';
  exportButton.addEventListener('click', () => {
    const blob = new Blob([createBackup(collectEntries(localStorage))], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `simple-blackjack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.textContent = 'ファイルに書き出しました';
  });

  const label = document.createElement('label');
  label.className = 'backup__btn';
  label.textContent = 'ファイルから読み込む';
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'backup-import';
  input.accept = 'application/json,.json';
  input.hidden = true;
  label.append(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      if (isOlderThanCurrent(localStorage, data) && !window.confirm('このバックアップは、今の記録より古いようです。今の記録を置き換えますか？')) {
        message.textContent = '読み込みをやめました';
      } else {
        const count = applyEntries(data, localStorage);
        message.textContent = `${count} 件の記録を読み込みました。画面を読み込み直します…`;
        setTimeout(() => location.reload(), 1200);
      }
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : '読み込めませんでした';
    }
    input.value = '';
  });

  details.append(summary, note, exportButton, label, message);
  return details;
}
