import { slotAttack } from '../core/skills/catalog';
import { canPlaceAt, describeSkill, getSkill, placementNote, rarityOfSkill, SLOT_KEYS, slotLabel, type SlotKey } from '../core/skills/Skill';
import { resolveShrine } from '../map/events';
import { upgradeCost } from '../run/shop';
import { isSlotLocked, swapSlots, upgradeSlot, type RunState } from '../run/Run';
import type { Rng } from '../core/util/Rng';
import { showChoiceScreen } from './ChoiceScreen';
import { openSheet, type SheetOption } from './components/SkillSheet';

export interface ShrineOptions {
  rng: Rng;
  /** 祠で何かが起きた（マスを済みにする）。message はマップ画面に出す。 */
  onDone(message: string): void;
  /** 何もせず立ち去る（マスは済みにしない）。 */
  onLeave(): void;
}

/**
 * 祠。入れ替え（2つのスロットの中身を交換）・バージョンアップ（スキルを1つ上のレア度に。道具は不可）・
 * 祈り（従来のランダムな効果）のうち1つを選ぶ。
 */
export function showShrine(root: HTMLElement, run: RunState, opts: ShrineOptions): void {
  const movable = SLOT_KEYS.filter((k) => !isSlotLocked(run, k));
  const canSwap = movable.some((k) => run.slots[k]) && movable.length >= 2;
  /** バージョンアップの候補（強化先がある）。強化先のレア度の制限で置けないものは、理由つきで選べなくして出す。 */
  const upgradeCandidates = SLOT_KEYS.filter((k) => { const id = run.slots[k]; return !!id && !!getSkill(id).upgradesTo; });

  const choices: { icon: string; name: string; description: string; run(): void }[] = [];
  if (canSwap) choices.push({ icon: '替', name: '入れ替え', description: '2つのスロットのスキル・道具を入れ替える（空きスロットへの移動もできる）', run: pickSwapFirst });
  if (upgradeCandidates.length > 0) choices.push({ icon: '昇', name: 'バージョンアップ', description: 'ゴールドを払って、スキルを1つ上のレア度に変える（コモン→レア 40 G、レア→レジェンド 80 G。会心の一撃は、レジェンドの中でも 60 G で育つ。道具は不可）', run: pickUpgrade });
  choices.push({ icon: '祈', name: '祈る', description: '祠の力にまかせる（最大HP・全回復・スキル獲得・血の契約・呪いなど、ランダム）', run: pray });
  choices.push({ icon: '去', name: '立ち去る', description: '何もしない（また来られる）', run: opts.onLeave });

  const show = (): void => showChoiceScreen(root, {
    heading: '祠', sub: 'ひとつ選べ',
    options: choices.map(({ icon, name, description }) => ({ icon, name, description })),
    onPick: (i) => choices[i].run(),
  });

  const slotOption = (key: SlotKey, onPick: () => void, blockedNote?: string): SheetOption => {
    const id = run.slots[key];
    const skill = id ? getSkill(id) : null;
    return {
      icon: skill?.icon ?? '空', name: `${slotLabel(key)}　${skill?.name ?? '通常攻撃（空き）'}`,
      detail: skill ? describeSkill(skill, slotAttack(run.baseAttack, key)) : '何も置いていない',
      rarity: skill ? rarityOfSkill(skill) : undefined, onPick,
      disabled: !!blockedNote, note: blockedNote,
    };
  };

  function pickSwapFirst(): void {
    openSheet({
      title: '入れ替え（1つ目）', subtitle: '動かすスロットを選ぶ',
      options: movable.filter((k) => run.slots[k]).map((k) => slotOption(k, () => pickSwapSecond(k))),
      onClose: show,
    });
  }

  function pickSwapSecond(a: SlotKey): void {
    const nameA = getSkill(run.slots[a]!).name;
    openSheet({
      title: '入れ替え（2つ目）', subtitle: `「${nameA}」（${slotLabel(a)}）と入れ替えるスロットを選ぶ`,
      options: movable.filter((k) => k !== a).map((k) => {
        // 入れ替えたあとの場所が、レア度の制限に合わないときは選べない
        const skillA = getSkill(run.slots[a]!);
        const idB = run.slots[k];
        const why = !canPlaceAt(skillA, k) ? `「${skillA.name}」は ${placementNote(skillA)}`
          : idB && !canPlaceAt(getSkill(idB), a) ? `「${getSkill(idB).name}」は ${placementNote(getSkill(idB))}` : undefined;
        return slotOption(k, () => {
          swapSlots(run, a, k);
          opts.onDone(`${slotLabel(a)} と ${slotLabel(k)} を入れ替えた。`);
        }, why);
      }),
      onClose: pickSwapFirst,
    });
  }

  function pickUpgrade(): void {
    openSheet({
      title: 'バージョンアップ', subtitle: '強くするスキルを選ぶ',
      options: upgradeCandidates.map((k) => {
        const from = getSkill(run.slots[k]!);
        const to = getSkill(from.upgradesTo!);
        const blocked = !canPlaceAt(to, k);
        const cost = upgradeCost(from.id)!;
        const poor = run.gold < cost;
        return {
          disabled: blocked || poor,
          badge: `${cost} G`,
          note: blocked ? `「${to.name}」は ${placementNote(to)}。先に入れ替えで、高いスロットへ動かす` : poor ? `ゴールドが足りない（所持 ${run.gold} G）` : undefined,
          icon: to.icon, name: `${slotLabel(k)}　${from.name} → ${to.name}`,
          detail: describeSkill(to, slotAttack(run.baseAttack, k)), rarity: rarityOfSkill(to),
          onPick() {
            if (run.gold < cost || !upgradeSlot(run, k)) return;
            run.gold -= cost;
            opts.onDone(`「${from.name}」が「${to.name}」にバージョンアップした（-${cost} G）。`);
          },
        };
      }),
      onClose: show,
    });
  }

  function pray(): void {
    const result = resolveShrine(run, opts.rng);
    opts.onDone(`${result.title}：${result.text}`);
  }

  show();
}
