import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { describeSkill, getSkill } from './core/skills/Skill';
import { defaultRng } from './core/util/Rng';
import { resolveShrine, useInn } from './map/events';
import type { TileDef } from './map/StageMap';
import {
  createRun, enemyOfTile, isCleared, markCleared, moveTo, offerRelics, offerSkills, type RunState,
} from './run/Run';
import { BattleView } from './ui/BattleView';
import { showChoiceScreen, showNotice } from './ui/ChoiceScreen';
import { EnemyView } from './ui/components/EnemyView';
import { showLoadout } from './ui/LoadoutScreen';
import { showMap } from './ui/MapView';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
let run: RunState = createRun();
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
  showMap(root, run, {
    onMove: (id) => resolveTile(moveTo(run, id)),
    onLoadout: () => showLoadout(root, run, { onClose: () => showMapScreen(message) }),
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
      const result = resolveShrine(run, defaultRng);
      markCleared(run, tile.id);
      return showNotice(root, { heading: `祠 — ${result.title}`, text: result.text, button: '進む', onClose: () => showMapScreen() });
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
    playerFallback: run.fallbackSkill,
    relics: run.relics,
  });
  unbindSounds = bindBattleSounds(machine, audio);
  view = new BattleView(root, machine, run, (won) => buildResult(machine, tile, won));
  void machine.run();
}

function restartRun(): void {
  run = createRun();
  showMapScreen();
}

/** 戦闘終了時のオーバーレイ。敗北でやり直し、勝利で報酬スキルの選択へ進む。 */
function buildResult(machine: BattleMachine, tile: TileDef, won: boolean): HTMLElement {
  const box = el('div', 'result');
  box.append(el('h1', `overlay__title overlay__title--${won ? 'win' : 'lose'}`,
    won ? '勝　利<small>VICTORY</small>' : '敗　北<small>DEFEAT</small>'));

  if (!won) {
    box.append(button('最初からやり直す', restartRun));
    return box;
  }

  run.hp = machine.ctx.player.hp;
  markCleared(run, tile.id);

  if (tile.kind === 'boss') {
    box.append(el('p', 'result__line', `${run.map.name}を踏破した！`), button('もう一度挑む', restartRun));
    return box;
  }
  box.append(button('次へ', offerSkillReward));
  return box;
}

/** 敵を倒した報酬: スキルを3択で獲得し、そのまま編成画面でセットする。 */
function offerSkillReward(): void {
  const ids = offerSkills(defaultRng);
  showChoiceScreen(root, {
    heading: 'スキル獲得',
    sub: 'ひとつ選び、スロットにセットする',
    options: ids.map((id) => ({ icon: getSkill(id).icon, name: getSkill(id).name, description: describeSkill(getSkill(id)) })),
    onPick(i) {
      run.inventory.push(ids[i]);
      showLoadout(root, run, { armed: ids[i], onClose: () => showMapScreen() });
    },
  });
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  const screen = el('main', 'title');
  const enemy = new EnemyView('slime');
  const h1 = el('h1', '', 'BLACKJACK<small>ROGUELIKE</small>');
  const sub = el('p', '', '二十一に近き者が先を制す。分かれ道を選び、地下墓所の主を討て。');
  const start = el('button', 'btn btn--hit title__start', '<span class="btn__main">冒険を始める</span>');
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    showMapScreen();
  });
  screen.append(enemy.el, h1, sub, start);
  root.replaceChildren(screen);
}

showTitle();
