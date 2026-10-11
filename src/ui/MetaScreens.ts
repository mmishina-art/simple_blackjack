import { audio } from '../audio/AudioManager';
import { SKILL_POOL } from '../core/skills/catalog';
import { describeSkill, getSkill, rarityOfSkill, slotLabel, type SkillId } from '../core/skills/Skill';
import {
  buyUpgrade, canBuy, CODEX_RELIC_TOTAL, CODEX_SKILL_TOTAL, isRelicDiscovered, isSkillDiscovered, nextCost, saveMeta,
  selectableStartingSkills, setStartingSkill, STARTER_SKILLS, startingCapacity, STARTING_SLOT_KEYS, UPGRADES,
  upgradeLevel, validStartingSkills, type MetaState,
} from '../meta/Meta';
import { RELIC_POOL } from '../relics/catalog';
import { rarityBadge, rarityClass } from './rarity';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function backButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'btn btn--retry loadout__btn', `<span class="btn__main">${label}</span>`);
  b.addEventListener('click', () => {
    audio.sfx('click');
    onClick();
  });
  return b;
}

/** 魂の祭壇: 魂片で恒久強化を買う。 */
export function showAltar(root: HTMLElement, meta: MetaState, onClose: () => void): void {
  const render = (): void => {
    const screen = el('main', 'meta-screen');
    screen.append(el('header', 'meta-head', `<h1>魂の祭壇</h1><p class="shards">魂片 <strong>${meta.shards}</strong></p>
      <p class="meta-head__sub">冒険の途中で倒れても魂片は持ち帰れる</p>`));
    const list = el('div', 'meta-list');
    for (const def of UPGRADES) {
      const level = upgradeLevel(meta, def.id);
      const max = def.costs.length;
      const cost = nextCost(meta, def.id);
      const affordable = canBuy(meta, def.id);
      const card = el('button', `choice__card upgrade${cost === null ? ' upgrade--max' : ''}`);
      card.disabled = !affordable;
      const pips = Array.from({ length: max }, (_, i) => (i < level ? '●' : '○')).join('');
      const next = cost === null ? '最大まで強化済み' : `次: ${def.describe(level + 1)}`;
      card.innerHTML = `<span class="medal">${def.icon}</span>
        <span class="choice__text"><strong>${def.name} <small class="pips">${pips}</small></strong>
        <span>${level > 0 ? def.describe(level) : '未強化'}</span><span class="upgrade__next">${next}</span></span>
        <span class="upgrade__cost">${cost === null ? 'MAX' : `${cost}`}</span>`;
      card.addEventListener('click', () => {
        if (buyUpgrade(meta, def.id)) {
          saveMeta(meta);
          audio.sfx('pick');
          render();
        }
      });
      list.append(card);
    }
    screen.append(list, backButton('戻る', onClose));
    root.replaceChildren(screen);
  };
  render();
}

/** 図鑑: 入手したスキル・レリックの一覧。未入手は「？」。 */
export function showCodex(root: HTMLElement, meta: MetaState, onClose: () => void): void {
  const screen = el('main', 'meta-screen');
  const found = [...new Set([...STARTER_SKILLS, ...SKILL_POOL])].filter((id) => isSkillDiscovered(meta, id)).length;
  screen.append(el('header', 'meta-head', `<h1>図鑑</h1><p class="meta-head__sub">入手したものは次回から報酬に出やすくなる。スキルは出撃時に最初から置ける</p>`));

  const skills = el('section', 'codex');
  skills.append(el('h2', 'codex__title', `スキル　${found} / ${CODEX_SKILL_TOTAL}`));
  const sGrid = el('div', 'codex__grid');
  for (const id of new Set([...STARTER_SKILLS, ...SKILL_POOL])) {
    const known = isSkillDiscovered(meta, id);
    const skill = getSkill(id);
    sGrid.append(el('div', `codex__item ${known ? rarityClass(rarityOfSkill(skill)) : 'codex__item--unknown'}`,
      known
        ? `<span class="medal medal--sm">${skill.icon}</span><span>${skill.name} ${rarityBadge(rarityOfSkill(skill))}<small>${describeSkill(skill)}</small></span>`
        : '<span class="medal medal--sm">？</span><span>？？？<small>未入手</small></span>'));
  }
  skills.append(sGrid);

  const relics = el('section', 'codex');
  const rFound = RELIC_POOL.filter((r) => isRelicDiscovered(meta, r.id)).length;
  relics.append(el('h2', 'codex__title', `レリック　${rFound} / ${CODEX_RELIC_TOTAL}`));
  const rGrid = el('div', 'codex__grid');
  for (const r of RELIC_POOL) {
    const known = isRelicDiscovered(meta, r.id);
    rGrid.append(el('div', `codex__item ${known ? rarityClass(r.rarity) : 'codex__item--unknown'}`,
      known
        ? `<span class="medal medal--sm">${r.icon}</span><span>${r.name} ${rarityBadge(r.rarity)}<small>${r.description}</small></span>`
        : '<span class="medal medal--sm">？</span><span>？？？<small>未入手</small></span>'));
  }
  relics.append(rGrid);

  const body = el('div', 'meta-body');
  body.append(skills, relics);
  screen.append(body, backButton('戻る', onClose));
  root.replaceChildren(screen);
}

/** 出撃準備: 図鑑のスキルを、空きスロットに最初から置く（枠数は祭壇で増やせる）。 */
export function showPrep(root: HTMLElement, meta: MetaState, onStart: () => void, onBack: () => void): void {
  let armed: SkillId | null = null;
  const render = (): void => {
    const picked = validStartingSkills(meta);
    const used = Object.keys(picked).length;
    const capacity = startingCapacity(meta);
    const screen = el('main', 'meta-screen');
    screen.append(el('header', 'meta-head', `<h1>出撃準備</h1>
      <p class="meta-head__sub">初期スキル枠 ${used} / ${capacity}　${armed ? `「${getSkill(armed).name}」を置くスロットを選べ` : 'スキルを選び、空きスロットに置く'}</p>`));

    const slots = el('div', 'loadout__slots');
    for (const key of STARTING_SLOT_KEYS) {
      const id = picked[key];
      const skill = id ? getSkill(id) : null;
      const row = el('button', `lslot${skill ? ` lslot--set ${rarityClass(rarityOfSkill(skill))}` : ' lslot--set'}${armed ? ' lslot--target' : ''}`,
        `<span class="lslot__key">${slotLabel(key)}</span><span class="medal medal--sm">${skill ? skill.icon : '攻'}</span>
         <span class="lslot__name">${skill ? skill.name : '通常攻撃・空き'}</span>
         <span class="lslot__desc">${skill ? describeSkill(skill) : ''}</span>`);
      row.addEventListener('click', () => {
        if (armed) {
          if (setStartingSkill(meta, key, armed)) {
            saveMeta(meta);
            audio.sfx('pick');
            armed = null;
          }
        } else if (skill) {
          setStartingSkill(meta, key, null);
          saveMeta(meta);
        }
        render();
      });
      slots.append(row);
    }

    const inv = el('div', 'loadout__inv');
    inv.append(el('div', 'loadout__inv-title', '図鑑のスキル'));
    const chips = el('div', 'loadout__chips');
    for (const id of selectableStartingSkills(meta)) {
      const skill = getSkill(id);
      const chip = el('button', `chip ${rarityClass(rarityOfSkill(skill))}${armed === id ? ' chip--armed' : ''}`,
        `<span class="medal medal--sm">${skill.icon}</span><span>${skill.name}<small>${describeSkill(skill)}</small></span>`);
      chip.addEventListener('click', () => {
        armed = armed === id ? null : id;
        render();
      });
      chips.append(chip);
    }
    inv.append(chips);

    const actions = el('div', 'loadout__actions');
    const back = backButton('戻る', onBack);
    back.classList.replace('btn--retry', 'btn--stand');
    const go = el('button', 'btn btn--hit loadout__btn', '<span class="btn__main">出発する</span>');
    go.addEventListener('click', () => {
      audio.sfx('click');
      onStart();
    });
    actions.append(back, go);
    screen.append(slots, inv, actions);
    root.replaceChildren(screen);
  };
  render();
}
