import { audio } from '../audio/AudioManager';
import { slotAttack } from '../core/skills/catalog';
import { canPlaceAt, describeSkill, describeSkillBonus, describeSkillShort, placementNote, getSkill, isArmor, KIND_LABEL, kindOfSkill, rarityOfSkill, SLOT_KEYS, slotLabel, type SkillId, type SkillKind } from '../core/skills/Skill';
import { effectiveSlotSkills } from '../run/effective';
import { inventoryEntries } from '../run/loadout';
import { previewSlot } from '../run/effective';
import { buildArmorCompare, buildSlotCompare } from './components/Compare';
import { sellFromInventory, sellPrice } from '../run/shop';
import { equipArmor, equipSkill, isSlotLocked, type RunState } from '../run/Run';
import { buildSlotRow } from './components/SlotRow';
import { openSheet, type SheetOption } from './components/SkillSheet';
import { kindTag, medalKindClass } from './kind';
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
const KINDS: readonly SkillKind[] = ['skill', 'item', 'armor'];

export function showLoadout(root: HTMLElement, run: RunState, opts: LoadoutOptions): void {
  let armed: SkillId | null = opts.armed && run.inventory.includes(opts.armed) ? opts.armed : null;

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = `loadout${armed ? ' loadout--armed' : ''}`;

    const head = document.createElement('header');
    head.className = 'loadout__head';
    head.innerHTML = `<h1>編成</h1>
      <p class="loadout__hint">${armed ? (isArmor(getSkill(armed)) ? '防具の欄をタップして装備' : placementNote(getSkill(armed)) ? `置きたいスロットをタップ（${placementNote(getSkill(armed))}）` : '置きたいスロットをタップ') : 'スロットをタップして、持ち物を置く（上書きのみ。置き換えた元のものは失われる）'}</p>`;
    screen.append(head);

    if (armed) {
      const skill = getSkill(armed);
      const banner = document.createElement('div');
      banner.className = `armed ${rarityClass(rarityOfSkill(skill))}`;
      banner.innerHTML = `<span class="medal${medalKindClass(kindOfSkill(skill))}">${skill.icon}</span>
        <span class="armed__text"><strong>${skill.name} ${kindTag(skill, true)} ${rarityBadge(rarityOfSkill(skill))}</strong><span>${describeSkillBonus(skill)}${placementNote(skill) ? `<br>${placementNote(skill)}` : ''}</span></span>`;
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
        atk: slotAttack(run.baseAttack, key),
        locked,
        effective: effective.get(key),
        target: !!armed && !isArmor(getSkill(armed)) && !locked && canPlaceAt(getSkill(armed), key),
        blocked: !!armed && !isArmor(getSkill(armed)) && !canPlaceAt(getSkill(armed), key),
        after: armed && !isArmor(getSkill(armed)) && !locked && canPlaceAt(getSkill(armed), key) ? previewSlot(run, key, armed).short : undefined,
        onTap: () => {
          if (armed && isArmor(getSkill(armed))) return; // 防具は、下の防具の欄に装備する
          if (armed && !canPlaceAt(getSkill(armed), key)) return; // レア度の制限: ここには置けない
          if (armed) {
            const skill = getSkill(armed);
            confirmPlace(key, armed, () => {
              if (equipSkill(run, key, skill.id)) {
                audio.sfx('pick');
                opts.onClose(`「${skill.name}」を ${slotLabel(key)} にセットした。`);
              }
            });
            return;
          }
          openPicker(key);
        },
      }));
    }
    slotList.append(buildArmorRow());
    screen.append(slotList);

    // 持ち物（表示のみ。置くときはスロットをタップする）。セット待ちのときは上のバナーに集中させるため隠す
    const inv = document.createElement('div');
    inv.className = 'loadout__inv';
    inv.innerHTML = `<div class="loadout__inv-title">持ち物（${run.inventory.length}）　<span class="loadout__gold">${run.gold} G</span>　タップで売る</div>`;
    const chips = document.createElement('div');
    chips.className = 'loadout__chips';
    if (entries.length === 0) chips.textContent = 'なし（敵を倒すとスキル・道具が手に入る）';
    // スキルと道具に分けて並べる
    for (const kind of KINDS) {
      const label = KIND_LABEL[kind];
      const group = entries.filter((e) => kindOfSkill(getSkill(e.id)) === kind);
      if (group.length === 0) continue;
      const h = document.createElement('div');
      h.className = 'loadout__kind';
      h.textContent = label;
      chips.append(h);
      for (const e of group) {
        const skill = getSkill(e.id);
        const chip = document.createElement('button');
        chip.className = 'chip'; // 枠は同じ。レア度はアイコンだけで示す。タップで売る
        chip.title = `売る（${sellPrice(e.id)} G）`;
        chip.addEventListener('click', () => openSheet({
          title: `「${skill.name}」を売る？`,
          subtitle: `${sellPrice(e.id)} G で売れる（所持 ${run.gold} G）。売ったものは戻らない`,
          options: [{ kind: 'confirm', icon: '売', name: `売る（+${sellPrice(e.id)} G）`, detail: describeSkillBonus(skill), onPick() { if (sellFromInventory(run, e.id) !== null) { audio.sfx('click'); render(); } } }],
        }));
        chip.innerHTML = `<span class="medal medal--sm ${rarityClass(rarityOfSkill(skill))}${medalKindClass(kind)}">${skill.icon}</span><span>${skill.name}${e.count > 1 ? ` ×${e.count}` : ''}<small>${describeSkillBonus(skill)}</small></span>`;
        chips.append(chip);
      }
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

  /** 防御スロット（防具）の行。防御したラウンドの被ダメージ上限は、装備している防具で決まる。 */
  function buildArmorRow(): HTMLElement {
    const cur = getSkill(run.armor);
    const target = !!armed && isArmor(getSkill(armed));
    const row = document.createElement('button');
    row.title = `${cur.name}\n${describeSkill(cur)}\n防御したラウンドに受けるダメージ（HP の減少）の上限`;
    row.className = `lslot lslot--set lslot--armor lslot--tap ${rarityClass(rarityOfSkill(cur))}${target ? ' lslot--target' : ''}`;
    row.innerHTML = `<span class="lslot__key">防御</span>
      <span class="medal medal--sm medal--armor">${cur.icon}</span>
      <span class="lslot__name">${cur.name} ${kindTag(cur, true)}</span>
      <span class="lslot__desc">${describeSkillShort(cur, 0)}${target ? ` → <strong class="lslot__after">${describeSkillShort(getSkill(armed!), 0)}</strong>` : ''}</span>
      <span class="lslot__go" aria-hidden="true">›</span>`;
    row.addEventListener('click', () => {
      if (armed && isArmor(getSkill(armed))) {
        const id = armed;
        return confirmArmor(id, () => {
          if (equipArmor(run, id)) {
            audio.sfx('pick');
            opts.onClose(`「${getSkill(id).name}」を装備した。`);
          }
        });
      }
      openArmorPicker();
    });
    return row;
  }

  /** 防具を装備する前の確認。ビフォーアフターを見せて、選ばせる。 */
  const confirmArmor = (id: SkillId, done: () => void): void => {
    const cur = getSkill(run.armor);
    const next = getSkill(id);
    openSheet({
      title: `「${next.name}」を装備する？`,
      subtitle: '防御スロットは上書きのみ',
      content: buildArmorCompare(cur, next),
      options: [{ kind: 'confirm', icon: '装', name: '装備する', detail: `${cur.name} → ${next.name}`, onPick: done }],
    });
  };

  const openArmorPicker = (): void => {
    const cur = getSkill(run.armor);
    const options: SheetOption[] = inventoryEntries(run)
      .filter((e) => isArmor(getSkill(e.id)))
      .map((e) => {
        const a = getSkill(e.id);
        return {
          icon: a.icon, name: a.name, rarity: rarityOfSkill(a), skillKind: 'armor' as const,
          detail: `${describeSkillShort(cur, 0)} → ${describeSkillShort(a, 0)}`,
          note: describeSkill(a),
          onPick() { confirmArmor(e.id, () => { if (equipArmor(run, e.id)) render(); }); },
        };
      });
    openSheet({
      title: '防御スロット（防具）',
      subtitle: `いま: ${cur.name}（${describeSkill(cur)}）`,
      options,
      empty: '持ち物に防具がない。敵を倒すと手に入ることがある。',
    });
  };

  /** セットする前の確認: ビフォーアフターを見せて、選ばせる（空きスロットでも、上書きでも）。 */
  const confirmPlace = (key: number, id: SkillId, done: () => void): void => {
    const before = previewSlot(run, key, run.slots[key] ?? null);
    const after = previewSlot(run, key, id);
    openSheet({
      title: `${slotLabel(key)} に「${after.name}」を置く？`,
      subtitle: `このスロットの基本値（ATK）は ${after.atk}`,
      content: buildSlotCompare(before, after),
      options: [{ kind: 'confirm', icon: '置', name: 'セットする', detail: `${before.short} → ${after.short}`, onPick: done }],
    });
  };

  /** スロットをタップしたときに開く、置くスキルの選択シート。 */
  const openPicker = (key: number): void => {
    const currentId = run.slots[key];
    const current = currentId ? getSkill(currentId) : null;
    const options: SheetOption[] = [];
    const now = previewSlot(run, key, currentId ?? null);
    const entries = inventoryEntries(run);
    for (const kind of ['skill', 'item'] as const) {
      for (const e of entries.filter((x) => kindOfSkill(getSkill(x.id)) === kind)) {
        const skill = getSkill(e.id);
        options.push({
          icon: skill.icon, name: skill.name, rarity: rarityOfSkill(skill), section: KIND_LABEL[kind], skillKind: kind,
          detail: `${now.short} → ${previewSlot(run, key, e.id).short}`,
          badge: e.count > 1 ? `×${e.count}` : undefined,
          disabled: !canPlaceAt(skill, key),
          note: !canPlaceAt(skill, key) ? placementNote(skill) : current ? `いまの「${current.name}」は失われる（上書き）` : undefined,
          onPick() { confirmPlace(key, e.id, () => { if (equipSkill(run, key, e.id)) render(); }); },
        });
      }
    }
    openSheet({
      title: `${slotLabel(key)} のスロット`,
      subtitle: `いま: ${now.name}（${now.short}）　選ぶと、セット後の変化を確認できる`,
      options,
      empty: '置けるものがない。敵を倒すとスキルや道具が手に入る。',
    });
  };

  render();
}
