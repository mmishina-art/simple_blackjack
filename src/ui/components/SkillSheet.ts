import { audio } from '../../audio/AudioManager';
import type { Rarity } from '../../core/rarity';
import type { SkillKind } from '../../core/skills/Skill';
import { kindTagOf, medalKindClass } from '../kind';
import { rarityBadge, rarityClass } from '../rarity';

export interface SheetOption {
  icon: string;
  name: string;
  /** 効果の説明（実数値つき）。 */
  detail: string;
  rarity?: Rarity;
  /** 名前の横に出す小さなタグ（例: 「現在」「×2」「15 に配置中」）。 */
  badge?: string;
  /** 補足（例: 「いまの○○は持ち物に戻る」）。 */
  note?: string;
  disabled?: boolean;
  /** reset は「外す」「初期装備に戻す」のような操作の選択肢（スキルとは別の見た目）。 */
  kind?: 'skill' | 'reset' | 'confirm';
  /** この選択肢が属する区分（「スキル」「道具」）。区分が変わるところに見出しが出る。 */
  section?: string;
  /** スキル・道具・防具の区分（メダルの形と札）。 */
  skillKind?: SkillKind;
  onPick(): void;
}

export interface SheetConfig {
  title: string;
  subtitle?: string;
  /** 選べない理由などの注意書き。 */
  notice?: string;
  /** 見出しと選択肢の間に出す、好きな内容（ビフォーアフターの比較など）。 */
  content?: HTMLElement;
  options: SheetOption[];
  /** 選択肢が1つもないときの文言。 */
  empty?: string;
  onClose?(): void;
}

/**
 * 下から出る選択シート。スロットをタップ → 置けるスキルの一覧から1つ選ぶ、という1ステップの操作に使う。
 * 背景のタップ・「やめる」・Escape で閉じる。戻り値は閉じる関数。
 */
export function openSheet(cfg: SheetConfig): () => void {
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-label', cfg.title);

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const head = document.createElement('header');
  head.className = 'sheet__head';
  head.innerHTML = `<span class="sheet__grip" aria-hidden="true"></span><h2>${cfg.title}</h2>${cfg.subtitle ? `<p>${cfg.subtitle}</p>` : ''}`;
  sheet.append(head);

  if (cfg.notice) {
    const notice = document.createElement('p');
    notice.className = 'sheet__notice';
    notice.textContent = cfg.notice;
    sheet.append(notice);
  }

  if (cfg.content) sheet.append(cfg.content);

  const list = document.createElement('div');
  list.className = 'sheet__list';
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    layer.remove();
    cfg.onClose?.();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  let firstEnabled: HTMLButtonElement | null = null;
  let lastSection: string | undefined;
  for (const opt of cfg.options) {
    if (opt.section && opt.section !== lastSection) {
      const h = document.createElement('h3');
      h.className = 'sheet__section';
      h.textContent = opt.section;
      list.append(h);
    }
    lastSection = opt.section ?? lastSection;
    const btn = document.createElement('button');
    btn.className = `pick ${opt.kind === 'reset' ? 'pick--reset' : opt.kind === 'confirm' ? 'pick--confirm' : rarityClass(opt.rarity)}`;
    btn.disabled = !!opt.disabled;
    // 決定・リセットのボタンには、アイコン（メダル）を付けない（意味がないため）。スキル・道具の選択肢だけ付ける
    btn.innerHTML = `${opt.kind === 'confirm' || opt.kind === 'reset' ? '' : `<span class="medal${opt.skillKind ? medalKindClass(opt.skillKind) : ''}">${opt.icon}</span>`}
      <span class="pick__text">
        <strong>${opt.name}${opt.skillKind && opt.skillKind !== 'skill' ? ` ${kindTagOf(opt.skillKind)}` : ''}${opt.badge ? ` <em class="pick__badge">${opt.badge}</em>` : ''}</strong>
        <span class="pick__detail">${opt.detail}</span>
        ${opt.note ? `<span class="pick__note">${opt.note}</span>` : ''}
      </span>
      ${opt.kind === 'reset' || opt.kind === 'confirm' ? '' : rarityBadge(opt.rarity)}`;
    btn.addEventListener('click', () => {
      if (opt.disabled) return;
      audio.sfx('pick');
      layer.remove();
      document.removeEventListener('keydown', onKey);
      opt.onPick();
    });
    if (!btn.disabled && !firstEnabled) firstEnabled = btn;
    list.append(btn);
  }
  if (cfg.options.length === 0 && cfg.empty) {
    const empty = document.createElement('p');
    empty.className = 'sheet__empty';
    empty.textContent = cfg.empty;
    list.append(empty);
  }
  sheet.append(list);

  const foot = document.createElement('button');
  foot.className = 'sheet__close';
  foot.textContent = 'やめる';
  foot.addEventListener('click', () => {
    audio.sfx('click');
    close();
  });
  sheet.append(foot);

  layer.addEventListener('click', (e) => {
    if (e.target === layer) close();
  });
  layer.append(sheet);
  document.body.append(layer);
  document.addEventListener('keydown', onKey);
  (firstEnabled ?? foot).focus();
  return close;
}
