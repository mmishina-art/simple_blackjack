import { audio } from '../audio/AudioManager';
import { slotAttack } from '../core/skills/catalog';
import { describeSkillBonus, describeSkillShort, getSkill, isArmor, kindOfSkill, placementNote, rarityOfSkill, SLOT_KEYS, slotLabel, type SlotKey } from '../core/skills/Skill';
import { canSwapSpots, isSlotLocked, spotItem, swapSpots, type RunState, type Spot } from '../run/Run';
import { effectiveSlotSkills } from '../run/effective';
import { buildSlotRow } from './components/SlotRow';
import { buildTopBar } from './components/TopBar';
import { kindTag, medalKindClass } from './kind';
import { rarityClass } from './rarity';

/**
 * 祠の入れ替え画面: スキルのスロット・道具袋・防御スロットの中身を、好きなだけ入れ替える（回数の制限なし）。
 * 動かしたいものをタップ → 入れ替え先をタップ、を何度でも繰り返し、終わったら左上の「戻る」。
 * 選ぶと、入れ替えられる行が光り、できない行は薄くなる（固定スロット・レア度の制限・防具は防具の場所だけ）。
 */
export function showSwapScreen(root: HTMLElement, run: RunState, opts: { onClose(): void }): void {
  let picked: Spot | null = null;
  let note = '';

  const nameAt = (spot: Spot): string => (spot.kind === 'slot' ? slotLabel(spot.key) : spot.kind === 'pouch' ? '道具袋' : '防御');
  const itemName = (spot: Spot): string => { const id = spotItem(run, spot); return id ? getSkill(id).name : '空き'; };

  const tap = (spot: Spot): void => {
    if (spot.kind === 'slot' && isSlotLocked(run, spot.key)) { note = `${slotLabel(spot.key)} は固定スロットで、動かせない`; return render(); }
    if (!picked) { picked = spot; note = ''; return render(); }
    if (picked.kind === spot.kind && (picked.kind !== 'slot' || picked.key === (spot as { key: SlotKey }).key)) { picked = null; note = ''; return render(); } // もう一度タップで解除
    const from = picked;
    const a = `${nameAt(from)}の「${itemName(from)}」`;
    const b = `${nameAt(spot)}の「${itemName(spot)}」`;
    if (swapSpots(run, from, spot)) {
      audio.sfx('pick');
      note = `${a} と ${b} を入れ替えた。`;
      picked = null;
    } else {
      note = `${nameAt(from)} と ${nameAt(spot)} は入れ替えられない（${reason(from, spot)}）`;
    }
    render();
  };

  /** 入れ替えられない理由（短く）。 */
  const reason = (a: Spot, b: Spot): string => {
    const ia = spotItem(run, a);
    const ib = spotItem(run, b);
    if (!ia && !ib) return 'どちらも空き';
    for (const [spot, id] of [[a, ib], [b, ia]] as const) {
      if (id && spot.kind === 'slot' && isArmor(getSkill(id))) return '防具は防御スロットだけ';
      if (id && spot.kind === 'slot') { const n = placementNote(getSkill(id)); if (n) return `「${getSkill(id).name}」は ${n}`; }
      if (spot.kind === 'armor') return '防御スロットには防具だけ置ける。空きにもできない';
    }
    return 'ここには置けない';
  };

  const flags = (spot: Spot): { picked: boolean; target: boolean; blocked: boolean } => {
    const isPicked = !!picked && picked.kind === spot.kind && (picked.kind !== 'slot' || picked.key === (spot as { key: SlotKey }).key);
    if (!picked || isPicked) return { picked: isPicked, target: false, blocked: false };
    const ok = canSwapSpots(run, picked, spot);
    return { picked: false, target: ok, blocked: !ok };
  };

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = 'loadout swap topbar-screen';
    const body = document.createElement('div');
    body.className = 'topbar-body swap__body';

    const hint = document.createElement('p');
    hint.className = 'loadout__hint';
    hint.textContent = picked ? `「${itemName(picked)}」をどこと入れ替える？（もう一度タップで解除）` : '動かしたいものをタップ → 入れ替え先をタップ。何度でも入れ替えられる';
    body.append(hint);

    const list = document.createElement('div');
    list.className = 'loadout__slots';
    const effective = effectiveSlotSkills(run);
    for (const key of SLOT_KEYS) {
      const id = run.slots[key];
      const spot: Spot = { kind: 'slot', key };
      const f = flags(spot);
      list.append(buildSlotRow({
        key, skill: id ? getSkill(id) : null, fallback: getSkill(run.fallbackSkill), atk: slotAttack(run.baseAttack, key),
        locked: isSlotLocked(run, key), effective: effective.get(key), target: f.target, blocked: f.blocked, picked: f.picked,
        onTap: () => tap(spot),
      }));
    }
    list.append(armorRow(), pouchRow());
    body.append(list);

    const msg = document.createElement('p');
    msg.className = 'shop__note';
    msg.setAttribute('aria-live', 'polite');
    msg.textContent = note;
    body.append(msg);

    screen.append(buildTopBar('入れ替え', opts.onClose), body);
    root.replaceChildren(screen);
  };

  /** 防御スロットと道具袋の行（装備画面と同じ見た目）。 */
  const extraRow = (spot: Spot, cls: string, key: string, empty: string): HTMLElement => {
    const id = spotItem(run, spot);
    const sk = id ? getSkill(id) : null;
    const f = flags(spot);
    const row = document.createElement('button');
    row.className = `lslot lslot--set ${cls} lslot--tap${f.target ? ' lslot--target' : ''}${f.blocked ? ' lslot--blocked' : ''}${f.picked ? ' lslot--picked' : ''}`;
    const medal = sk
      ? `<span class="medal medal--sm ${rarityClass(rarityOfSkill(sk))}${medalKindClass(kindOfSkill(sk))}">${sk.icon}</span>`
      : `<span class="medal medal--sm medal--empty">${spot.kind === 'pouch' ? '袋' : '空'}</span>`;
    const desc = sk ? (isArmor(sk) ? describeSkillShort(sk, 0) : describeSkillBonus(sk)) : '';
    row.innerHTML = `<span class="lslot__key">${key}</span>${medal}<span class="lslot__name">${sk ? `${sk.name} ${kindTag(sk)}` : empty}</span><span class="lslot__desc">${desc}</span><span class="lslot__go" aria-hidden="true">›</span>`;
    row.addEventListener('click', () => tap(spot));
    return row;
  };
  const armorRow = (): HTMLElement => extraRow({ kind: 'armor' }, 'lslot--armor', '防御', '');
  const pouchRow = (): HTMLElement => extraRow({ kind: 'pouch' }, 'lslot--pouch', '道具袋', '空き');

  render();
}
