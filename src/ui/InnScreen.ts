import { audio } from '../audio/AudioManager';
import { buildScene } from './components/scenes';

export interface InnConfig {
  /** 泊まる前・あとの HP と、最大 HP。 */
  before: number;
  after: number;
  max: number;
  onClose(): void;
}

/** 宿屋。暖かい部屋の挿絵と、宿の主人のひとこと、HP が回復していくメーター。 */
export function showInn(root: HTMLElement, cfg: InnConfig): void {
  const healed = cfg.after - cfg.before;
  const screen = document.createElement('main');
  screen.className = 'choice inn';
  const head = document.createElement('header');
  head.className = 'choice__head';
  head.append(buildScene('inn', '宿屋', healed > 0 ? '「ゆっくり休んでいきな」' : '「傷もないのに？ まあ、いい夢を」'));

  const rest = document.createElement('section');
  rest.className = 'inn__rest';
  const pct = (v: number): number => Math.max(0, Math.min(100, (v / cfg.max) * 100));
  rest.innerHTML = `<p class="inn__label">ひと晩、休んだ</p>
    <div class="inn__bar" role="img" aria-label="HP ${cfg.before} から ${cfg.after}（最大 ${cfg.max}）"><div class="inn__fill" style="width:${pct(cfg.before)}%"></div></div>
    <p class="inn__nums">HP <b>${cfg.before}</b> <span aria-hidden="true">→</span> <b class="inn__after">${cfg.after}</b> / ${cfg.max}${healed > 0 ? `<em> +${healed}</em>` : ''}</p>`;

  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.innerHTML = '<span class="btn__main">出発する</span>';
  btn.disabled = true;
  btn.addEventListener('click', () => { audio.sfx('click'); cfg.onClose(); });

  screen.append(head, rest, btn);
  root.replaceChildren(screen);
  // 次のフレームで伸ばして、回復していくのを見せる
  requestAnimationFrame(() => requestAnimationFrame(() => {
    (rest.querySelector('.inn__fill') as HTMLElement).style.width = `${pct(cfg.after)}%`;
  }));
  window.setTimeout(() => (btn.disabled = false), 450);
}
