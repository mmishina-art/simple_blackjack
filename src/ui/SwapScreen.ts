import { audio } from '../audio/AudioManager';
import { slotAttack } from '../core/skills/catalog';
import { describeSkillBonus, describeSkillShort, getSkill, isArmor, kindOfSkill, rarityOfSkill, SLOT_KEYS, slotLabel, type SlotKey } from '../core/skills/Skill';
import { canSwapSpots, isSlotLocked, spotItem, swapSpots, type RunState, type Spot } from '../run/Run';
import { effectiveSlotSkills } from '../run/effective';
import { buildSlotRow } from './components/SlotRow';
import { buildTopBar } from './components/TopBar';
import { kindTag, medalKindClass } from './kind';
import { rarityClass } from './rarity';

export interface SwapScreenOptions {
  title?: string;
  hint?: string;
  closeLabel?: string;
  hideCloseButton?: boolean;
  proceedLabel?: string;
  onClose(swapped: boolean): void;
}

/**
 * 入れ替え画面（祠・次の階層の開始時）: スキルのスロット・道具袋の中身を、好きなだけ入れ替える（回数の制限なし）。
 * 動かせない固定スロット（11 以下・21）と防御スロットは出さない。
 * 動かしたいものを**ドラッグして、入れ替え先にドロップ**（指では左のアイコンをつかむ。タップ → タップでもできる）。
 */
export function showSwapScreen(root: HTMLElement, run: RunState, opts: SwapScreenOptions): void {
  let picked: Spot | null = null; // タップで選んでいるもの
  let dragFrom: Spot | null = null; // ドラッグ中のもの
  let note = '';
  let swapped = false; // 1 つでも入れ替えたか

  const nameAt = (spot: Spot): string => (spot.kind === 'slot' ? slotLabel(spot.key) : spot.kind === 'pouch' ? '道具袋' : '防御');
  const itemName = (spot: Spot): string => { const id = spotItem(run, spot); return id ? getSkill(id).name : '空き'; };
  const same = (a: Spot, b: Spot): boolean => a.kind === b.kind && (a.kind !== 'slot' || a.key === (b as { key: SlotKey }).key);
  const spotId = (spot: Spot): string => (spot.kind === 'slot' ? `slot:${spot.key}` : spot.kind);
  const fromId = (id: string | undefined): Spot | null => (id === 'pouch' ? { kind: 'pouch' } : id?.startsWith('slot:') ? { kind: 'slot', key: Number(id.slice(5)) as SlotKey } : null);
  const held = (): Spot | null => dragFrom ?? picked;

  const move = (from: Spot, to: Spot): void => {
    const a = `${nameAt(from)}の「${itemName(from)}」`;
    const b = `${nameAt(to)}の「${itemName(to)}」`;
    if (swapSpots(run, from, to)) {
      audio.sfx('pick');
      swapped = true;
      note = `${a} と ${b} を入れ替えた。`;
    } else {
      note = `${nameAt(from)} と ${nameAt(to)} は入れ替えられない（${reason(from, to)}）`;
    }
    picked = null;
    dragFrom = null;
    render();
  };

  const tap = (spot: Spot): void => {
    if (!picked) { picked = spot; note = ''; return render(); }
    if (same(picked, spot)) { picked = null; note = ''; return render(); } // もう一度タップで解除
    move(picked, spot);
  };

  /** 入れ替えられない理由（短く）。 */
  const reason = (a: Spot, b: Spot): string => {
    const ia = spotItem(run, a);
    const ib = spotItem(run, b);
    if (!ia && !ib) return 'どちらも空き';
    return 'ここには置けない';
  };

  const flags = (spot: Spot): { picked: boolean; target: boolean; blocked: boolean; over: boolean } => {
    const h = held();
    const isPicked = !!h && same(h, spot);
    if (!h || isPicked) return { picked: isPicked && !dragFrom, target: false, blocked: false, over: false };
    const ok = canSwapSpots(run, h, spot);
    return { picked: false, target: ok, blocked: !ok, over: false };
  };

  const defaultHint = opts.hint ?? '左のアイコンをドラッグして、入れ替え先に落とす（タップ → タップでも入れ替えできる）';

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = 'loadout swap topbar-screen';
    const body = document.createElement('div');
    body.className = 'topbar-body swap__body';

    const hint = document.createElement('p');
    hint.className = 'loadout__hint';
    hint.textContent = picked ? `「${itemName(picked)}」をどこと入れ替える？（もう一度タップで解除）` : defaultHint;
    body.append(hint);

    const list = document.createElement('div');
    list.className = 'loadout__slots';
    const effective = effectiveSlotSkills(run);
    for (const key of SLOT_KEYS) {
      if (isSlotLocked(run, key)) continue; // 動かせない固定スロットは出さない
      const id = run.slots[key];
      const spot: Spot = { kind: 'slot', key };
      const f = flags(spot);
      const row = buildSlotRow({
        key, skill: id ? getSkill(id) : null, fallback: getSkill(run.fallbackSkill), atk: slotAttack(run.baseAttack, key),
        effective: effective.get(key), target: f.target, blocked: f.blocked, picked: f.picked,
        onTap: () => tap(spot),
      });
      row.dataset.spot = spotId(spot);
      list.append(row);
    }
    list.append(pouchRow()); // 道具袋は 21 のすぐ下（21 が隠れているので、末尾）。防御（防具）は基本入れ替えないので出さない
    body.append(list);

    const msg = document.createElement('p');
    msg.className = 'shop__note';
    msg.setAttribute('aria-live', 'polite');
    msg.textContent = note;
    body.append(msg);

    if (opts.proceedLabel) {
      const actions = document.createElement('div');
      actions.className = 'loadout__actions';
      const go = document.createElement('button');
      go.className = 'btn btn--primary loadout__btn';
      go.innerHTML = `<span class="btn__main">${opts.proceedLabel}</span>`;
      go.addEventListener('click', () => { audio.sfx('click'); close(); });
      actions.append(go);
      body.append(actions);
    }

    const onBack = opts.hideCloseButton ? undefined : close;
    screen.append(buildTopBar(opts.title ?? '入れ替え', onBack, opts.closeLabel ?? '戻る'), body);
    root.replaceChildren(screen);
  };

  /** 道具袋の行（装備画面と同じ見た目）。 */
  const pouchRow = (): HTMLElement => {
    const spot: Spot = { kind: 'pouch' };
    const id = spotItem(run, spot);
    const sk = id ? getSkill(id) : null;
    const f = flags(spot);
    const isEmpty = !sk;
    const row = document.createElement('button');
    row.className = `lslot lslot--set lslot--pouch${isEmpty ? ' lslot--empty' : ''} lslot--tap${f.target ? ' lslot--target' : ''}${f.blocked ? ' lslot--blocked' : ''}${f.picked ? ' lslot--picked' : ''}`;
    const medal = sk
      ? `<span class="medal medal--sm ${rarityClass(rarityOfSkill(sk))}${medalKindClass(kindOfSkill(sk))}">${sk.icon}</span>`
      : '<span class="medal medal--sm medal--empty">袋</span>';
    const desc = sk ? (isArmor(sk) ? describeSkillShort(sk, 0) : describeSkillBonus(sk)) : '';
    row.innerHTML = `<span class="lslot__key">道具袋</span>${medal}<span class="lslot__name">${sk ? `${sk.name} ${kindTag(sk)}` : '空き'}</span><span class="lslot__desc">${desc}</span><span class="lslot__go" aria-hidden="true">›</span>`;
    row.dataset.spot = spotId(spot);
    row.addEventListener('click', () => tap(spot));
    return row;
  };

  const close = (): void => { root.onpointerdown = null; root.removeEventListener('click', blockClick, true); opts.onClose(swapped); };

  // ---- ドラッグ&ドロップ（Pointer Events: マウスも指も同じ。画面を作り直しても続くよう、root に付ける） ----
  let down: { spot: Spot; x: number; y: number; id: number } | null = null;
  let ghost: HTMLElement | null = null;
  let suppressClick = false;

  const rowAt = (x: number, y: number): HTMLElement | null => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-spot]') ?? null;
  const markOver = (x: number, y: number): void => {
    const over = rowAt(x, y);
    root.querySelectorAll('.lslot--over').forEach((e) => e.classList.remove('lslot--over'));
    const to = fromId(over?.dataset.spot);
    if (over && to && dragFrom && !same(to, dragFrom) && canSwapSpots(run, dragFrom, to, { tentative: true })) over.classList.add('lslot--over');
  };
  const endDrag = (): void => {
    ghost?.remove();
    ghost = null;
    down = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };
  function onMove(e: PointerEvent): void {
    if (!down || e.pointerId !== down.id) return;
    if (!dragFrom) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return; // 動かし始めるまではタップ
      if (!spotItem(run, down.spot)) return; // 空きは持ち上げられない
      dragFrom = down.spot;
      picked = null;
      const src = rowAt(down.x, down.y);
      ghost = (src ?? document.body).cloneNode(true) as HTMLElement;
      ghost.classList.add('drag-ghost');
      ghost.style.width = `${src?.getBoundingClientRect().width ?? 300}px`;
      document.body.append(ghost);
      render();
      root.querySelector(`[data-spot="${spotId(down.spot)}"]`)?.classList.add('lslot--drag');
    }
    if (ghost) { ghost.style.left = `${e.clientX - ghost.offsetWidth / 2}px`; ghost.style.top = `${e.clientY - ghost.offsetHeight / 2}px`; }
    markOver(e.clientX, e.clientY);
  }
  function onUp(e: PointerEvent): void {
    if (!down || e.pointerId !== down.id) return;
    const from = dragFrom;
    const to = fromId(rowAt(e.clientX, e.clientY)?.dataset.spot);
    endDrag();
    if (!from) return; // 動かしていない = タップ（click で処理）
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (to && !same(from, to)) return move(from, to);
    dragFrom = null;
    render();
  }
  function onCancel(): void {
    const had = dragFrom;
    endDrag();
    dragFrom = null;
    if (had) render();
  }
  root.onpointerdown = (e: PointerEvent): void => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-spot]');
    const spot = fromId(row?.dataset.spot);
    if (!row || !spot || down || (e.pointerType === 'mouse' && e.button !== 0)) return;
    down = { spot, x: e.clientX, y: e.clientY, id: e.pointerId };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };
  const blockClick = (e: Event): void => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } };
  root.addEventListener('click', blockClick, true);

  render();
}
