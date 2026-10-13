import { audio } from '../audio/AudioManager';
import { describeSkillBonus, getSkill, KIND_LABEL, kindOfSkill, placementNote, rarityOfSkill } from '../core/skills/Skill';
import { inventoryEntries } from '../run/loadout';
import { buyOffer, sellFromInventory, sellPrice, type ShopOffer } from '../run/shop';
import { RELIC_POOL } from '../relics/catalog';
import { kindTag, medalKindClass } from './kind';
import { rarityBadge, rarityClass } from './rarity';
import type { RunState } from '../run/Run';

export interface ShopOptions {
  offers: ShopOffer[];
  /** ショップを出る。 */
  onLeave(): void;
}

/** ショップ。ゴールドでスキル・道具・防具・遺物を買い、持ち物を売る。 */
export function showShop(root: HTMLElement, run: RunState, opts: ShopOptions): void {
  let note = '';
  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = 'loadout shop';

    const head = document.createElement('header');
    head.className = 'loadout__head';
    head.innerHTML = `<h1>ショップ</h1><p class="shop__gold">所持金 <strong>${run.gold}</strong> G</p>`;
    screen.append(head);

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
          `${sk.name} ${kindTag(sk, true)} ${rarityBadge(rarityOfSkill(sk))}`,
          `${describeSkillBonus(sk)}${where ? `（${where}）` : ''}`,
          offer.price, offer.sold ? '売り切れ' : run.gold < offer.price ? 'G不足' : '買う', !offer.sold && run.gold >= offer.price,
          () => { if (buyOffer(run, offer)) { audio.sfx('pick'); note = `「${sk.name}」を買った（持ち物へ）。`; render(); } });
      } else {
        const relic = RELIC_POOL.find((r) => r.id === offer.id)!;
        row(`${rarityClass(relic.rarity ?? 'common')}${offer.sold ? ' shop__row--sold' : ''}`, relic.icon, rarityClass(relic.rarity ?? 'common'),
          `${relic.name} <em class="kind-tag">遺物</em> ${rarityBadge(relic.rarity ?? 'common')}`, relic.description,
          offer.price, offer.sold ? '売り切れ' : run.gold < offer.price ? 'G不足' : '買う', !offer.sold && run.gold >= offer.price,
          () => { if (buyOffer(run, offer)) { audio.sfx('pick'); note = `「${relic.name}」を買った。`; render(); } });
      }
    }

    section('持ち物を売る');
    const entries = inventoryEntries(run);
    if (entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'shop__empty';
      p.textContent = '売れるものがない（セットしていないスキル・道具・防具が売れる）';
      list.append(p);
    }
    for (const e of entries) {
      const sk = getSkill(e.id);
      row(rarityClass(rarityOfSkill(sk)), sk.icon, `${rarityClass(rarityOfSkill(sk))}${medalKindClass(kindOfSkill(sk))}`,
        `${sk.name}${e.count > 1 ? ` ×${e.count}` : ''} <span class="shop__kind">${KIND_LABEL[kindOfSkill(sk)]}</span>`, describeSkillBonus(sk),
        sellPrice(e.id), '売る', true,
        () => {
          const g = sellFromInventory(run, e.id);
          if (g !== null) { audio.sfx('click'); note = `「${sk.name}」を ${g} G で売った。`; render(); }
        });
    }
    screen.append(list);

    const msg = document.createElement('p');
    msg.className = 'shop__note';
    msg.setAttribute('aria-live', 'polite');
    msg.textContent = note;
    screen.append(msg);

    const leave = document.createElement('button');
    leave.className = 'btn btn--retry loadout__btn';
    leave.innerHTML = '<span class="btn__main">店を出る</span>';
    leave.addEventListener('click', () => { audio.sfx('click'); opts.onLeave(); });
    const actions = document.createElement('div');
    actions.className = 'loadout__actions';
    actions.append(leave);
    screen.append(actions);
    root.replaceChildren(screen);
  };
  render();
}
