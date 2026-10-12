import { detectPlatform, type Platform } from './installPlatform';

/**
 * タイトル画面の「アプリとしてインストールする方法」。
 * iPhone は自動のインストール案内が出ないので、手順を見せる。
 * Android / パソコンの Chrome・Edge では、使えるときだけ「今すぐインストール」も出す。
 * 画面（#app）は作り直されるので、手順のダイアログは body 直下に一度だけ作り、入口のボタンだけを画面に差し込む。
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STEPS: { platform: Platform; title: string; steps: string[] }[] = [
  {
    platform: 'ios',
    title: 'iPhone / iPad',
    steps: [
      '<strong>Safari</strong> でこのページを開く',
      '共有ボタン（□から↑が出ているマーク）をタップ',
      '「<strong>ホーム画面に追加</strong>」を選ぶ',
      '右上の「追加」をタップ',
    ],
  },
  {
    platform: 'android',
    title: 'Android',
    steps: [
      '<strong>Chrome</strong> でこのページを開く',
      '右上のメニュー（⋮）をタップ',
      '「<strong>アプリをインストール</strong>」または「ホーム画面に追加」を選ぶ',
      '「インストール」をタップ',
    ],
  },
  {
    platform: 'pc',
    title: 'パソコン（Chrome / Edge）',
    steps: ['アドレスバーの右端にあるインストールのマークをクリック', '「<strong>インストール</strong>」を選ぶ'],
  },
];

let deferred: BeforeInstallPromptEvent | null = null;
let dialog: HTMLDialogElement | null = null;
let installNow: HTMLButtonElement | null = null;
const entries = new Set<HTMLElement>();

/** すでにインストールされ、アプリとして開かれているか */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  if (installNow) installNow.hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  if (installNow) installNow.hidden = true;
  entries.forEach((b) => b.remove());
  entries.clear();
  dialog?.close();
});

function buildDialog(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.id = 'install-dialog';
  d.className = 'install-dialog';
  d.setAttribute('aria-labelledby', 'install-title');

  const h = document.createElement('h2');
  h.id = 'install-title';
  h.textContent = 'ホーム画面に追加して使う';
  const lead = document.createElement('p');
  lead.textContent = 'インストールすると、ホーム画面から開けて、オフラインでも遊べます。';

  installNow = document.createElement('button');
  installNow.type = 'button';
  installNow.className = 'install-dialog__btn install-dialog__btn--primary';
  installNow.textContent = '今すぐインストール';
  installNow.hidden = deferred === null;
  installNow.addEventListener('click', async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    if (installNow) installNow.hidden = true;
  });

  d.append(h, lead, installNow);
  for (const p of STEPS) {
    const details = document.createElement('details');
    details.dataset.platform = p.platform;
    const summary = document.createElement('summary');
    summary.textContent = p.title;
    const ol = document.createElement('ol');
    ol.innerHTML = p.steps.map((s) => `<li>${s}</li>`).join('');
    details.append(summary, ol);
    d.append(details);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'install-dialog__btn';
  close.textContent = 'とじる';
  close.addEventListener('click', () => d.close());
  d.append(close);
  document.body.append(d);
  return d;
}

/** 入口のボタンを作る。インストール済みのアプリの中では null（入口を出さない）。 */
export function createInstallEntry(): HTMLButtonElement | null {
  if (isStandalone()) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'install-open';
  button.className = 'install-link';
  button.textContent = '📲 アプリとしてインストールする方法';
  button.addEventListener('click', () => {
    dialog ??= buildDialog();
    // 今使っている端末の説明を最初から開いておく
    const mine = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    dialog.querySelectorAll<HTMLDetailsElement>('details[data-platform]').forEach((el) => {
      el.open = el.dataset.platform === mine;
    });
    dialog.showModal();
  });
  entries.add(button);
  return button;
}
