import { registerSW } from 'virtual:pwa-register';

/**
 * Service Worker の登録と、新しいバージョンのお知らせ。
 * 新しい版は待機させ、「更新」を押したときだけ切り替える（戦闘の途中で勝手に再読み込みしない）。
 * 画面（#app）は作り直されるので、お知らせは body 直下に出す。
 */
export function setupUpdateBanner(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showBanner(() => void updateSW(true));
    },
  });
}

function showBanner(onUpdate: () => void): void {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = '新しいバージョンがあります';

  const update = document.createElement('button');
  update.id = 'update-button';
  update.type = 'button';
  update.className = 'update-banner__btn update-banner__btn--primary';
  update.textContent = '更新';
  update.addEventListener('click', onUpdate);

  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'update-banner__btn';
  later.textContent = 'あとで';
  later.addEventListener('click', () => banner.remove());

  banner.append(text, update, later);
  document.body.append(banner);
}
