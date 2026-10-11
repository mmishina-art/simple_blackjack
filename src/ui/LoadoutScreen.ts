import { audio } from '../audio/AudioManager';
import { effectiveSlotSkills } from '../run/effective';
import { BASIC_ICON, describeSkill, fallbackLabel, getSkill, rarityOfSkill, SLOT_KEYS, slotLabel, type SkillId } from '../core/skills/Skill';
import { slotLook } from '../core/skills/look';
import { rarityBadge, rarityClass } from './rarity';
import { equipSkill, isSlotLocked, unequipSlot, type RunState } from '../run/Run';

export interface LoadoutOptions {
  /** スキル獲得直後など、あらかじめ「セット待ち」にしておく持ち物のスキル。 */
  armed?: SkillId;
  onClose(): void;
}

/**
 * スキルの編成画面。
 * 持ち物のスキルをタップ → スロットをタップでセット（元のスキルは持ち物へ）。
 * スロットをタップして選び、「外す」で持ち物へ戻す。11以下（小攻撃）と 21（会心の一撃）は固定。21 は封印の鍵で解除できる。
 */
export function showLoadout(root: HTMLElement, run: RunState, opts: LoadoutOptions): void {
  let armed: SkillId | null = opts.armed && run.inventory.includes(opts.armed) ? opts.armed : null;
  let selected: number | null = null;

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = 'loadout';

    const head = document.createElement('header');
    head.className = 'loadout__head';
    head.innerHTML = `<h1>編成</h1><p class="loadout__atk">基本攻撃力 ATK ${run.baseAttack}</p><p>${
      armed
        ? `「${getSkill(armed).name}」をセットするスロットを選べ`
        : '持ち物のスキルを選び、スロットに置く（空きスロットは通常攻撃）。11以下と21は変更できない'
    }</p>`;

    // スロット一覧: 固定スロット（11以下・21）は変更対象外なので、選べない平らな行で表示する
    const effective = effectiveSlotSkills(run);
    const slotList = document.createElement('div');
    slotList.className = 'loadout__slots';
    for (const key of SLOT_KEYS) {
      const id = run.slots[key];
      const locked = isSlotLocked(run, key);
      const skill = id ? getSkill(id) : getSkill(run.fallbackSkill);
      const eff = id ? effective.get(key) : undefined;
      // レリックで上書きされているときは、上書き後の名前と効果を赤字で示す
      const name = id ? (eff?.changed && eff.skill.id !== skill.id ? `<span class="over">${eff.skill.name}</span>` : skill.name) : `${fallbackLabel(skill)}・空き`;
      const desc = eff?.changed
        ? `<span class="over" title="本来: ${eff.baseText}">${eff.text}</span>`
        : describeSkill(skill, run.baseAttack);
      const inner = `<span class="lslot__key">${slotLabel(key)}</span>
        <span class="medal medal--sm">${id ? skill.icon : BASIC_ICON}</span>
        <span class="lslot__name">${name}</span>
        <span class="lslot__desc">${desc}</span>`;

      if (locked) {
        const fixed = document.createElement('div');
        fixed.className = `lslot lslot--fixed${slotLook(key, null).special ? ' lslot--special' : ''}`;
        fixed.innerHTML = inner;
        slotList.append(fixed);
        continue;
      }
      const look = slotLook(key, id ? skill : null);
      const row = document.createElement('button');
      row.className = `lslot lslot--set ${rarityClass(look.rarity)}${look.special ? ' lslot--special' : ''}${selected === key ? ' lslot--selected' : ''}${armed ? ' lslot--target' : ''}`;
      row.innerHTML = inner;
      row.addEventListener('click', () => {
        if (armed) {
          if (equipSkill(run, key, armed)) {
            audio.sfx('pick');
            armed = null;
          }
        } else {
          selected = selected === key ? null : key;
        }
        render();
      });
      slotList.append(row);
    }

    // 持ち物
    const inv = document.createElement('div');
    inv.className = 'loadout__inv';
    const invTitle = document.createElement('div');
    invTitle.className = 'loadout__inv-title';
    invTitle.textContent = `持ち物（${run.inventory.length}）`;
    inv.append(invTitle);
    const chips = document.createElement('div');
    chips.className = 'loadout__chips';
    if (run.inventory.length === 0) chips.textContent = 'なし';
    run.inventory.forEach((id) => {
      const skill = getSkill(id);
      const chip = document.createElement('button');
      chip.className = `chip ${rarityClass(rarityOfSkill(skill))}${armed === id ? ' chip--armed' : ''}`;
      chip.innerHTML = `<span class="medal medal--sm">${skill.icon}</span><span>${skill.name} ${rarityBadge(rarityOfSkill(skill))}<small>${describeSkill(skill, run.baseAttack)}</small></span>`;
      chip.addEventListener('click', () => {
        armed = armed === id ? null : id;
        selected = null;
        render();
      });
      chips.append(chip);
    });
    inv.append(chips);

    // 操作
    const actions = document.createElement('div');
    actions.className = 'loadout__actions';
    if (selected !== null && run.slots[selected] && !isSlotLocked(run, selected)) {
      const remove = document.createElement('button');
      remove.className = 'btn btn--stand loadout__btn';
      remove.innerHTML = '<span class="btn__main">外す</span>';
      remove.addEventListener('click', () => {
        if (unequipSlot(run, selected!)) audio.sfx('click');
        selected = null;
        render();
      });
      actions.append(remove);
    }
    const close = document.createElement('button');
    close.className = 'btn btn--retry loadout__btn';
    close.innerHTML = `<span class="btn__main">${armed ? 'あとでセットする' : '閉じる'}</span>`;
    close.addEventListener('click', () => {
      audio.sfx('click');
      opts.onClose();
    });
    actions.append(close);

    screen.append(head, slotList, inv, actions);
    root.replaceChildren(screen);
  };

  render();
}
