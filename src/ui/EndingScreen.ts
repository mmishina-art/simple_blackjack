import { audio } from '../audio/AudioManager';
import { STAGE_BACKDROP, TITLE_ART } from './components/enemySprites';

export interface EndingSummary {
  /** 今回の冒険で得た魂片（素の状態の冒険では 0）。 */
  gained: number;
  /** 魂片の所持数。 */
  shards: number;
  enemiesDefeated: number;
  relics: number;
  /** 素の状態の冒険（記録されない）。 */
  bare: boolean;
}

/** エンディングの文章。1ページずつ、タップで進む。 */
export const ENDING_PAGES: readonly string[] = [
  '黒竜は崩れ落ち、巣を満たしていた炎が、静かに消えていった。',
  '地下墓所の骸骨。沈んだ大聖堂の亡霊。竜の巣の炎。\nあなたは三つの闇を越えた。',
  '手の中に残るのは、数字と、数枚のカードだけ。\nそれでも、二十一に近き者が先を制した。',
  '地上から、朝の光が差し込んでくる。\n冒険はここで終わり、そして、また始まる。',
];

/** 結果の一覧（表示用の行）。 */
export function endingSummaryLines(s: EndingSummary): string[] {
  const lines = [`倒した敵　${s.enemiesDefeated}`, `手に入れた遺物　${s.relics}`];
  lines.push(s.bare ? '素の状態の冒険（魂片・図鑑は記録されない）' : `魂片　+${s.gained}（所持 ${s.shards}）`);
  return lines;
}

/**
 * エンディング。文章を1ページずつ見せ（タップ / ボタンで進む。「飛ばす」で最後へ）、
 * 最後に「THE END」と結果を出して、「タイトルへ」で戻る。
 */
export function showEnding(root: HTMLElement, summary: EndingSummary, onClose: () => void): void {
  const screen = document.createElement('main');
  screen.className = 'ending';
  const back = document.createElement('div');
  back.className = 'ending__bg';
  back.innerHTML = STAGE_BACKDROP;
  const body = document.createElement('div');
  body.className = 'ending__body';
  const next = document.createElement('button');
  next.className = 'btn btn--retry ending__next';
  const skip = document.createElement('button');
  skip.className = 'ending__skip';
  skip.textContent = '飛ばす';
  screen.append(back, body, next, skip);
  root.replaceChildren(screen);

  let page = 0;
  const renderPage = (): void => {
    const p = document.createElement('p');
    p.className = 'ending__text';
    p.setAttribute('role', 'status'); // 読み上げ
    p.textContent = ENDING_PAGES[page];
    body.replaceChildren(p);
    next.innerHTML = `<span class="btn__main">${page === ENDING_PAGES.length - 1 ? 'おわり' : 'つぎへ'}</span>`;
    skip.hidden = false;
  };
  const renderEnd = (): void => {
    const art = document.createElement('div');
    art.className = 'ending__art';
    art.innerHTML = TITLE_ART;
    const end = document.createElement('h1');
    end.className = 'ending__end';
    end.innerHTML = 'THE END<small>おつかれさまでした</small>';
    const list = document.createElement('ul');
    list.className = 'ending__list';
    list.setAttribute('role', 'status');
    for (const line of endingSummaryLines(summary)) {
      const li = document.createElement('li');
      li.textContent = line;
      list.append(li);
    }
    body.replaceChildren(art, end, list);
    next.innerHTML = '<span class="btn__main">タイトルへ</span>';
    skip.hidden = true;
    page = ENDING_PAGES.length;
  };

  next.addEventListener('click', () => {
    audio.sfx('click');
    if (page >= ENDING_PAGES.length) return onClose();
    page++;
    if (page >= ENDING_PAGES.length) renderEnd();
    else renderPage();
  });
  skip.addEventListener('click', () => {
    audio.sfx('click');
    renderEnd();
  });
  renderPage();
}
