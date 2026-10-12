import type { BattleMachine } from '../core/battle/BattleMachine';
import type { AudioManager } from './AudioManager';

/** バトルのイベントフックに SE を結びつける。Core は音を一切知らない。 */
export function bindBattleSounds(machine: BattleMachine, audio: AudioManager): () => void {
  const { bus } = machine;
  const offs = [
    bus.on('onCardDrawn', () => audio.sfx('deal')),
    // 敵は最後の1枚を伏せて引くので、敵のバースト音はその場では鳴らさず、カードがめくられた行動順の発表で鳴らす
    bus.on('onBust', ({ entity }) => {
      if (entity.id === 'player') audio.sfx('bust');
    }),
    bus.on('onInitiativeDecided', ({ enemyBust }) => {
      if (enemyBust) audio.sfx('bust');
    }),
    bus.on('onDamageDealt', ({ defender, hpLoss, absorbed }) => {
      if (hpLoss === 0 && absorbed > 0) audio.sfx('guard');
      else if (defender.id === 'enemy') audio.sfx('attack');
      else audio.sfx('damage');
    }),
    bus.on('onBlockGained', () => audio.sfx('guard')),
    bus.on('onHealed', () => audio.sfx('heal')),
    bus.on('onBattleEnd', ({ winner }) => audio.sfx(winner.id === 'player' ? 'victory' : 'defeat', 0.7)),
  ];
  return () => offs.forEach((off) => off());
}
