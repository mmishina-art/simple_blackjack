import { BattleMachine } from './core/battle/BattleMachine';
import { Slime } from './core/entities/enemies/Slime';
import { BattleView } from './ui/BattleView';
import './ui/styles/main.css';

const root = document.getElementById('app')!;
let view: BattleView | null = null;

function startBattle(): void {
  view?.destroy();
  const machine = new BattleMachine({ enemy: Slime, playerMaxHp: 50 });
  view = new BattleView(root, machine, startBattle);
  void machine.run();
}

startBattle();
