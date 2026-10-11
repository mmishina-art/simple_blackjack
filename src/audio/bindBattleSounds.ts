import type { BattleMachine } from '../core/battle/BattleMachine';
import type { AudioManager } from './AudioManager';

/** バトルのイベントフックに SE を結びつける。Core は音を一切知らない。 */
export function bindBattleSounds(machine: BattleMachine, audio: AudioManager): () => void {
  const { bus } = machine;
  const offs = [
    bus.on('onCardDrawn', () => audio.sfx('deal')),
    bus.on('onBust', () => audio.sfx('bust')),
    bus.on('onResolve', ({ result, damage, defender }) => {
      if (!defender || damage <= 0) audio.sfx('push');
      else if (defender.id === 'enemy') {
        audio.sfx(result.outcome === 'playerWin' && result.playerBlackjack ? 'blackjack' : 'attack');
      } else audio.sfx('damage');
    }),
    bus.on('onBattleEnd', ({ winner }) => audio.sfx(winner.id === 'player' ? 'victory' : 'defeat', 0.7)),
  ];
  return () => offs.forEach((off) => off());
}
