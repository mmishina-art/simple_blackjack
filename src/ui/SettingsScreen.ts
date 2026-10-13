import { audio } from '../audio/AudioManager';
import { CODEX_ARMOR_TOTAL, CODEX_ITEM_TOTAL, CODEX_RELIC_TOTAL, CODEX_SKILL_TOTAL, resetAllMeta, saveMeta, type MetaState } from '../meta/Meta';
import { isDebug, setDebug } from '../debug';
import { openSheet } from './components/SkillSheet';

/**
 * 設定画面。いまは「記録のすべての初期化」だけ（元に戻せないので、確認を2回はさむ）。
 * 魂片・祭壇の強化・図鑑・戦績が消える。音の設定は消さない。
 */
export function showSettings(root: HTMLElement, meta: MetaState, onClose: () => void): void {
  const screen = document.createElement('main');
  screen.className = 'meta-screen settings';
  const head = document.createElement('header');
  head.className = 'meta-head';
  head.innerHTML = '<h1>設定</h1><p class="meta-head__sub">記録は、このブラウザの中に保存されている</p>';

  const box = document.createElement('section');
  box.className = 'settings__box';
  const total = CODEX_SKILL_TOTAL + CODEX_ITEM_TOTAL + CODEX_ARMOR_TOTAL;
  const found = meta.codex.skills.length;
  box.innerHTML = `<h2>記録の初期化</h2>
    <p>魂片・祭壇の強化・図鑑・戦績を、すべて消して、最初の状態に戻す。<strong>元に戻せない</strong>ので、先に祭壇の「記録のバックアップ」でファイルに残しておくのがおすすめ。</p>
    <p class="settings__now">いまの記録: 魂片 ${meta.shards} / 図鑑 スキル・道具・防具 ${Math.min(found, total)}・レリック ${meta.codex.relics.length} / ${CODEX_RELIC_TOTAL} / 冒険 ${meta.stats.runs} 回</p>`;
  const danger = document.createElement('button');
  danger.className = 'settings__danger';
  danger.textContent = '記録をすべて初期化する';
  danger.addEventListener('click', () => {
    audio.sfx('click');
    openSheet({
      title: '記録をすべて消す？',
      subtitle: '魂片・祭壇の強化・図鑑・戦績が、すべて消える。元に戻せない',
      options: [{
        kind: 'reset', icon: '消', name: 'つぎへ（もう一度確認する）', detail: '音の設定は消えない',
        onPick() {
          openSheet({
            title: '本当に消しますか？',
            subtitle: 'この操作は取り消せません',
            options: [{
              kind: 'reset', icon: '消', name: 'すべて消す', detail: '最初の状態に戻る',
              onPick() {
                resetAllMeta(meta);
                saveMeta(meta);
                onClose();
              },
            }],
          });
        },
      }],
    });
  });
  box.append(danger);

  const dbg = document.createElement('section');
  dbg.className = 'settings__box';
  dbg.innerHTML = `<h2>デバッグモード</h2>
    <p>冒険中の画面の左上に、「G」（ゴールドを最大にする）と「勝」（いまの戦闘にすぐ勝つ）のボタンが出る。<strong>使った冒険は、魂片・図鑑・戦績を記録しない</strong>。</p>`;
  const toggle = document.createElement('button');
  toggle.className = 'btn btn--stand loadout__btn';
  const renderToggle = (): void => {
    toggle.innerHTML = `<span class="btn__main">デバッグモード: ${isDebug() ? 'オン' : 'オフ'}</span>`;
    toggle.setAttribute('aria-pressed', String(isDebug()));
  };
  renderToggle();
  toggle.addEventListener('click', () => { audio.sfx('click'); setDebug(!isDebug()); renderToggle(); });
  dbg.append(toggle);

  const back = document.createElement('button');
  back.className = 'btn btn--retry loadout__btn';
  back.innerHTML = '<span class="btn__main">戻る</span>';
  back.addEventListener('click', () => {
    audio.sfx('click');
    onClose();
  });
  const body = document.createElement('div');
  body.className = 'meta-body';
  body.append(box, dbg);
  screen.append(head, body, back);
  root.replaceChildren(screen);
}
