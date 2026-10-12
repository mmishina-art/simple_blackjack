import type { BattleContext } from '../core/battle/BattleContext';
import { bustPenaltyText } from '../core/rules/bust';

export interface TurnBanner {
  main: string;
  sub?: string;
}

/**
 * 行動順の発表（敵の舞台に短く出す帯）。ログ欄を常時は出さない代わりに、
 * 「だれが先に動くか・なぜか」だけは、毎ラウンド画面の見やすい所に出す。
 * 伏せカードがめくられたあとにだけ呼ぶこと（合計値を使うため）。
 */
export function turnBanner(ctx: Pick<BattleContext, 'turn' | 'player' | 'enemy' | 'rules' | 'entityOf'>): TurnBanner | null {
  const { turn, player, enemy, rules } = ctx;
  if (!turn) return null;
  const totalOf = (id: 'player' | 'enemy') => ctx.entityOf(id).hand.total(rules);
  switch (turn.mode) {
    case 'sequential': {
      const first = turn.first!;
      const second = turn.second!;
      return { main: `${ctx.entityOf(first).name}が先攻`, sub: `${totalOf(first)} ＞ ${totalOf(second)}` };
    }
    case 'simultaneous':
      return { main: '同値！ 同時に行動', sub: `${totalOf('player')} ＝ ${totalOf('enemy')}` };
    case 'bustSkip': {
      const bust = turn.first === 'player' ? enemy : player;
      return { main: `${bust.name}はバースト！`, sub: bustPenaltyText(rules) };
    }
    case 'defend':
      return { main: '防御に徹する', sub: `${enemy.name}だけが行動` };
    case 'none':
      return { main: '誰も行動しない' };
  }
}
