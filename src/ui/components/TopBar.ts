import { audio } from '../../audio/AudioManager';

/**
 * 画面の上の固定の行: 左に「戻る」（全画面で同じ位置・同じ見た目）、中央に見出し。
 * onBack を渡さないときは、戻るボタンを出さず、見出しだけを中央に置く（置き先を決めるまで閉じられない画面など）。
 */
export function buildTopBar(title: string, onBack?: () => void, label = '戻る'): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  const left = document.createElement(onBack ? 'button' : 'span');
  left.className = onBack ? 'topbar__back' : 'topbar__gap';
  if (onBack) {
    left.textContent = `‹ ${label}`;
    left.setAttribute('aria-label', label);
    left.addEventListener('click', () => {
      audio.sfx('click');
      onBack();
    });
  }
  const h1 = document.createElement('h1');
  h1.className = 'topbar__title';
  h1.textContent = title;
  const right = document.createElement('span');
  right.className = 'topbar__gap';
  bar.append(left, h1, right);
  return bar;
}
