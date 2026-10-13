import { audio } from '../audio/AudioManager';
import { DEFAULT_PLAYER_FALLBACK, slotAttack, START_ATTACK } from '../core/skills/catalog';
import { ARMOR_POOL, ITEM_POOL, SKILL_POOL } from '../core/skills/catalog';
import { describeSkill, getSkill, isItem, kindOfSkill, rarityOfSkill, slotLabel, type SkillKind } from '../core/skills/Skill';
import { kindTag, medalKindClass } from './kind';
import {
  buyUpgrade, canBuy, CODEX_ARMOR_TOTAL, CODEX_ITEM_TOTAL, CODEX_RELIC_TOTAL, CODEX_SKILL_TOTAL, computeBonus, customCount, isRelicDiscovered, isSkillDiscovered,
  nextCost, saveMeta, setStartingSkill, STARTER_SKILLS, startingCapacity, UPGRADES, upgradeLevel, type MetaState,
} from '../meta/Meta';
import { placedElsewhere, prepCandidates, prepSlots, type PrepSlot } from '../meta/prep';
import { RELIC_POOL } from '../relics/catalog';
import { createBackupSection } from './BackupSection';
import { openSheet, type SheetOption } from './components/SkillSheet';
import { buildSlotRow } from './components/SlotRow';
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
    screen.append(list, createBackupSection(), backButton('戻る', onClose));
    root.replaceChildren(screen);
  };
  render();
}

/** 図鑑: 入手したスキル・レリックの一覧。未入手は「？」。 */
export function showCodex(root: HTMLElement, meta: MetaState, onClose: () => void): void {
  const screen = el('main', 'meta-screen');
  const all = [...new Set([...STARTER_SKILLS, ...SKILL_POOL, ...ITEM_POOL])];
  const kindOf = (kind: SkillKind): string[] => (kind === 'armor' ? [...ARMOR_POOL] : all.filter((id) => kindOfSkill(getSkill(id)) === kind));
  screen.append(el('header', 'meta-head', `<h1>図鑑</h1><p class="meta-head__sub">入手したものは次回から報酬に出やすくなる。スキル・道具は出撃時に最初から置ける（防具は置けない）</p>`));

  const section = (title: string, ids: string[], total: number): HTMLElement => {
    const box = el('section', 'codex');
    box.append(el('h2', 'codex__title', `${title}　${ids.filter((id) => isSkillDiscovered(meta, id)).length} / ${total}`));
    const grid = el('div', 'codex__grid');
    for (const id of ids) {
      const known = isSkillDiscovered(meta, id);
      const skill = getSkill(id);
      grid.append(el('div', `codex__item ${known ? rarityClass(rarityOfSkill(skill)) : 'codex__item--unknown'}`,
        known
          ? `<span class="medal medal--sm${medalKindClass(kindOfSkill(skill))}">${skill.icon}</span><span>${skill.name} ${kindTag(skill)} ${rarityBadge(rarityOfSkill(skill))}<small>${describeSkill(skill)}</small></span>`
          : '<span class="medal medal--sm">？</span><span>？？？<small>未入手</small></span>'));
    }
    box.append(grid);
    return box;
  };
  const skills = section('スキル', kindOf('skill'), CODEX_SKILL_TOTAL);
  const items = section('道具', kindOf('item'), CODEX_ITEM_TOTAL);
  const armors = section('防具', kindOf('armor'), CODEX_ARMOR_TOTAL);

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
  body.append(skills, items, armors, relics);
  screen.append(body, backButton('戻る', onClose));
  root.replaceChildren(screen);
}

/**
 * 出撃準備: 冒険を始めるときの装備を決める（設定は保存され、次回以降も使われる）。
 *  - 全スロット（11以下〜21）の一覧を見ながら、変えたいスロットをタップ → 図鑑のスキルを選ぶ（1ステップ）
 *  - 変えられる数（初期装備枠）は 1 から。祭壇で最大 3 まで増やせる
 *  - 11以下と 21 は固定。初期装備（15・18・20）も置き換えられ、「初期装備に戻す」で元に戻せる
 */
export function showPrep(root: HTMLElement, meta: MetaState, onStart: () => void, onBack: () => void): void {
  const baseAtk = START_ATTACK + computeBonus(meta).attack;
  const atkAt = (key: number): number => slotAttack(baseAtk, key); // 基本攻撃力はスロットごとに変わる
  const fallback = getSkill(DEFAULT_PLAYER_FALLBACK);

  const render = (): void => {
    const slots = prepSlots(meta);
    const used = customCount(meta);
    const capacity = startingCapacity(meta);
    const screen = el('main', 'meta-screen prep');

    screen.append(el('header', 'meta-head', `<h1>出撃準備</h1>
      <p class="meta-head__sub">冒険を始めるときの装備を決める。図鑑に載っているスキルを、最初から装備できる。設定は保存される。</p>`));

    const pips = Array.from({ length: capacity }, (_, i) => (i < used ? '●' : '○')).join(' ');
    screen.append(el('div', 'prep-cap', `<span class="prep-cap__label">装備を変えられる数</span>
      <span class="prep-cap__pips">${pips}</span><span class="prep-cap__num">${used} / ${capacity}</span>
      <span class="prep-cap__sub">${capacity < 3 ? '祭壇の「初期装備枠」で増やせる（最大 3）' : '最大まで強化済み'}</span>`));
    screen.append(el('p', 'prep-hint', '変えたいスロットをタップ → 一覧からスキルを選ぶ。11以下と21は固定。'));

    const list = el('div', 'loadout__slots');
    for (const slot of slots) {
      list.append(buildSlotRow({
        key: slot.key,
        skill: slot.effectiveId ? getSkill(slot.effectiveId) : null,
        fallback, atk: atkAt(slot.key),
        locked: !slot.editable,
        tag: slot.customId ? '変更' : slot.defaultId && slot.editable ? '初期' : undefined,
        tagTone: slot.customId ? 'custom' : undefined,
        onTap: slot.editable ? () => openPicker(slot) : undefined,
      }));
    }
    screen.append(list);

    const actions = el('div', 'loadout__actions');
    const back = backButton('戻る', onBack);
    back.classList.replace('btn--retry', 'btn--stand');
    const go = el('button', 'btn btn--hit loadout__btn', '<span class="btn__main">出発する</span>');
    go.addEventListener('click', () => {
      audio.sfx('click');
      onStart();
    });
    actions.append(back, go);
    screen.append(actions);
    root.replaceChildren(screen);
  };

  /** スロットをタップしたときに開く、置くスキルの選択シート。 */
  const openPicker = (slot: PrepSlot): void => {
    const used = customCount(meta);
    const capacity = startingCapacity(meta);
    const current = slot.effectiveId ? getSkill(slot.effectiveId) : null;
    const options: SheetOption[] = [];

    if (slot.customId) {
      const def = slot.defaultId ? getSkill(slot.defaultId) : null;
      options.push({
        kind: 'reset', icon: '戻',
        name: def ? `初期装備に戻す（${def.name}）` : '空きに戻す（通常攻撃）',
        detail: def ? describeSkill(def, atkAt(slot.key)) : '何も装備しない',
        onPick() {
          setStartingSkill(meta, slot.key, null);
          saveMeta(meta);
          render();
        },
      });
    }
    // スキルと道具に分けて並べる（それぞれ、レア度の高い順）
    for (const [label, wantItem] of [['スキル', false], ['道具', true]] as const) {
      for (const id of prepCandidates(meta).filter((x) => isItem(getSkill(x)) === wantItem)) {
        const skill = getSkill(id);
        const elsewhere = placedElsewhere(meta, id, slot.key);
        const isCurrent = slot.effectiveId === id;
        options.push({
          icon: skill.icon, name: skill.name, rarity: rarityOfSkill(skill), section: label, skillKind: wantItem ? 'item' : 'skill',
          detail: describeSkill(skill, atkAt(slot.key)),
          badge: isCurrent ? '現在' : elsewhere.length ? `${elsewhere.map(slotLabel).join('・')} に配置中` : undefined,
          disabled: !slot.canChange || isCurrent,
          onPick() {
            if (setStartingSkill(meta, slot.key, id)) {
              saveMeta(meta);
              render();
            }
          },
        });
      }
    }
    const state = slot.customId ? '変更済み' : slot.defaultId ? '初期装備' : '空き';
    openSheet({
      title: `${slotLabel(slot.key)} のスロット`,
      subtitle: `いま: ${current ? `${current.name}（${describeSkill(current, atkAt(slot.key))}）` : '通常攻撃'}　[${state}]`,
      notice: slot.canChange ? undefined
        : `装備を変えられる数がいっぱい（${used} / ${capacity}）。別のスロットを「初期装備に戻す」と空きます。祭壇の「初期装備枠」でも増やせます。`,
      options,
    });
  };

  render();
}
