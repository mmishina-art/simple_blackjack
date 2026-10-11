import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { ENEMY_LINEUP } from './core/entities/enemies/catalog';
import { defaultRng } from './core/util/Rng';
import {
  applyVictory, battleRelics, createRun, currentEnemy, expForNextLevel, isLastStage,
  offerPerks, offerRelics, type RunState, type VictoryResult,
} from './run/Run';
import { BattleView } from './ui/BattleView';
import { showChoiceScreen } from './ui/ChoiceScreen';
import { EnemyView } from './ui/components/EnemyView';
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

/** 現在のステージのバトルを開始する。 */
function startBattle(): void {
  view?.destroy();
  unbindSounds?.();
  const machine = new BattleMachine({
    enemy: currentEnemy(run),
    playerMaxHp: run.maxHp,
    playerHp: run.hp,
    relics: battleRelics(run),
  });
  unbindSounds = bindBattleSounds(machine, audio);
  view = new BattleView(root, machine, run, (won) => buildResult(machine, won));
  void machine.run();
}

function restartRun(): void {
  run = createRun();
  startBattle();
}

/** 戦闘終了時のオーバーレイ。勝敗に応じて次の画面へ進む導線を持つ。 */
function buildResult(machine: BattleMachine, won: boolean): HTMLElement {
  const box = el('div', 'result');
  const title = el('h1', `overlay__title overlay__title--${won ? 'win' : 'lose'}`,
    won ? '勝　利<small>VICTORY</small>' : '敗　北<small>DEFEAT</small>');
  box.append(title);

  if (!won) {
    box.append(
      el('p', 'result__line', `到達: STAGE ${run.stage + 1} / ${ENEMY_LINEUP.length}　Lv ${run.level}`),
      button('最初からやり直す', restartRun),
    );
    return box;
  }

  run.hp = machine.ctx.player.hp;
  const enemy = currentEnemy(run);
  const levelBefore = run.level;
  const victory = applyVictory(run, enemy);

  if (isLastStage(run)) {
    box.append(
      el('p', 'result__line', `全${ENEMY_LINEUP.length}戦を制覇した！　最終 Lv ${run.level}`),
      button('もう一度挑む', restartRun),
    );
    return box;
  }

  box.append(...victoryLines(victory, levelBefore));
  box.append(button('次へ', () => afterVictory(victory.levelsGained)));
  return box;
}

function victoryLines(v: VictoryResult, levelBefore: number): HTMLElement[] {
  const next = expForNextLevel(run.level);
  const lines = [el('p', 'result__line', `経験値 +${v.gainedExp}`)];
  if (v.healed > 0) lines.push(el('p', 'result__line', `休息で HP +${v.healed}`));
  if (v.levelsGained > 0) {
    lines.push(el('p', 'result__levelup', `LEVEL UP!　Lv ${levelBefore} → Lv ${run.level}`));
    audio.sfx('levelup', 0.9);
  } else if (next !== null) {
    lines.push(el('p', 'result__line', `次のレベルまで あと ${next - run.exp}`));
  }
  return lines;
}

/** 勝利後: レベルアップ強化（レベル分）→ 報酬レリック → 次のバトル。 */
function afterVictory(levelUps: number): void {
  if (levelUps > 0) return offerPerkChoice(levelUps);
  offerRelicChoice();
}

function offerPerkChoice(remaining: number): void {
  const perks = offerPerks(defaultRng);
  showChoiceScreen(root, {
    heading: 'LEVEL UP',
    sub: `Lv ${run.level}　力を一つ選べ`,
    options: perks,
    onPick(i) {
      perks[i].apply(run);
      if (remaining > 1) offerPerkChoice(remaining - 1);
      else offerRelicChoice();
    },
  });
}

function offerRelicChoice(): void {
  const relics = offerRelics(run, defaultRng);
  const next = () => {
    run.stage++;
    startBattle();
  };
  if (relics.length === 0) return next();
  showChoiceScreen(root, {
    heading: '遺物',
    sub: 'ひとつだけ持っていける',
    options: relics,
    onPick(i) {
      run.relics.push(relics[i]);
      next();
    },
  });
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  const screen = el('main', 'title');
  const enemy = new EnemyView(ENEMY_LINEUP[0].id);
  const h1 = el('h1', '', 'BLACKJACK<small>ROGUELIKE</small>');
  const sub = el('p', '', `二十一に近き者が勝つ。全${ENEMY_LINEUP.length}戦、生き延びよ。`);
  const start = el('button', 'btn btn--hit title__start', '<span class="btn__main">冒険を始める</span>');
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startBattle();
  });
  screen.append(enemy.el, h1, sub, start);
  root.replaceChildren(screen);
}

showTitle();
