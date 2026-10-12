const KEEP_LINES = 200;
const LIVE_LINES = 20;

/**
 * 戦闘の記録。画面には常時は出さない（ほとんど見られず、場所をとるため）。
 * 代わりに、(1) 読み上げ用の領域（aria-live。見えないが、スクリーンリーダーが新しい行を読む）と、
 * (2) 「記録」ボタンから開くシート（あとから見返す用）で見られる。
 */
export class BattleLog {
  /** 読み上げ用。画面には出ない（.sr-only）。 */
  readonly liveEl = document.createElement('div');
  private lines: string[] = [];

  constructor() {
    this.liveEl.className = 'sr-only';
    this.liveEl.setAttribute('aria-live', 'polite');
  }

  append(text: string): void {
    this.lines.push(text);
    if (this.lines.length > KEEP_LINES) this.lines.shift();
    const p = document.createElement('p');
    p.textContent = text;
    this.liveEl.append(p);
    while (this.liveEl.childElementCount > LIVE_LINES) this.liveEl.firstElementChild?.remove();
  }

  /** 見返し用のシート。いちばん新しい行が下に来る。 */
  buildSheet(onClose: () => void): HTMLElement {
    const sheet = document.createElement('div');
    sheet.className = 'enemy-info history';
    const head = document.createElement('div');
    head.className = 'enemy-info__head';
    const title = document.createElement('h2');
    title.textContent = '戦闘の記録';
    head.append(title);
    const list = document.createElement('div');
    list.className = 'history__list';
    for (const text of this.lines) {
      const p = document.createElement('p');
      p.textContent = text;
      if (text.startsWith('---')) p.className = 'history__round';
      list.append(p);
    }
    if (this.lines.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'まだ記録がありません';
      list.append(p);
    }
    const close = document.createElement('button');
    close.className = 'btn btn--retry enemy-info__close';
    close.innerHTML = '<span class="btn__main">閉じる</span>';
    close.addEventListener('click', onClose);
    sheet.append(head, list, close);
    // シートが画面に入ってから、いちばん新しい行までスクロールする
    window.requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    return sheet;
  }
}
