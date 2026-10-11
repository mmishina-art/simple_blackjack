import { audio } from './audio/AudioManager';
import { bindBattleSounds } from './audio/bindBattleSounds';
import { BattleMachine } from './core/battle/BattleMachine';
import { Slime } from './core/entities/enemies/Slime';
import { BattleView } from './ui/BattleView';
import { EnemyView } from './ui/components/EnemyView';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
let view: BattleView | null = null;
let unbindSounds: (() => void) | null = null;

function startBattle(): void {
  view?.destroy();
  unbindSounds?.();
  const machine = new BattleMachine({ enemy: Slime, playerMaxHp: 50 });
  unbindSounds = bindBattleSounds(machine, audio);
  view = new BattleView(root, machine, startBattle);
  void machine.run();
}

/** タイトル画面。音声はユーザー操作後でないと鳴らせないため、ここでタップさせる。 */
function showTitle(): void {
  const screen = document.createElement('main');
  screen.className = 'title';
  const enemy = new EnemyView(Slime.id);
  const h1 = document.createElement('h1');
  h1.textContent = 'BLACKJACK ROGUELIKE';
  const sub = document.createElement('p');
  sub.textContent = '21に近い方が勝ち。勝敗でHPを削り合え。';
  const start = document.createElement('button');
  start.className = 'btn btn--hit title__start';
  start.textContent = 'バトル開始';
  start.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('click');
    startBattle();
  });
  screen.append(enemy.el, h1, sub, start);
  root.replaceChildren(screen);
}

showTitle();
