import { describe, expect, it } from 'vitest';
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { Slime } from '../src/core/entities/enemies/Slime';
import { turnBanner } from '../src/ui/turnBanner';
import { playRound } from './helpers';

/** 指定した手札でラウンドの後半を実行し、行動順の帯を作る。 */
async function bannerFor(player: Parameters<typeof playRound>[0]['player'], enemyHand: Parameters<typeof playRound>[0]['enemyHand'], extra: Partial<Parameters<typeof playRound>[0]> = {}) {
  const m: BattleMachine = await playRound({ player, enemyHand, enemyHp: 99, ...extra });
  return turnBanner(m.ctx);
}

describe('行動順の帯（ログ欄の代わりに、敵の舞台へ出す）', () => {
  it('合計値の大きい方が先攻: 先攻の名前と、合計値の比較を出す', async () => {
    expect(await bannerFor(['K', 'K'], ['9', '9'])).toEqual({ main: 'あなたが先攻', sub: '20 ＞ 18' });
    expect(await bannerFor(['9', '8'], ['K', 'Q'])).toEqual({ main: `${Slime.name}が先攻`, sub: '20 ＞ 17' });
  });

  it('同値は同時に行動する', async () => {
    expect(await bannerFor(['K', 'K'], ['K', 'Q'])).toEqual({ main: '同値！ 同時に行動', sub: '20 ＝ 20' });
  });

  it('バースト: だれがバーストしたかと、不利の内容を出す', async () => {
    expect(await bannerFor(['K', 'Q', '5'], ['9', '9'])).toEqual({ main: 'あなたはバースト！', sub: 'スキル不発・受けるダメージ1.5倍' });
    expect(await bannerFor(['K', 'K'], ['K', 'Q', '5'])).toEqual({ main: `${Slime.name}はバースト！`, sub: 'スキル不発・受けるダメージ1.5倍' });
  });

  it('両者バーストは、だれも行動しない', async () => {
    expect(await bannerFor(['K', 'Q', '5'], ['K', 'Q', '4'])).toEqual({ main: '誰も行動しない' });
  });

  it('撤退（防御）: 敵だけが行動する', async () => {
    expect(await bannerFor(['K', '5'], ['9', '9'], { from: 'Surrender' })).toEqual({ main: '防御に徹する', sub: `${Slime.name}だけが行動` });
  });

  it('行動順がまだ決まっていないときは何も出さない', () => {
    const m = new BattleMachine({ enemy: Slime });
    expect(turnBanner(m.ctx)).toBeNull();
  });
});
