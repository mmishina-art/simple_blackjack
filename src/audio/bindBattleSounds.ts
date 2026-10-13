import type { BattleMachine } from '../core/battle/BattleMachine';
import type { AudioManager } from './AudioManager';

/** バトルのイベントフックに SE を結びつける。Core は音を一切知らない。 */
export function bindBattleSounds(machine: BattleMachine, audio: AudioManager): () => void {
  const { bus } = machine;
  const offs = [
    // 配る・引く音。同じ音が続かないよう、AudioManager が毎回少しだけ変える
    bus.on('onCardDrawn', () => audio.sfx('deal')),
    // 敵は最後の1枚を伏せて引くので、敵のバースト音はその場では鳴らさず、カードがめくられた行動順の発表で鳴らす
    bus.on('onBust', ({ entity }) => {
      if (entity.id === 'player') audio.sfx('bust');
    }),
    bus.on('onInitiativeDecided', ({ enemyBust }) => {
      if (enemyBust) audio.sfx('bust');
    }),
    bus.on('onDamageDealt', ({ defender, hpLoss, absorbed, broken }) => {
      if (broken) audio.sfx('break', 0.06); // 会心の一撃がブロックを破壊した（攻撃・ダメージの音に重ねる）
      if (hpLoss === 0 && absorbed > 0) audio.sfx('guard');
      else if (defender.id === 'enemy') audio.sfx('attack');
      else audio.sfx('damage');
    }),
    // ブロック・回復の音は「実際に起きたとき」の通知で鳴らす（onBlockGained / onHealed は予測表示のたびにも発火する）
    bus.on('onBlockApplied', () => audio.sfx('block')),
    bus.on('onHealApplied', () => audio.sfx('heal')),
    bus.on('onCardsRevealed', () => audio.sfx('flip')),
    bus.on('onBattleEnd', ({ winner }) => audio.sfx(winner.id === 'player' ? 'victory' : 'defeat', 0.7)),
  ];
  return () => offs.forEach((off) => off());
}
