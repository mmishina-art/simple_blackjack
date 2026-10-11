import { audio } from '../audio/AudioManager';
import { describeSkill, getSkill, rarityOfSkill, SLOT_KEYS, slotLabel, type SkillId } from '../core/skills/Skill';
import { effectiveSlotSkills } from '../run/effective';
import { inventoryEntries } from '../run/loadout';
import { equipSkill, isSlotLocked, unequipSlot, type RunState } from '../run/Run';
import { buildSlotRow } from './components/SlotRow';
import { openSheet, type SheetOption } from './components/SkillSheet';
import { rarityBadge, rarityClass } from './rarity';

export interface LoadoutOptions {
  /** スキル獲得直後など、あらかじめ「セット待ち」にしておく持ち物のスキル。置いたら自動で閉じる。 */
  armed?: SkillId;
  /** 閉じる。message があればマップ画面に表示する。 */
  onClose(message?: string): void;
}

/**
 * スキルの編成画面。
 *  - スロットをタップ → 持ち物から置くスキルを選ぶシートが開く（1ステップ）。外すのもそのシートから
 *  - スキル獲得直後は、上に「置くスキル」が表示され、置きたいスロットをタップするだけ
 *  - 11以下（小攻撃）と 21（会心の一撃）は固定で、選べない平らな行。レリックで解錠されると選べる
 */
export function showLoadout(root: HTMLElement, run: RunState, opts: LoadoutOptions): void {
  let armed: SkillId | null = opts.armed && run.inventory.includes(opts.armed) ? opts.armed : null;

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = `loadout${armed ? ' loadout--armed' : ''}`;

    const head = document.createElement('header');
    head.className = 'loadout__head';
    head.innerHTML = `<h1>編成</h1>
      <p class="loadout__atk">基本攻撃力 ATK ${run.baseAttack}</p>
      <p class="loadout__hint">${armed ? '置きたいスロットをタップ' : '変えたいスロットをタップして、持ち物のスキルを置く'}</p>`;
    screen.append(head);

    if (armed) {
      const skill = getSkill(armed);
      const banner = document.createElement('div');
      banner.className = `armed ${rarityClass(rarityOfSkill(skill))}`;
      banner.innerHTML = `<span class="medal">${skill.icon}</span>
        <span class="armed__text"><strong>${skill.name} ${rarityBadge(rarityOfSkill(skill))}</strong><span>${describeSkill(skill, run.baseAttack)}</span></span>`;
      screen.append(banner);
    }

    // スロット一覧
    const effective = effectiveSlotSkills(run);
    const entries = inventoryEntries(run);
    const slotList = document.createElement('div');
    slotList.className = 'loadout__slots';
    for (const key of SLOT_KEYS) {
      const id = run.slots[key];
      const locked = isSlotLocked(run, key);
      slotList.append(buildSlotRow({
        key,
        skill: id ? getSkill(id) : null,
        fallback: getSkill(run.fallbackSkill),
        atk: run.baseAttack,
        locked,
        effective: effective.get(key),
        target: !!armed && !locked,
        onTap: () => {
          if (armed) {
            const skill = getSkill(armed);
            if (equipSkill(run, key, armed)) {
              audio.sfx('pick');
              opts.onClose(`「${skill.name}」を ${slotLabel(key)} にセットした。`);
            }
            return;
          }
          openPicker(key);
        },
      }));
    }
    screen.append(slotList);

    // 持ち物（表示のみ。置くときはスロットをタップする）。セット待ちのときは上のバナーに集中させるため隠す
    const inv = document.createElement('div');
    inv.className = 'loadout__inv';
    inv.innerHTML = `<div class="loadout__inv-title">持ち物（${run.inventory.length}）</div>`;
    const chips = document.createElement('div');
    chips.className = 'loadout__chips';
    if (entries.length === 0) chips.textContent = 'なし（敵を倒すとスキルが手に入る）';
    for (const e of entries) {
      const skill = getSkill(e.id);
      const chip = document.createElement('div');
      chip.className = `chip chip--static ${rarityClass(rarityOfSkill(skill))}`;
      chip.innerHTML = `<span class="medal medal--sm">${skill.icon}</span><span>${skill.name}${e.count > 1 ? ` ×${e.count}` : ''}<small>${describeSkill(skill, run.baseAttack)}</small></span>`;
      chips.append(chip);
    }
    inv.append(chips);
    if (!armed) screen.append(inv);

    const close = document.createElement('button');
    close.className = 'btn btn--retry loadout__btn';
    close.innerHTML = `<span class="btn__main">${armed ? 'あとでセットする' : '閉じる'}</span>`;
    close.addEventListener('click', () => {
      audio.sfx('click');
      opts.onClose();
    });
    const actions = document.createElement('div');
    actions.className = 'loadout__actions';
    actions.append(close);
    screen.append(actions);
    root.replaceChildren(screen);
  };

  /** スロットをタップしたときに開く、置くスキルの選択シート。 */
  const openPicker = (key: number): void => {
    const currentId = run.slots[key];
    const current = currentId ? getSkill(currentId) : null;
    const options: SheetOption[] = [];
    if (current) {
      options.push({
        kind: 'reset', icon: '外', name: '外す（通常攻撃に戻す）',
        detail: `いまの「${current.name}」は持ち物に戻る`,
        onPick() { if (unequipSlot(run, key)) render(); },
      });
    }
    for (const e of inventoryEntries(run)) {
      const skill = getSkill(e.id);
      options.push({
        icon: skill.icon, name: skill.name, rarity: rarityOfSkill(skill),
        detail: describeSkill(skill, run.baseAttack),
        badge: e.count > 1 ? `×${e.count}` : undefined,
        note: current ? `いまの「${current.name}」と入れ替える` : undefined,
        onPick() { if (equipSkill(run, key, e.id)) render(); },
      });
    }
    openSheet({
      title: `${slotLabel(key)} のスロット`,
      subtitle: current ? `いま: ${current.name}（${describeSkill(current, run.baseAttack)}）` : 'いま: 通常攻撃（空き）',
      options,
      empty: '置けるスキルがない。敵を倒すとスキルが手に入る。',
    });
  };

  render();
}
