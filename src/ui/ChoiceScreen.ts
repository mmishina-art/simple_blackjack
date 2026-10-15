import { audio } from '../audio/AudioManager';
import type { Rarity } from '../core/rarity';
import type { SkillKind } from '../core/skills/Skill';
import { medalKindClass } from './kind';
import { moneyBagSvg } from './components/moneyBag';
import { buildScene, type SceneKind } from './components/scenes';
import { buildTopBar } from './components/TopBar';
import { rarityClass, rarityNote } from './rarity';

export interface ChoiceOption {
  rarity?: Rarity;
  icon: string;
  name: string;
  description: string;
  /** 名前の横の小さなタグ（例: 「道具」）。 */
  tag?: string;
  /** スキル・道具・防具の区分（メダルの形と札の色が変わる）。 */
  kind?: SkillKind;
  /** 色の系統（祠の「入れ替え」「バージョンアップ」…を見分ける）。CSS の `.choice__card--tone-a`〜`d`。 */
  tone?: 'a' | 'b' | 'c' | 'd';
  /** レリック（遺物）なら、六角形のメダル（スキルの丸と見分ける）。 */
  relic?: boolean;
  /** ゴールドの選択肢なら、ドル袋の絵を出す（スキルの丸メダルと区別する）。 */
  gold?: boolean;
}

export interface ChoiceScreenConfig {
  /** 場所の挿絵とひとこと（あれば、見出しの代わりに挿絵つきの見出しを出す）。 */
  scene?: { kind: SceneKind; line?: string; /** 挿絵の中の名前（省略時は heading）。 */ title?: string };
  heading: string;
  sub: string;
  options: ChoiceOption[];
  onPick(index: number): void;
  /** あれば、左上に「‹ 戻る」を出す（ほかの画面と同じ上の行。見出しは heading）。 */
  onBack?(): void;
}

/** 報酬やレベルアップの選択画面。誤タップを避けるため、表示直後は少しだけ押せない。 */
export function showChoiceScreen(root: HTMLElement, cfg: ChoiceScreenConfig): void {
  const screen = document.createElement('main');
  screen.className = `choice${cfg.scene ? ` choice--${cfg.scene.kind}` : ''}${cfg.onBack ? ' choice--bar' : ''}`;

  const head = document.createElement('header');
  head.className = 'choice__head';
  const h = document.createElement('h1');
  h.textContent = cfg.heading;
  const sub = document.createElement('p');
  sub.textContent = cfg.sub;
  if (cfg.scene) head.append(buildScene(cfg.scene.kind, cfg.scene.title ?? cfg.heading, cfg.scene.line ?? cfg.sub));
  else head.append(h, sub);

  const list = document.createElement('div');
  list.className = 'choice__list';
  const buttons = cfg.options.map((opt, i) => {
    const btn = document.createElement('button');
    btn.className = `choice__card ${rarityClass(opt.rarity)}${opt.tone ? ` choice__card--tone-${opt.tone}` : ''}${opt.gold ? ' choice__card--gold' : ''}`;
    btn.disabled = true;
    const iconHtml = opt.gold
      ? `<span class="choice__moneybag" aria-hidden="true">${moneyBagSvg()}</span>`
      : `<span class="medal${opt.kind ? medalKindClass(opt.kind) : ''}${opt.relic ? ' medal--relic' : ''}">${opt.icon}</span>`;
    btn.innerHTML = `${iconHtml}
      <span class="choice__text"><strong>${opt.name}${opt.tag ? ` <em class="kind-tag kind-tag--${opt.kind ?? 'skill'}">${opt.tag}</em>` : ''}</strong><span>${opt.description}</span></span>
      ${opt.rarity ? rarityNote(opt.rarity) : ''}`;
    btn.addEventListener('click', () => {
      audio.sfx('pick');
      cfg.onPick(i);
    });
    return btn;
  });
  list.append(...buttons);
  if (cfg.onBack) screen.append(buildTopBar(cfg.heading, cfg.onBack));
  screen.append(head, list);
  root.replaceChildren(screen);
  window.setTimeout(() => buttons.forEach((b) => (b.disabled = false)), 450);
}

export interface NoticeConfig {
  heading: string;
  text: string;
  button: string;
  onClose(): void;
}

/** 宿屋・祠などの結果を知らせる画面。 */
export function showNotice(root: HTMLElement, cfg: NoticeConfig): void {
  const screen = document.createElement('main');
  screen.className = 'choice notice';
  const head = document.createElement('header');
  head.className = 'choice__head';
  const h = document.createElement('h1');
  h.textContent = cfg.heading;
  const p = document.createElement('p');
  p.className = 'notice__text';
  p.textContent = cfg.text;
  head.append(h, p);
  const btn = document.createElement('button');
  btn.className = 'btn btn--primary';
  btn.innerHTML = `<span class="btn__main">${cfg.button}</span>`;
  btn.disabled = true;
  btn.addEventListener('click', () => {
    audio.sfx('click');
    cfg.onClose();
  });
  screen.append(head, btn);
  root.replaceChildren(screen);
  window.setTimeout(() => (btn.disabled = false), 450);
}
