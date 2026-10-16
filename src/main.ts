import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { getEnemy } from './core/entities/enemies/catalog';
import { discoverEnemy, discoverRelic, discoverSkill, finishRun, loadMeta, saveMeta, type MetaState, type RunSummary } from './meta/Meta';
import { describeSkillBonus, getSkill, KIND_LABEL, kindOfSkill, placementNote, rarityOfSkill } from './core/skills/Skill';
import { defaultRng } from './core/util/Rng';
import { useInn } from './map/events';
import type { TileDef } from './map/StageMap';
import {
  advanceStage, armorCap, STAGE_CLEAR_MAX_HP, createRun, debugMoveTo, enemyOfTile, hasMergeTarget, isCleared, isFinalStage, markCleared, moveTo, offerRelics, offerSkills, reachableTiles, type RunState,
} from './run/Run';
import { BattleView } from './ui/BattleView';
import { showChoiceScreen, showNotice } from './ui/ChoiceScreen';
import { backdropHtml, titleArtHtml } from './ui/components/art';
import { createInstallEntry } from './ui/InstallGuide';
import { POUCH_SIZE } from './run/loadout';
import { showLoadout } from './ui/LoadoutScreen';
import { showMap } from './ui/MapView';
import { openSheet } from './ui/components/SkillSheet';
import { addGold, generateShop, rewardGold, rewardGoldChoice, MAX_GOLD, type ShopOffer } from './run/shop';
import { isDebug } from './debug';
import { showShop } from './ui/ShopScreen';
import { showInn } from './ui/InnScreen';
import { showShrine } from './ui/ShrineScreen';
import { showSettings } from './ui/SettingsScreen';
import { showEnding } from './ui/EndingScreen';
import { setupUpdateBanner } from './ui/UpdateBanner';
import { showAltar, showCodex } from './ui/MetaScreens';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
const meta: MetaState = loadMeta();
let run: RunState = createRun(undefined, meta);
/** 素の状態で挑んでいる冒険か（祭壇の強化・図鑑の効果を使わず、魂片・図鑑も記録しない）。 */
let bareRun = false;
/** デバッグの操作（ゴールド最大・即勝利）を使った冒険。記録（魂片・図鑑・戦績）を残さない。 */
let cheated = false;
let machineNow: BattleMachine | null = null;
let view: BattleView | null = null;
let unbindSounds: (() => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

/** 結果画面などのボタン。primary = 先へ進む主な操作（金）、なし = ふつうの操作（灰青）。 */
function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', `btn ${primary ? 'btn--primary' : 'btn--retry'}`, `<span class="btn__main">${label}</span>`);
  b.addEventListener('click', () => {
    audio.sfx('click');
    onClick();
  });
  return b;
}

/** 冒険の画面かどうか（デバッグの操作を出すか）。HP とゴールドは、必要な画面の中にだけ出す（画面の上端には出さない: iPhone の上端はぼやけるため）。 */
function setStatus(visible: boolean): void {
  debugPanel.hidden = !(visible && isDebug());
}

/** デバッグモード中だけ、冒険の画面の左上に出る操作。使った冒険は、記録を残さない。 */
const debugPanel = el('div', 'debug-panel');
debugPanel.hidden = true;
{
  const mk = (label: string, title: string, onClick: () => void): void => {
    const b = el('button', 'debug-panel__btn', label);
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', () => {
      cheated = true;
      onClick();
      if (root.querySelector('.map-screen')) showMapScreen(); // 地図に出ているゴールドを更新する
    });
    debugPanel.append(b);
  };
  mk('G', `ゴールドを最大（${MAX_GOLD}）にする`, () => { run.gold = MAX_GOLD; });
  mk('勝', 'いまの戦闘にすぐ勝つ', () => machineNow?.debugWin());
}
document.body.append(debugPanel);
function leaveBattle(): void {
  machineNow = null;
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
    onMove: (id) => {
      const isReachable = reachableTiles(run).some((t) => t.id === id);
      if (!isReachable && isDebug()) cheated = true;
      const tile = !isReachable && isDebug() ? debugMoveTo(run, id) : moveTo(run, id);
      resolveTile(tile);
    },
    onLoadout: () => showLoadout(root, run, { onClose: (msg) => showMapScreen(msg ?? message) }),
    onGiveUp: () => { leaveBattle(); showTitle(); }, // 魂片は入らない（endRun を呼ばない）
  }, message);
}

/** ショップの品揃え（マスごと。出入りしても変わらない）。 */
const shopOffers = new Map<string, ShopOffer[]>();

/** ショップ。スキル・道具・防具を買うと、装備画面で置き先（スロット / 道具袋）を決める。 */
function openShop(tile: TileDef, offers: ShopOffer[], note = ''): void {
  showShop(root, run, {
    offers, note,
    onBought: (offer) => showLoadout(root, run, {
      armed: offer.id, mode: 'shop',
      undo() {
        const i = run.inventory.indexOf(offer.id);
        if (i >= 0) run.inventory.splice(i, 1);
        addGold(run, offer.price);
        offer.sold = false;
      },
      onClose: (msg) => openShop(tile, offers, msg ?? ''),
    }),
    onLeave: () => { markCleared(run, tile.id); showMapScreen(); },
  });
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
        scene: { kind: 'chest', line: '遺物をひとつ選べ。' },
        options: relics.map((r) => ({ ...r, relic: true })),
        onPick(i) {
          run.relics.push(relics[i]);
          showMapScreen(`「${relics[i].name}」を手に入れた。`);
        },
      });
    }
    case 'inn': {
      const before = run.hp;
      useInn(run);
      markCleared(run, tile.id);
      return showInn(root, { before, after: run.hp, max: run.maxHp, onClose: () => showMapScreen() });
    }
    case 'shrine': {
      return showShrine(root, run, {
        rng: defaultRng,
        onDone: (message) => {
          markCleared(run, tile.id);
          // 祈りでスキルを授かって、道具袋がいっぱいなら、置き先（スロット / 道具袋 / 売る）を決める
          if (run.inventory.length > POUCH_SIZE) return showLoadout(root, run, { armed: run.inventory[run.inventory.length - 1], onClose: (msg) => showMapScreen(msg ?? message) });
          showMapScreen(message);
        },
        onLeave: () => showMapScreen(),
      });
    }
    case 'shop': {
      let offers = shopOffers.get(tile.id);
      if (!offers) shopOffers.set(tile.id, (offers = generateShop(run, defaultRng)));
      return openShop(tile, offers);
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
    playerBlock: run.bonus.startBlock,
    playerAttack: run.baseAttack,
    relics: run.relics,
  });
  machineNow = machine;
  unbindSounds = bindBattleSounds(machine, audio);
  view = new BattleView(root, machine, run, (won) => buildResult(machine, tile, won));
  void machine.run();
}

/** 持っているスキル・レリックを図鑑に登録する（負けても残る）。 */
function syncCodex(): void {
  if (bareRun || cheated) return; // 素の状態・デバッグを使った冒険は、図鑑に記録しない
  let changed = false;
  for (const id of [...Object.values(run.slots), run.armor, ...run.inventory]) if (id) changed = discoverSkill(meta, id) || changed;
  for (const r of run.relics) changed = discoverRelic(meta, r.id) || changed;
  if (changed) saveMeta(meta);
}

/** 冒険の終了処理: 魂片を獲得して保存する。獲得量を返す。 */
function endRun(cleared: boolean): number {
  if (bareRun || cheated) return 0; // 魂片・戦績も記録しない
  syncCodex();
  const summary: RunSummary = { maxRow: run.stats.maxRow, enemiesDefeated: run.stats.enemiesDefeated, cleared, stagesCleared: run.stage - 1 };
  const gained = finishRun(meta, summary);
  saveMeta(meta);
  return gained;
}

/** 冒険を始める。装備は出撃準備で決めた保存済みの設定が使われる。 */
function startAdventure(): void {
  bareRun = false;
  cheated = false;
  shopOffers.clear();
  run = createRun(undefined, meta);
  setStatus(true);
  showMapScreen();
}

/** 素の状態で冒険を始める: 祭壇の強化・図鑑・出撃準備の変更を使わず、記録も残さない（バランスを試すため）。 */
function startBareAdventure(): void {
  bareRun = true;
  cheated = false;
  shopOffers.clear();
  run = createRun();
  setStatus(true);
  showMapScreen('素の状態で出発した（祭壇の強化は使わず、記録も残らない）');
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
    el('p', 'result__line result__shards', cheated ? 'デバッグを使った冒険（魂片・図鑑は記録されない）' : bareRun ? '素の状態の冒険（魂片・図鑑は記録されない）' : `魂片 +${gained}（所持 ${meta.shards}）`);
  const endButtons = (retry: string) => {
    const altar = button('魂の祭壇', () => { setStatus(false); showAltar(root, meta, showTitle); });
    altar.classList.replace('btn--retry', 'btn--stand');
    return [altar, button(retry, restartRun, true)];
  };

  if (!won) {
    box.append(shardsLine(endRun(false)), ...endButtons('もう一度'));
    return box;
  }

  run.hp = machine.ctx.player.hp;
  run.maxHp = machine.ctx.player.maxHp; // 凱旋の杯で増えた最大 HP を引き継ぐ
  run.stats.enemiesDefeated++;
  if (!bareRun && !cheated && tile.enemyId) {
    if (discoverEnemy(meta, tile.enemyId)) saveMeta(meta); // モンスター図鑑に載る
    if (!(run.knownEnemies ??= []).includes(tile.enemyId)) run.knownEnemies.push(tile.enemyId);
  }
  markCleared(run, tile.id);
  // ゴールドが自動で入るのはボスだけ。ふつうの敵は、次の画面で「スキル」か「ゴールド」を選ぶ
  if (tile.kind === 'boss') {
    const gold = rewardGold(run, enemyOfTile(tile), true);
    addGold(run, gold);
    box.append(el('p', 'result__line result__gold', `ゴールド +${gold}（所持 ${run.gold} G）`));
  }

  if (tile.kind === 'boss' && !isFinalStage(run)) {
    box.append(el('p', 'result__line', `「${run.map.name}」を踏破した！`), button('次の階層へ', offerStageRelic, true));
    return box;
  }
  if (tile.kind === 'boss') {
    // 最後の階層のボスを倒した: 魂片を記録して、エンディングへ。エンディングが終わると、タイトルに戻る
    const gained = endRun(true);
    box.append(el('p', 'result__line', `「${run.map.name}」を踏破した！`), button('エンディングへ', () => {
      setStatus(false);
      showEnding(root, { gained, shards: meta.shards, enemiesDefeated: run.stats.enemiesDefeated, relics: run.relics.length, bare: bareRun || cheated }, showTitle);
    }, true));
    return box;
  }
  box.append(button('次へ', () => offerSkillReward(tile.enemyId), true));
  return box;
}

/** 階層を踏破した報酬: 遺物を3択で獲得し、HP が回復して、次の階層へ進む。 */
function offerStageRelic(): void {
  const relics = offerRelics(run, defaultRng);
  const enter = (): void => {
    const before = run.hp;
    advanceStage(run);
    shopOffers.clear();
    showMapScreen(`第${run.stage}階層「${run.map.name}」へ。最大 HP +${STAGE_CLEAR_MAX_HP}、HP が ${run.hp - before} 回復した。`);
  };
  if (relics.length === 0) return enter();
  showChoiceScreen(root, {
    heading: '階層を踏破した',
    sub: '遺物をひとつ選べ',
    scene: { kind: 'chest', title: '踏破の褒美', line: '遺物をひとつ選べ。' },
    options: relics.map((r) => ({ ...r, relic: true })),
    onPick(i) {
      run.relics.push(relics[i]);
      enter();
    },
  });
}

/**
 * 敵を倒した報酬: スキル 3 つと「ゴールドを受け取る」から、1 つを選ぶ（スキルかゴールドの二択）。
 * スキルを選んだら装備画面でセットする。置き場所を決めて確定するまでは「戻る」で、この画面に戻って選び直せる（同じ候補のまま）。
 */
function offerSkillReward(enemyId?: string, offered?: string[]): void {
  const ids = offered ?? offerSkills(defaultRng, run, enemyId);
  const def = enemyId ? getEnemy(enemyId) : null;
  const gold = def ? rewardGoldChoice(run, def) : 0;
  const dropFrom = def ? def.name : '';
  showChoiceScreen(root, {
    heading: 'ごほうび',
    sub: `${dropFrom ? `${dropFrom}の落とし物。` : ''}スキルかゴールドを、ひとつ選ぶ`,
    scene: { kind: 'reward', title: 'ごほうび', line: `${dropFrom ? `${dropFrom}の落とし物。` : ''}スキルか、ゴールドか。ひとつ選べ。` },
    options: [
      ...ids.map((id) => ({ rarity: rarityOfSkill(getSkill(id)), icon: getSkill(id).icon, name: getSkill(id).name, description: `${describeSkillBonus(getSkill(id))}${placementNote(getSkill(id)) ? `（${placementNote(getSkill(id))}）` : ''}${hasMergeTarget(run, id) ? '・装備中と合成で＋' : ''}`, tag: KIND_LABEL[kindOfSkill(getSkill(id))], kind: kindOfSkill(getSkill(id)) })),
      ...(gold > 0 ? [{ gold: true, icon: '金', name: `ゴールド +${gold} G`, description: `スキルの代わりに、ゴールドを受け取る（所持 ${run.gold} G）`, tone: 'b' as const }] : []),
    ],
    onPick(i) {
      if (i >= ids.length) {
        addGold(run, gold);
        showMapScreen(`ゴールド +${gold}（所持 ${run.gold} G）`);
        return;
      }
      const id = ids[i];
      run.inventory.push(id);
      showLoadout(root, run, {
        armed: id,
        // 確定する前なら、選び直せる（持ち物から外して、同じ候補の画面に戻る）
        onBack: () => {
          const at = run.inventory.lastIndexOf(id);
          if (at >= 0) run.inventory.splice(at, 1);
          offerSkillReward(enemyId, ids);
        },
        onClose: (msg) => {
          syncCodex();
          if (!bareRun && !cheated && discoverSkill(meta, id)) saveMeta(meta); // 売ったときも、手に入れたものとして図鑑に載せる
          showMapScreen(msg);
        },
      });
    },
  });
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  setStatus(false);
  const screen = el('main', 'title');
  const art = el('div', 'enemy-stage title-stage');
  const back = backdropHtml(1);
  art.append(el('div', `enemy-backdrop${back.image ? ' enemy-backdrop--image' : ''}`, back.html), el('div', 'title-art', titleArtHtml()));
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
  // 題名「Bust or Die」（バーストか、死か）。下の小さな英字は、どんなゲームかの説明（ジャンル）
  const h1 = el('h1', 'logo', '<span class="logo__main">BUST <span class="logo__or">or</span> <span class="logo__die">DIE</span></span><small class="logo__genre">BLACKJACK ROGUELIKE</small>');
  const sub = el('p', '', '二十一に近き者が先を制す。三つの階層を越え、竜の巣の主を討て。');
  const start = el('button', 'btn btn--primary title__start', '<span class="btn__main">冒険を始める</span>');
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startAdventure();
  });
  const sub2 = el('div', 'title__sub');
  const unlock = () => {
    audio.unlock();
    audio.sfx('click');
  };
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
  sub2.append(altar, codex);
  const bare = el('button', 'title__reset', '素の状態で挑む');
  bare.addEventListener('click', () => {
    unlock();
    openSheet({
      title: '素の状態で挑む？',
      subtitle: '祭壇の強化・図鑑の効果を使わずに始める。この冒険では魂片も図鑑も記録されない（いまの記録は消えない）',
      options: [{
        kind: 'confirm', icon: '素', name: '素の状態で始める', detail: 'HP 30・初期装備・鉄の盾で出発',
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
  links.append(bare, settings);
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
