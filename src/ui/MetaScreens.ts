import { isDebug } from '../debug';
import type { Rarity } from '../core/rarity';
import { getEnemy, ENEMY_LINEUP } from '../core/entities/enemies/catalog';
import { enemyLevel } from '../core/entities/enemies/level';
import { STAGES } from '../map/stages';
import { dropsOf } from '../run/drops';
import { ENEMY_SPRITES } from './components/enemySprites';
import { audio } from '../audio/AudioManager';
import { ARMOR_POOL, ITEM_POOL, SKILL_POOL, UPGRADE_ONLY_SKILLS } from '../core/skills/catalog';
import { describeSkill, getSkill, kindOfSkill, rarityOfSkill, type SkillKind } from '../core/skills/Skill';
import { sortSkillsForCodex } from '../meta/codexOrder';
import { RARITY_ORDER } from '../run/loadout';
import { kindTag, medalKindClass } from './kind';
import {
  buyUpgrade, canBuy, CODEX_ARMOR_TOTAL, CODEX_ITEM_TOTAL, CODEX_RELIC_TOTAL, CODEX_SKILL_TOTAL, isEnemyDiscovered, isRelicDiscovered, isSkillDiscovered,
  nextCost, saveMeta, STARTER_SKILLS, UPGRADES, upgradeLevel, type MetaState,
} from '../meta/Meta';
import { RELIC_POOL } from '../relics/catalog';
import { createBackupSection } from './BackupSection';
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

/** レア度の低い順（コモン → レア → レジェンド）に並べる。同じレア度は、もとの並びのまま。 */
function byRarityAsc<T>(items: readonly T[], rarityOf: (item: T) => Rarity): T[] {
  return items
    .map((item, index) => ({ item, index, order: RARITY_ORDER[rarityOf(item)] }))
    .sort((a, b) => b.order - a.order || a.index - b.index)
    .map((x) => x.item);
}

/** 図鑑。「スキル」（スキル・道具・防具・レリック）と「モンスター」の 2 つの見開き。未入手・未討伐は「？」。 */
export function showCodex(root: HTMLElement, meta: MetaState, onClose: () => void, initialTab: 'skills' | 'monsters' = 'skills'): void {
  const screen = el('main', 'meta-screen codex-screen');
  // デバッグモードでは、すべて入手済みとして見せる（表示だけ。記録（meta）は変えない）
  const skillKnown = (id: string): boolean => isDebug() || isSkillDiscovered(meta, id);
  const relicKnown = (id: string): boolean => isDebug() || isRelicDiscovered(meta, id);
  const enemyKnown = (id: string): boolean => isDebug() || isEnemyDiscovered(meta, id);
  const all = [...new Set([...STARTER_SKILLS, ...SKILL_POOL, ...UPGRADE_ONLY_SKILLS, ...ITEM_POOL])];
  const kindOf = (kind: SkillKind): string[] => (kind === 'armor' ? [...ARMOR_POOL] : all.filter((id) => kindOfSkill(getSkill(id)) === kind));
  // 上の「戻る」・見出し・タブは固定。その下（ヒントと一覧）だけがスクロールする
  const top = el('header', 'codex-top');
  const back = el('button', 'codex-top__back', '‹ 戻る');
  back.setAttribute('aria-label', '図鑑を閉じる');
  back.addEventListener('click', () => { audio.sfx('click'); onClose(); });
  top.append(back, el('h1', 'codex-top__title', '図鑑'), el('span', 'codex-top__gap'));
  const body = el('div', 'meta-body codex-body');
  const tabs = el('div', 'codex-tabs');
  const sub = (tab: 'skills' | 'monsters'): string => isDebug()
    ? 'デバッグモード: すべて開放して表示中（記録は変わらない）'
    : tab === 'skills' ? '入手したものは、次回から報酬に出やすくなる（レア度の低い順）' : '倒した敵が載る。落とし物のスキルは、スキル図鑑に載ると見える';

  const section = (title: string, ids: string[], total: number): HTMLElement => {
    const box = el('section', 'codex');
    box.append(el('h2', 'codex__title', `${title}　${ids.filter(skillKnown).length} / ${total}`));
    const grid = el('div', 'codex__grid');
    for (const id of sortSkillsForCodex(ids)) {
      const known = skillKnown(id);
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
  const rFound = RELIC_POOL.filter((r) => relicKnown(r.id)).length;
  relics.append(el('h2', 'codex__title', `レリック　${rFound} / ${CODEX_RELIC_TOTAL}`));
  const rGrid = el('div', 'codex__grid');
  // レア度の低い順（同じレア度は、もとの並び）
  const relicsByRarity = byRarityAsc(RELIC_POOL, (r) => r.rarity ?? 'common');
  for (const r of relicsByRarity) {
    const known = relicKnown(r.id);
    rGrid.append(el('div', `codex__item ${known ? rarityClass(r.rarity) : 'codex__item--unknown'}`,
      known
        ? `<span class="medal medal--sm">${r.icon}</span><span>${r.name} ${rarityBadge(r.rarity)}<small>${r.description}</small></span>`
        : '<span class="medal medal--sm">？</span><span>？？？<small>未入手</small></span>'));
  }
  relics.append(rGrid);

  const monsters = buildMonsterSection();
  const render = (tab: 'skills' | 'monsters'): void => {
    const hint = el('p', 'meta-head__sub', sub(tab));
    tabs.replaceChildren(
      ...(['skills', 'monsters'] as const).map((t) => {
        const b = el('button', `codex-tabs__btn${t === tab ? ' is-on' : ''}`, t === 'skills' ? 'スキル' : 'モンスター');
        b.setAttribute('aria-pressed', String(t === tab));
        b.addEventListener('click', () => { audio.sfx('click'); render(t); });
        return b;
      }),
    );
    body.replaceChildren(hint, ...(tab === 'skills' ? [skills, items, armors, relics] : monsters));
    body.scrollTop = 0;
  };
  screen.append(top, tabs, body);
  root.replaceChildren(screen);
  render(initialTab);

  /** モンスター図鑑: 階層ごとの敵。倒したものは絵・名前・特性・落とし物が見える。落とし物のスキルは、スキル図鑑と同じ条件（入手済み）で見える。 */
  function buildMonsterSection(): HTMLElement[] {
    const out: HTMLElement[] = [];
    const placed = new Set<string>();
    const total = ENEMY_LINEUP.length;
    const found = ENEMY_LINEUP.filter((e) => enemyKnown(e.id)).length;
    out.push(el('h2', 'codex__title', `モンスター　${found} / ${total}`));
    STAGES.forEach((stage, i) => {
      const tiles = Object.values(stage.tiles).filter((t) => t.enemyId);
      const ids = [...new Set(tiles.map((t) => t.enemyId!))].filter((id) => !placed.has(id));
      const bossId = tiles.find((t) => t.kind === 'boss')?.enemyId;
      ids.forEach((id) => placed.add(id));
      const box = el('section', 'codex');
      box.append(el('h2', 'codex__title', `第${i + 1}階層　${stage.name}`));
      const grid = el('div', 'codex__grid');
      for (const id of ids.sort((x, y) => Number(x === bossId) - Number(y === bossId))) {
        const def = getEnemy(id);
        const known = enemyKnown(id);
        const drops = dropsOf(id);
        const dropHtml = id === bossId
          ? '<span class="drops__note">階層を踏破すると、遺物をひとつ選べる</span>'
          : drops.length === 0 ? '<span class="drops__note">なし</span>'
            : drops.map((sid) => {
              const sk = getSkill(sid);
              return skillKnown(sid)
                ? `<span class="drop ${rarityClass(rarityOfSkill(sk))}" title="${sk.name}（${describeSkill(sk)}）"><span class="medal medal--sm${medalKindClass(kindOfSkill(sk))}">${sk.icon}</span>${sk.name}</span>`
                : '<span class="drop drop--unknown" title="スキル図鑑に載ると見える"><span class="medal medal--sm">？</span></span>';
            }).join('');
        const item = el('div', `codex__item codex__item--monster${known ? '' : ' codex__item--unknown'}`,
          `<div class="codex__sprite" aria-hidden="true">${ENEMY_SPRITES[id] ?? ''}</div>
           <div class="codex__mon">
             <strong>${known ? def.name : '？？？'}${id === bossId ? ' <em class="kind-tag">ボス</em>' : ''}${known ? ` <small>LV${enemyLevel(def)}・HP ${def.maxHp}</small>` : ''}</strong>
             ${known ? `<small>${def.trait ?? ''}</small>` : '<small>未討伐</small>'}
             ${known ? `<div class="drops"><span class="drops__label">落とし物</span>${dropHtml}</div>` : ''}
           </div>`);
        grid.append(item);
      }
      box.append(grid);
      out.push(box);
    });
    return out;
  }
}
