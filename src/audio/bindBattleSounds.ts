import type { BattleMachine } from '../core/battle/BattleMachine';
import type { AudioManager } from './AudioManager';

/** バトルのイベントフックに SE を結びつける。Core は音を一切知らない。 */
export function bindBattleSounds(machine: BattleMachine, audio: AudioManager): () => void {
  const { bus } = machine;
  const offs = [
    bus.on('onCardDrawn', () => audio.sfx('deal')),
    bus.on('onBust', () => audio.sfx('bust')),
    bus.on('onResolve', ({ result, damage }) => {
      if (result.outcome === 'push') audio.sfx('push');
      else if (result.outcome === 'playerWin') {
        audio.sfx(result.playerBlackjack && damage > 0 ? 'blackjack' : 'attack');
      } else audio.sfx('damage');
    }),
    bus.on('onBattleEnd', ({ winner }) => audio.sfx(winner.id === 'player' ? 'victory' : 'defeat', 0.7)),
  ];
  return () => offs.forEach((off) => off());
}
