// 全体バランスのシミュレーション: 1回の冒険（地図・戦闘・報酬・宿屋・祠・宝箱）を、そこそこ賢いボットで通しで遊ぶ。
// 使い方: npx vite-node tools/sim-balance.ts [回数=600] [バースト許容率=0.45]
// 環境変数: PATH_MODE=random（道をランダムに。省略時は宝箱・祠・宿屋を優先）/ PLAYER_HP / ENEMY_SCALE / START_ARMOR / HERB / HERB_SLOT / RELIC / RELIC_STAGE（N 階層の頭からそのレリックを持つ。省略時は最初から） / DEF_MODE=boss
// ボットは「次のカードのバースト確率が許容率未満なら Hit」「HP が敵の LV 以下、または敵の札から危険に入る確率が FATAL_RISK 以上なら防御（BUST or DIE の予告が出ていれば、21 の確率が OMEN_RISK 以上なら防御）」「回復スキルのスロットで HP が半分以下なら Stand」。実際の人間は、敵の札を見て判断できるので、これより上がる想定。
import { BattleMachine } from '../src/core/battle/BattleMachine';
import { drawOdds } from '../src/core/cards/odds';
import { Hand } from '../src/core/cards/Hand';
import { enemyLevel } from '../src/core/entities/enemies/level';
import { slotAttack } from '../src/core/skills/catalog';
import { attackValue, canPlaceAt, getSkill, isArmor, slotKeyOf, supportValue, type SkillId } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { resolveShrine, useInn } from '../src/map/events';
import { upgradeCost, buyOffer, rewardGold, generateShop, sellFromInventory } from '../src/run/shop';
import { emptyMeta } from '../src/meta/Meta';
import { advanceStage, armorCap, canUpgradeSlot, createRun, isFinalStage, enemyOfTile, equipArmor, equipSkill, markCleared, moveTo, offerRelics, offerSkills, reachableTiles, shrineUpgradeChoices, upgradeSlot, type RunState } from '../src/run/Run';

const N = Number(process.argv[2] ?? 600);
const RISK = Number(process.argv[3] ?? 0.45);
const SMART_PATH = process.env.PATH_MODE !== 'random';
/** 敵の危険に入る確率がこれ以上なら防御する（FATAL_RISK=1 で、敵の札を読まない昔のボット）。 */
const FATAL_RISK = Number(process.env.FATAL_RISK ?? 0.4);

/**
 * 敵の見えている札から、敵の最終の合計値が危険のスロットに入る確率。
 * 伏せ札は「まだ見えていないカード」のどれか。敵は見えている札で standOn 未満だったので引いた、と考え、
 * 引いたあとに standOn 以上（バースト含む）になるカードだけを数える。
 */
function fatalChance(m: BattleMachine, standOn: number): number {
  const { enemy, deck, rules } = m.ctx;
  const visible = enemy.hand.cards.filter((c) => !enemy.hand.isFaceDown(c));
  const unseen = [...deck.contents, ...enemy.hand.cards.filter((c) => enemy.hand.isFaceDown(c))];
  let n = 0, fatal = 0;
  for (const c of unseen) {
    const t = Hand.totalOf([...visible, c], rules);
    if (t < standOn) continue;
    n++;
    if (t <= rules.bustLimit && getSkill(enemy.slots[t] ?? enemy.fallbackSkill).fatal) fatal++;
  }
  return n === 0 ? 0 : fatal / n;
}

/** 「BUST or DIE」の予告が出ているとき、敵の手がバーストではなく 21 である確率（見えている札から読む）。 */
const OMEN_RISK = Number(process.env.OMEN_RISK ?? 0.35);
function chance21(m: BattleMachine): number {
  const { enemy, deck, rules } = m.ctx;
  const visible = enemy.hand.cards.filter((c) => !enemy.hand.isFaceDown(c));
  const unseen = [...deck.contents, ...enemy.hand.cards.filter((c) => enemy.hand.isFaceDown(c))];
  let n = 0, hit = 0;
  for (const c of unseen) {
    const t = Hand.totalOf([...visible, c], rules);
    if (t < rules.blackjackScore) continue;
    n++;
    if (t === rules.blackjackScore) hit++;
  }
  return n === 0 ? 0 : hit / n;
}

/** そのスロットに置いたときの価値（ざっくり）。 */
function slotValue(id: SkillId | undefined, key: number, run: RunState, hpRatio: number): number {
  const sk = getSkill(id ?? run.fallbackSkill);
  let v = 0;
  for (const e of sk.effects) {
    if (e.type === 'attack') v += attackValue(e, slotAttack(run.baseAttack, key)) * (e.pierce ? 1.1 : 1);
    else if (e.type === 'block') v += supportValue(e, slotAttack(run.baseAttack, key)) * 0.7;
    else v += supportValue(e, slotAttack(run.baseAttack, key)) * (hpRatio < 0.6 ? 1.0 : 0.5);
  }
  return v;
}
const WEIGHT: Record<number, number> = { 12: 3, 13: 4, 14: 6, 15: 8, 16: 14, 17: 18, 18: 16, 19: 14, 20: 12, 21: Number(process.env.W21 ?? 7) };

function rewardScore(id: SkillId, run: RunState): number {
  const sk = getSkill(id);
  if (isArmor(sk)) return (sk.damageCap ?? 9) < armorCap(run) ? 40 + (armorCap(run) - sk.damageCap!) * 10 : -1;
  let best = 0;
  for (const k of Object.keys(WEIGHT).map(Number)) if (canPlaceAt(sk, k)) best = Math.max(best, WEIGHT[k] * (slotValue(id, k, run, 0.5) - slotValue(run.slots[k], k, run, 0.5)));
  return best;
}

function place(run: RunState, id: SkillId): void {
  const sk = getSkill(id);
  if (isArmor(sk)) { if (rewardScore(id, run) > 0) equipArmor(run, id); return; }
  let bestK = -1, bestG = 0;
  for (const k of Object.keys(WEIGHT).map(Number)) {
    if (!canPlaceAt(sk, k)) continue;
    const g = WEIGHT[k] * (slotValue(id, k, run, 0.5) - slotValue(run.slots[k], k, run, 0.5));
    if (g > bestG) { bestG = g; bestK = k; }
  }
  if (bestK > 0) equipSkill(run, bestK, id);
}

/** UPG=ward:3,might:2 のように、祭壇の強化レベルを指定して試算する（省略時は強化なし）。 */
function upgMeta() {
  if (!process.env.UPG) return undefined;
  const meta = emptyMeta();
  for (const pair of process.env.UPG.split(',')) { const [id, lv] = pair.split(':'); meta.upgrades[id] = Number(lv); }
  return meta;
}

// 調整用の上書き（試算専用）: ENEMY_SCALE=敵の攻撃倍率 / PLAYER_HP=初期最大HP / ENEMY_HP_SCALE=敵HP倍率
const STAGE_OF: Record<string, number> = { slime: 1, skeleton: 1, bat: 1, ghoul: 1, knight: 1, merman: 2, gargoyle: 2, wraith: 2, serpent: 2, flame: 3, golem: 3, imp: 3, dragon: 3 };
const ESS = [1, 2, 3].map((n) => Number(process.env[`ES${n}`] ?? process.env.ENEMY_SCALE ?? 1));
if (ESS.some((x) => x !== 1)) {
  const { ENEMY_LINEUP } = await import('../src/core/entities/enemies/catalog');
  const done = new Set<string>();
  for (const e of ENEMY_LINEUP) {
    const k = ESS[(STAGE_OF[e.id] ?? 1) - 1];
    for (const id of new Set([...Object.values(e.slots), e.fallbackSkill])) {
      if (!id || done.has(id)) continue; done.add(id);
      for (const ef of getSkill(id).effects) if (ef.type === 'attack') { ef.add = Math.round((ef.add ?? 0) * k); ef.mult = ef.mult * k; }
    }
  }
}
const stat = { runs: 0, clears: 0, battles: 0, won: 0, rounds: 0, hpLost: 0, defends: 0, decisions: 0, herbs: 0 };
const perEnemy: Record<string, { n: number; w: number; hp: number; rounds: number }> = {};
const deaths: Record<string, number> = {};
const reach: Record<string, number> = {};
const stageReached: Record<number, number> = {};

(async () => {
  for (let i = 0; i < N; i++) {
    const rng = seededRng(1000 + i);
    const run = createRun(undefined, upgMeta());
    if (process.env.PLAYER_HP) { run.maxHp = Number(process.env.PLAYER_HP); run.hp = run.maxHp; }
    if (process.env.START_ARMOR) run.armor = process.env.START_ARMOR;
    if (process.env.HERB) (getSkill('herb').effects[0] as { amount: number }).amount = Number(process.env.HERB);
    if (process.env.NO_HERB) delete run.slots[12];
    if (process.env.HERB_SLOT) { delete run.slots[12]; run.slots[Number(process.env.HERB_SLOT)] = 'herb'; }
    if (process.env.RELIC) { const { RELIC_POOL } = await import('../src/relics/catalog'); const r = RELIC_POOL.find((x) => x.id === process.env.RELIC); if (r && !process.env.RELIC_STAGE) run.relics.push(r); }
    stat.runs++;
    let dead = '';
    while (!dead) {
      const opts = reachableTiles(run);
      if (opts.length === 0) {
        if (isFinalStage(run)) { stat.clears++; break; }
        // 階層を踏破: 遺物を1つ選んで（レアの高いもの）、次の階層へ
        const rs = offerRelics(run, rng);
        if (rs.length) run.relics.push([...rs].sort((a, b) => (b.rarity === 'legend' ? 2 : b.rarity === 'rare' ? 1 : 0) - (a.rarity === 'legend' ? 2 : a.rarity === 'rare' ? 1 : 0))[0]);
        stageReached[run.stage + 1] = (stageReached[run.stage + 1] ?? 0) + 1;
        advanceStage(run);
        if (process.env.RELIC && Number(process.env.RELIC_STAGE) === run.stage) { const { RELIC_POOL } = await import('../src/relics/catalog'); const r = RELIC_POOL.find((x) => x.id === process.env.RELIC); if (r && !run.relics.includes(r)) run.relics.push(r); } // RELIC_STAGE=N: N 階層の頭から持つ
        if (process.env.STAGE_HEAL_FULL) run.hp = run.maxHp;
        continue;
      }
      let pick = opts[Math.floor(rng.next() * opts.length)];
      if (SMART_PATH) {
        const hpRatio = run.hp / run.maxHp;
        const score = (k: string): number => ({ inn: hpRatio < 0.7 ? 5 : 1, chest: 3, shop: 3, shrine: 3, enemy: 2, boss: 2, empty: 1, start: 0 } as Record<string, number>)[k] ?? 0;
        pick = [...opts].sort((a, b) => score(b.kind) - score(a.kind) || rng.next() - 0.5)[0];
      }
      const tile = moveTo(run, pick.id);
      reach[tile.id] = (reach[tile.id] ?? 0) + 1;
      if (tile.kind === 'enemy' || tile.kind === 'boss') {
        const def = enemyOfTile(tile);
        const lv = enemyLevel(def);
        const m = new BattleMachine({ enemy: def, playerMaxHp: run.maxHp, playerHp: run.hp, playerSlots: run.slots, playerFallback: run.fallbackSkill, playerAttack: run.baseAttack, playerBlock: run.bonus.startBlock, playerArmorCap: armorCap(run), relics: run.relics, rng, pace: async () => {} });
        m.bus.on('onRoundEnd', () => { stat.rounds++; (perEnemy[def.id] ??= { n: 0, w: 0, hp: 0, rounds: 0 }).rounds++; });
        m.onChange(() => {
          if (!m.canAct) return;
          queueMicrotask(() => {
            const { player, enemy, rules, deck } = m.ctx;
            const total = player.hand.total(rules);
            const odds = drawOdds(deck, player.hand, enemy.hand, rules);
            const sk = getSkill(player.slots[slotKeyOf(total)] ?? player.fallbackSkill);
            const heals = sk.effects.some((e) => e.type === 'heal');
            stat.decisions++;
            let act: 'hit' | 'stand' | 'surrender';
            const cap = player.armorCap ?? rules.defendCap;
            const dm = process.env.DEF_MODE === 'boss' && def.id === 'dragon' && total <= 17 && player.hp <= 24 && player.hp > cap;
            const standOn = (def.ai as { standOn?: number }).standOn ?? 17;
            // 予告が出ていれば、危険の読みより先に「21 かバーストか」を読む（FATAL_RISK と同じく、OMEN_RISK=1 で読まない）
            const p21 = m.ctx.bustOrDie ? chance21(m) : 0;
            const pf = m.ctx.bustOrDie ? (p21 >= OMEN_RISK ? 1 : 0) : fatalChance(m, standOn);
            if (dm || (player.hp <= lv && player.hp > cap && total < 18) || (pf >= FATAL_RISK && player.hp > cap && total < 20)) act = 'surrender';
            else if (heals && player.hp <= player.maxHp * 0.5 && total >= 12) act = 'stand';
            else if (total <= 11) act = 'hit';
            else if (total >= 20) act = 'stand';
            else act = (odds?.bust ?? 1) < RISK ? 'hit' : 'stand';
            if (act === 'surrender') stat.defends++;
            m.submit(act);
          });
        });
        const hp0 = run.hp;
        await m.run();
        const pe = (perEnemy[def.id] ??= { n: 0, w: 0, hp: 0, rounds: 0 });
        pe.n++; stat.battles++;
        pe.hp += hp0 - m.ctx.player.hp; stat.hpLost += hp0 - m.ctx.player.hp;
        if (m.ctx.winner !== m.ctx.player) { dead = tile.id; break; }
        pe.w++; stat.won++;
        run.hp = m.ctx.player.hp;
        run.maxHp = m.ctx.player.maxHp; // 凱旋の杯で増えた最大 HP を引き継ぐ
        if (!process.env.NO_GOLD) run.gold += rewardGold(run, def, tile.kind === 'boss');
        if (tile.kind === 'enemy') {
          const offer = offerSkills(rng, run, def.id);
          const best = [...offer].sort((a, b) => rewardScore(b, run) - rewardScore(a, run))[0];
          run.inventory.push(best);
          place(run, best);
        }
      } else if (tile.kind === 'shop' && !process.env.NO_GOLD) {
        // 持ち物の余りを売り、遺物 → 効果の大きい順に買う
        for (const id of [...run.inventory]) sellFromInventory(run, id);
        const offers = generateShop(run, rng);
        const buyRelics = (): void => { for (const o of offers.filter((x) => x.type === 'relic')) buyOffer(run, o); };
        const buyItems = (): void => {
          const items = offers.filter((x) => x.type === 'skill').sort((a, b) => rewardScore(b.id, run) - rewardScore(a.id, run));
          for (const o of items) {
            if (rewardScore(o.id, run) <= 0 || run.gold < o.price) continue;
            if (buyOffer(run, o)) { place(run, o.id); }
          }
        };
        // SHOP_FIRST=items: 道具・防具を先に買う（既定は、遺物が先）
        if (process.env.SHOP_FIRST === 'items') { buyItems(); buyRelics(); } else { buyRelics(); buyItems(); }
      } else if (tile.kind === 'chest') {
        const r = offerRelics(run, rng);
        if (r.length) run.relics.push(r[Math.floor(rng.next() * r.length)]);
      } else if (tile.kind === 'inn') useInn(run);
      else if (tile.kind === 'shrine') {
        // バージョンアップできるなら一番レアの低いものを強化、なければランダム
        const ups = shrineUpgradeChoices(run, rng).filter((k) => canUpgradeSlot(run, k)); // 候補は最大 3 つ（21 は必ず入る）
        const costOf = (k: number) => upgradeCost(run.slots[k]!) ?? 0;
        const afford = process.env.NO_GOLD ? ups : ups.filter((k) => run.gold >= costOf(k));
        if (afford.length > 0) { const k = afford.sort((a, b) => WEIGHT[b] - WEIGHT[a])[0]; run.gold -= process.env.NO_GOLD ? 0 : costOf(k); upgradeSlot(run, k); }
        else resolveShrine(run, rng);
      }
      markCleared(run, tile.id);
    }
    if (dead) deaths[`${run.stage}-${dead}`] = (deaths[`${run.stage}-${dead}`] ?? 0) + 1;
  }
  const f = (x: number, d = 1) => x.toFixed(d);
  console.log(`risk ${RISK} N ${N} | クリア ${f(100 * stat.clears / N, 0)}% | 1戦の勝率 ${f(100 * stat.won / stat.battles, 0)}% | 1戦 ${f(stat.rounds / stat.battles)}R・自HP減 ${f(stat.hpLost / stat.battles)} | 防御 ${f(100 * stat.defends / stat.decisions, 1)}%`);
  for (const [id, p] of Object.entries(perEnemy)) console.log(`  ${id.padEnd(9)} 戦${String(p.n).padStart(5)} 勝率 ${f(100 * p.w / p.n, 0).padStart(3)}%  1戦 ${f(p.rounds / p.n)}R  自HP減 ${f(p.hp / p.n)}`);
  console.log('  階層に到達:', [2, 3].map((n) => `第${n}階層 ${f(100 * (stageReached[n] ?? 0) / N, 0)}%`).join(' '));
  console.log('  死亡位置:', Object.entries(deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${f(100 * v / N, 0)}%`).join(' '));
})();
