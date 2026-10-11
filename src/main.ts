import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { discoverRelic, discoverSkill, finishRun, loadMeta, saveMeta, selectableStartingSkills, startingCapacity, type MetaState, type RunSummary } from './meta/Meta';
import { describeSkill, getSkill, rarityOfSkill } from './core/skills/Skill';
import { defaultRng } from './core/util/Rng';
import { resolveShrine, useInn } from './map/events';
import type { TileDef } from './map/StageMap';
import {
  createRun, enemyOfTile, isCleared, markCleared, moveTo, offerRelics, offerSkills, type RunState,
} from './run/Run';
import { BattleView } from './ui/BattleView';
import { showChoiceScreen, showNotice } from './ui/ChoiceScreen';
import { STAGE_BACKDROP, TITLE_ART } from './ui/components/enemySprites';
import { showLoadout } from './ui/LoadoutScreen';
import { showMap } from './ui/MapView';
import { showAltar, showCodex, showPrep } from './ui/MetaScreens';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
const meta: MetaState = loadMeta();
let run: RunState = createRun(undefined, meta);
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
  let changed = false;
  for (const id of [...Object.values(run.slots), ...run.inventory]) if (id) changed = discoverSkill(meta, id) || changed;
  for (const r of run.relics) changed = discoverRelic(meta, r.id) || changed;
  if (changed) saveMeta(meta);
}

/** 冒険の終了処理: 魂片を獲得して保存する。獲得量を返す。 */
function endRun(cleared: boolean): number {
  syncCodex();
  const summary: RunSummary = { maxRow: run.stats.maxRow, enemiesDefeated: run.stats.enemiesDefeated, cleared };
  const gained = finishRun(meta, summary);
  saveMeta(meta);
  return gained;
}

/** 出撃: 初期スキルを選べるなら出撃準備画面を挟み、冒険を始める。 */
function startAdventure(): void {
  const begin = () => {
    run = createRun(undefined, meta);
    showMapScreen();
  };
  if (selectableStartingSkills(meta).length > 0 && startingCapacity(meta) > 0) showPrep(root, meta, begin, showTitle);
  else begin();
}

function restartRun(): void {
  startAdventure();
}

/** 戦闘終了時のオーバーレイ。敗北でやり直し、勝利で報酬スキルの選択へ進む。 */
function buildResult(machine: BattleMachine, tile: TileDef, won: boolean): HTMLElement {
  const box = el('div', 'result');
  box.append(el('h1', `overlay__title overlay__title--${won ? 'win' : 'lose'}`,
    won ? '勝　利<small>VICTORY</small>' : '敗　北<small>DEFEAT</small>'));

  const shardsLine = (gained: number) =>
    el('p', 'result__line result__shards', `魂片 +${gained}（所持 ${meta.shards}）`);
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
    sub: 'ひとつ選び、スロットにセットする',
    options: ids.map((id) => ({ rarity: rarityOfSkill(getSkill(id)), icon: getSkill(id).icon, name: getSkill(id).name, description: describeSkill(getSkill(id), run.baseAttack) })),
    onPick(i) {
      run.inventory.push(ids[i]);
      syncCodex();
      showLoadout(root, run, { armed: ids[i], onClose: () => showMapScreen() });
    },
  });
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  const screen = el('main', 'title');
  const art = el('div', 'enemy-stage title-stage');
  art.append(el('div', 'enemy-backdrop', STAGE_BACKDROP), el('div', 'title-art', TITLE_ART));
  const h1 = el('h1', '', 'BLACKJACK<small>ROGUELIKE</small>');
  const sub = el('p', '', '二十一に近き者が先を制す。分かれ道を選び、地下墓所の主を討て。');
  const start = el('button', 'btn btn--hit title__start', '<span class="btn__main">冒険を始める</span>');
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startAdventure();
  });
  const sub2 = el('div', 'title__sub');
  const altar = el('button', 'btn btn--stand', `<span class="btn__main">魂の祭壇</span><span class="btn__sub">魂片 ${meta.shards}</span>`);
  altar.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    showAltar(root, meta, showTitle);
  });
  const codex = el('button', 'btn btn--stand', '<span class="btn__main">図鑑</span><span class="btn__sub">入手の記録</span>');
  codex.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    showCodex(root, meta, showTitle);
  });
  sub2.append(altar, codex);
  screen.append(art, h1, sub, start, sub2);
  root.replaceChildren(screen);
}

showTitle();
