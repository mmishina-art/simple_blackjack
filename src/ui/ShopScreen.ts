import { audio } from '../audio/AudioManager';
import { describeSkillBonus, getSkill, kindOfSkill, placementNote, rarityOfSkill } from '../core/skills/Skill';
import { inventoryEntries } from '../run/loadout';
import { buyOffer, sellFromInventory, sellPrice, type ShopOffer } from '../run/shop';
import { RELIC_POOL } from '../relics/catalog';
import { buildScene } from './components/scenes';
import { buildTopBar } from './components/TopBar';
import { kindTag, medalKindClass } from './kind';
import { rarityClass, rarityNote } from './rarity';
import type { RunState } from '../run/Run';

export interface ShopOptions {
  offers: ShopOffer[];
  /** スキル・道具・防具を買った（装備画面で置き先を決める）。 */
  onBought(offer: ShopOffer): void;
  /** 最初に出す一言。 */
  note?: string;
  /** ショップを出る。 */
  onLeave(): void;
}

/** ショップ。ゴールドでスキル・道具・防具・遺物を買い、持ち物を売る。 */
export function showShop(root: HTMLElement, run: RunState, opts: ShopOptions): void {
  let note = opts.note ?? '';
  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = 'loadout shop';

    const head = document.createElement('header');
    head.className = 'loadout__head';
    const scene = buildScene('shop', '旅の商人', note || '「いらっしゃい。ゆっくり見ていきな」');
    const purse = document.createElement('p');
    purse.className = 'shop__gold';
    purse.innerHTML = `<span class="shop__coin" aria-hidden="true"></span>所持金 <strong>${run.gold}</strong> G`;
    head.append(scene, purse);
    screen.append(buildTopBar('ショップ', opts.onLeave), head);

    const list = document.createElement('div');
    list.className = 'loadout__inv shop__list';

    const section = (label: string): void => {
      const h = document.createElement('div');
      h.className = 'loadout__kind';
      h.textContent = label;
      list.append(h);
    };
    const row = (cls: string, icon: string, medalCls: string, title: string, desc: string, price: number, action: string, enabled: boolean, onClick: () => void): void => {
      const b = document.createElement('button');
      b.className = `shop__row ${cls}`;
      b.disabled = !enabled;
      b.innerHTML = `<span class="medal medal--sm ${medalCls}">${icon}</span>
        <span class="shop__text"><strong>${title}</strong><small>${desc}</small></span>
        <span class="shop__price"><b>${price} G</b><small>${action}</small></span>`;
      b.addEventListener('click', onClick);
      list.append(b);
    };

    section('売り物');
    for (const offer of opts.offers) {
      if (offer.type === 'skill') {
        const sk = getSkill(offer.id);
        const kind = kindOfSkill(sk);
        const where = placementNote(sk);
        row(`${rarityClass(rarityOfSkill(sk))}${offer.sold ? ' shop__row--sold' : ''}`, sk.icon, `${rarityClass(rarityOfSkill(sk))}${medalKindClass(kind)}`,
          `${sk.name} ${kindTag(sk)} ${rarityNote(rarityOfSkill(sk))}`,
          `${describeSkillBonus(sk)}${where ? `（${where}）` : ''}`,
          offer.price, offer.sold ? '売り切れ' : run.gold < offer.price ? 'G不足' : '買う', !offer.sold && run.gold >= offer.price,
          () => { if (buyOffer(run, offer)) { audio.sfx('pick'); opts.onBought(offer); } });
      } else {
        const relic = RELIC_POOL.find((r) => r.id === offer.id)!;
        row(`${rarityClass(relic.rarity ?? 'common')}${offer.sold ? ' shop__row--sold' : ''}`, relic.icon, `${rarityClass(relic.rarity ?? 'common')} medal--relic`,
          `${relic.name} <em class="kind-tag">遺物</em> ${rarityNote(relic.rarity ?? 'common')}`, relic.description,
          offer.price, offer.sold ? '売り切れ' : run.gold < offer.price ? 'G不足' : '買う', !offer.sold && run.gold >= offer.price,
          () => { if (buyOffer(run, offer)) { audio.sfx('pick'); note = `「${relic.name}」を買った。`; render(); } });
      }
    }

    section('道具袋の中身を売る');
    const entries = inventoryEntries(run);
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = '道具袋は空（置かなかったものを 1 つ入れておける）';
      list.append(p);
    }
    for (const e of entries) {
      const sk = getSkill(e.id);
      row(rarityClass(rarityOfSkill(sk)), sk.icon, `${rarityClass(rarityOfSkill(sk))}${medalKindClass(kindOfSkill(sk))}`,
        `${sk.name}${e.count > 1 ? ` ×${e.count}` : ''} ${kindTag(sk)}`, describeSkillBonus(sk),
        sellPrice(e.id), '売る', true,
        () => {
          const g = sellFromInventory(run, e.id);
          if (g !== null) { audio.sfx('click'); note = `「${sk.name}」を ${g} G で売った。`; render(); }
        });
    }
    screen.append(list);

    root.replaceChildren(screen);
  };
  render();
}
