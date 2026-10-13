import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { customCount, resetStartingSkills, discoverRelic, discoverSkill, finishRun, loadMeta, saveMeta, startingCapacity, type MetaState, type RunSummary } from './meta/Meta';
import { describeSkillBonus, getSkill, KIND_LABEL, kindOfSkill, rarityOfSkill } from './core/skills/Skill';
import { defaultRng } from './core/util/Rng';
import { useInn } from './map/events';
import type { TileDef } from './map/StageMap';
import {
  armorCap, createRun, enemyOfTile, isCleared, markCleared, moveTo, offerRelics, offerSkills, type RunState,
} from './run/Run';
import { BattleView } from './ui/BattleView';
import { showChoiceScreen, showNotice } from './ui/ChoiceScreen';
import { STAGE_BACKDROP, TITLE_ART } from './ui/components/enemySprites';
import { createInstallEntry } from './ui/InstallGuide';
import { showLoadout } from './ui/LoadoutScreen';
import { showMap } from './ui/MapView';
import { openSheet } from './ui/components/SkillSheet';
import { showShrine } from './ui/ShrineScreen';
import { showSettings } from './ui/SettingsScreen';
import { setupUpdateBanner } from './ui/UpdateBanner';
import { hasUnusedKitOpportunity } from './meta/prep';
import { showAltar, showCodex, showPrep } from './ui/MetaScreens';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
const meta: MetaState = loadMeta();
let run: RunState = createRun(undefined, meta);
/** 素の状態で挑んでいる冒険か（祭壇の強化・図鑑・初期装備の変更を使わず、魂片・図鑑も記録しない）。 */
let bareRun = false;
let view: BattleView | null = null;
let unbindSounds: (() => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'btn btn--retry', `<span class="btn__main">${label}</span>`);
  b.addEventListener('click', () => {
    audio.sfx('click');
    onClick();
  });
  return b;
}

function leaveBattle(): void {
  view?.destroy();
  view = null;
  unbindSounds?.();
  unbindSounds = null;
}

// ---- マップ ----
function showMapScreen(message = ''): void {
  leaveBattle();
  syncCodex();
  showMap(root, run, {
    onMove: (id) => resolveTile(moveTo(run, id)),
    onLoadout: () => showLoadout(root, run, { onClose: (msg) => showMapScreen(msg ?? message) }),
  }, message);
}

/** 到着したマスのイベント。済みのマスでは何も起きない。 */
function resolveTile(tile: TileDef): void {
  if (isCleared(run, tile.id)) return showMapScreen();
  switch (tile.kind) {
    case 'enemy':
    case 'boss':
      return startBattle(tile);
    case 'chest': {
      const relics = offerRelics(run, defaultRng);
      markCleared(run, tile.id);
      if (relics.length === 0) return showNotice(root, { heading: '宝箱', text: '中は空っぽだった。', button: '進む', onClose: () => showMapScreen() });
      return showChoiceScreen(root, {
        heading: '宝箱',
        sub: '遺物をひとつ選べ',
        options: relics,
        onPick(i) {
          run.relics.push(relics[i]);
          showMapScreen(`「${relics[i].name}」を手に入れた。`);
        },
      });
    }
    case 'inn': {
      const healed = useInn(run);
      markCleared(run, tile.id);
      return showNotice(root, {
        heading: '宿屋',
        text: healed > 0 ? `ひと晩休んだ。HP が ${healed} 回復した。` : 'ひと晩休んだが、傷はなかった。',
        button: '出発する',
        onClose: () => showMapScreen(),
      });
    }
    case 'shrine': {
      return showShrine(root, run, {
        rng: defaultRng,
        onDone: (message) => { markCleared(run, tile.id); showMapScreen(message); },
        onLeave: () => showMapScreen(),
      });
    }
    default:
      return showMapScreen(tile.kind === 'empty' ? '何もなかった。' : '');
  }
}

// ---- 戦闘 ----
function startBattle(tile: TileDef): void {
  leaveBattle();
  const machine = new BattleMachine({
    enemy: enemyOfTile(tile),
    playerMaxHp: run.maxHp,
    playerHp: run.hp,
    playerSlots: run.slots,
    playerArmorCap: armorCap(run),
    playerFallback: run.fallbackSkill,
    playerAttack: run.baseAttack,
    playerBlock: run.bonus.startBlock,
    relics: run.relics,
  });
  unbindSounds = bindBattleSounds(machine, audio);
  view = new BattleView(root, machine, run, (won) => buildResult(machine, tile, won));
  void machine.run();
}

/** 持っているスキル・レリックを図鑑に登録する（負けても残る）。 */
function syncCodex(): void {
  if (bareRun) return; // 素の状態の冒険は、図鑑に記録しない
  let changed = false;
  for (const id of [...Object.values(run.slots), run.armor, ...run.inventory]) if (id) changed = discoverSkill(meta, id) || changed;
  for (const r of run.relics) changed = discoverRelic(meta, r.id) || changed;
  if (changed) saveMeta(meta);
}

/** 冒険の終了処理: 魂片を獲得して保存する。獲得量を返す。 */
function endRun(cleared: boolean): number {
  if (bareRun) return 0; // 魂片・戦績も記録しない
  syncCodex();
  const summary: RunSummary = { maxRow: run.stats.maxRow, enemiesDefeated: run.stats.enemiesDefeated, cleared };
  const gained = finishRun(meta, summary);
  saveMeta(meta);
  return gained;
}

/** 冒険を始める。装備は出撃準備で決めた保存済みの設定が使われる。 */
function startAdventure(): void {
  bareRun = false;
  run = createRun(undefined, meta);
  showMapScreen();
}

/** 素の状態で冒険を始める: 祭壇の強化・図鑑・出撃準備の変更を使わず、記録も残さない（バランスを試すため）。 */
function startBareAdventure(): void {
  bareRun = true;
  run = createRun();
  showMapScreen('素の状態で出発した（祭壇の強化・初期装備の変更は使わず、記録も残らない）');
}

function restartRun(): void {
  if (bareRun) startBareAdventure();
  else startAdventure();
}

/** 戦闘終了時のオーバーレイ。敗北でやり直し、勝利で報酬スキルの選択へ進む。 */
function buildResult(machine: BattleMachine, tile: TileDef, won: boolean): HTMLElement {
  const box = el('div', 'result');
  box.append(el('h1', `overlay__title overlay__title--${won ? 'win' : 'lose'}`,
    won ? '勝　利<small>VICTORY</small>' : '敗　北<small>DEFEAT</small>'));

  const shardsLine = (gained: number) =>
    el('p', 'result__line result__shards', bareRun ? '素の状態の冒険（魂片・図鑑は記録されない）' : `魂片 +${gained}（所持 ${meta.shards}）`);
  const endButtons = (retry: string) => {
    const altar = button('魂の祭壇', () => showAltar(root, meta, showTitle));
    altar.classList.replace('btn--retry', 'btn--stand');
    return [altar, button(retry, restartRun)];
  };

  if (!won) {
    box.append(shardsLine(endRun(false)), ...endButtons('もう一度'));
    return box;
  }

  run.hp = machine.ctx.player.hp;
  run.stats.enemiesDefeated++;
  markCleared(run, tile.id);

  if (tile.kind === 'boss') {
    box.append(el('p', 'result__line', `${run.map.name}を踏破した！`), shardsLine(endRun(true)), ...endButtons('もう一度挑む'));
    return box;
  }
  box.append(button('次へ', offerSkillReward));
  return box;
}

/** 敵を倒した報酬: スキルを3択で獲得し、そのまま編成画面でセットする。 */
function offerSkillReward(): void {
  const ids = offerSkills(defaultRng, run);
  showChoiceScreen(root, {
    heading: 'スキル獲得',
    sub: 'ひとつ選んで装備する（スキル: 基本攻撃力が基準 / 道具: 効果が固定 / 防具: 防御スロット）',
    options: ids.map((id) => ({ rarity: rarityOfSkill(getSkill(id)), icon: getSkill(id).icon, name: getSkill(id).name, description: describeSkillBonus(getSkill(id)), tag: KIND_LABEL[kindOfSkill(getSkill(id))], kind: kindOfSkill(getSkill(id)) })),
    onPick(i) {
      run.inventory.push(ids[i]);
      syncCodex();
      showLoadout(root, run, { armed: ids[i], onClose: (msg) => showMapScreen(msg) });
    },
  });
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  const screen = el('main', 'title');
  const art = el('div', 'enemy-stage title-stage');
  art.append(el('div', 'enemy-backdrop', STAGE_BACKDROP), el('div', 'title-art', TITLE_ART));
  // 音の切り替え（タイトルでも BGM が鳴るので、ここでも止められるようにする）
  const mute = el('button', 'mute title__mute', '♪');
  mute.setAttribute('aria-label', 'サウンドの切り替え');
  const renderMute = () => {
    mute.classList.toggle('mute--off', audio.muted);
    mute.setAttribute('aria-pressed', String(audio.muted));
  };
  mute.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    audio.unlock(); // ボタンを押したので、音を始めてよい（オンにしたときに、音楽が流れるように）
    audio.sfx('click');
    renderMute();
  });
  renderMute();
  const h1 = el('h1', '', 'BLACKJACK<small>ROGUELIKE</small>');
  const sub = el('p', '', '二十一に近き者が先を制す。分かれ道を選び、地下墓所の主を討て。');
  const start = el('button', 'btn btn--hit title__start', '<span class="btn__main">冒険を始める</span>');
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startAdventure();
  });
  const sub2 = el('div', 'title__sub title__sub--3');
  const unlock = () => {
    audio.unlock();
    audio.sfx('click');
  };
  const prep = el('button', 'btn btn--stand', `<span class="btn__main">出撃準備</span><span class="btn__sub">装備 ${customCount(meta)}/${startingCapacity(meta)}</span>`);
  if (hasUnusedKitOpportunity(meta)) prep.classList.add('btn--notice');
  prep.addEventListener('click', () => {
    unlock();
    showPrep(root, meta, startAdventure, showTitle);
  });
  const altar = el('button', 'btn btn--stand', `<span class="btn__main">祭壇</span><span class="btn__sub">魂片 ${meta.shards}</span>`);
  altar.addEventListener('click', () => {
    unlock();
    showAltar(root, meta, showTitle);
  });
  const codex = el('button', 'btn btn--stand', '<span class="btn__main">図鑑</span><span class="btn__sub">入手の記録</span>');
  codex.addEventListener('click', () => {
    unlock();
    showCodex(root, meta, showTitle);
  });
  sub2.append(prep, altar, codex);
  const reset = el('button', 'title__reset', 'スキルを初期化');
  reset.addEventListener('click', () => {
    unlock();
    const n = customCount(meta);
    openSheet({
      title: 'スキルを初期化する？',
      subtitle: n > 0
        ? `出撃準備で変えた初期装備 ${n} 件を、素の状態（初期装備）に戻す。魂片・祭壇の強化・図鑑は変わらない`
        : '出撃準備で変えた初期装備はない（すでに素の状態）。魂片・祭壇の強化・図鑑は変わらない',
      options: [{
        kind: 'reset', icon: '戻', name: '初期装備に戻す', detail: '小攻撃・薬草・シールド・盾・大攻撃・会心の一撃（防具は鉄の盾）',
        disabled: n === 0,
        onPick() {
          resetStartingSkills(meta);
          saveMeta(meta);
          showTitle();
        },
      }],
    });
  });
  const bare = el('button', 'title__reset', '素の状態で挑む');
  bare.addEventListener('click', () => {
    unlock();
    openSheet({
      title: '素の状態で挑む？',
      subtitle: '祭壇の強化・図鑑・出撃準備の変更を使わずに始める。この冒険では魂片も図鑑も記録されない（いまの記録は消えない）',
      options: [{
        kind: 'reset', icon: '素', name: '素の状態で始める', detail: 'HP 30・初期装備・鉄の盾で出発',
        onPick: startBareAdventure,
      }],
    });
  });
  const settings = el('button', 'title__reset', '設定');
  settings.addEventListener('click', () => {
    unlock();
    showSettings(root, meta, showTitle);
  });
  const links = el('div', 'title__links');
  links.append(bare, reset, settings);
  screen.append(mute, art, h1, sub, start, sub2, links);
  // 最初の画面に「インストールする方法」の入口を置く（インストール済みのアプリでは出ない）
  const install = createInstallEntry();
  if (install) screen.append(install);
  const ver = el('p', 'title__version', `v${__APP_VERSION__}`);
  ver.id = 'app-version';
  screen.append(ver);
  root.replaceChildren(screen);
}

showTitle();
setupUpdateBanner();

// ここまで来たら起動成功（public/boot.js が見ている）
window.__appStarted = true;
