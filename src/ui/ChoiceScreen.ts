import { audio } from '../audio/AudioManager';

export interface ChoiceOption {
  icon: string;
  name: string;
  description: string;
}

export interface ChoiceScreenConfig {
  heading: string;
  sub: string;
  options: ChoiceOption[];
  onPick(index: number): void;
}

/** 報酬やレベルアップの選択画面。誤タップを避けるため、表示直後は少しだけ押せない。 */
export function showChoiceScreen(root: HTMLElement, cfg: ChoiceScreenConfig): void {
  const screen = document.createElement('main');
  screen.className = 'choice';

  const head = document.createElement('header');
  head.className = 'choice__head';
  const h = document.createElement('h1');
  h.textContent = cfg.heading;
  const sub = document.createElement('p');
  sub.textContent = cfg.sub;
  head.append(h, sub);

  const list = document.createElement('div');
  list.className = 'choice__list';
  const buttons = cfg.options.map((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice__card';
    btn.disabled = true;
    btn.innerHTML = `<span class="medal">${opt.icon}</span>
      <span class="choice__text"><strong>${opt.name}</strong><span>${opt.description}</span></span>`;
    btn.addEventListener('click', () => {
      audio.sfx('pick');
      cfg.onPick(i);
    });
    return btn;
  });
  list.append(...buttons);
  screen.append(head, list);
  root.replaceChildren(screen);
  window.setTimeout(() => buttons.forEach((b) => (b.disabled = false)), 450);
}
