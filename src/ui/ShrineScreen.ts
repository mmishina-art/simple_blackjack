import { slotAttack } from '../core/skills/catalog';
import { canPlaceAt, describeSkill, getSkill, placementNote, rarityOfSkill, slotLabel } from '../core/skills/Skill';
import { resolveShrine } from '../map/events';
import { upgradeCost } from '../run/shop';
import { shrineUpgradeChoices, upgradeSlot, type RunState } from '../run/Run';
import type { Rng } from '../core/util/Rng';
import { showSwapScreen } from './SwapScreen';
import { showChoiceScreen } from './ChoiceScreen';
import { openSheet } from './components/SkillSheet';

export interface ShrineOptions {
  rng: Rng;
  /** 祠で何かが起きた（マスを済みにする）。message はマップ画面に出す。 */
  onDone(message: string): void;
  /** 何もせず戻る（左上の「‹ 戻る」。マスは済みにしない）。 */
  onLeave(): void;
}

/**
 * 祠。入れ替え（スロット・道具袋を好きなだけ。何度でもでき、祠は終わらない）と、
 * 1 つだけ選べる行動: バージョンアップ（21 の会心の一撃の系統だけを育てる）・祈り（ランダムな効果）。行動を選んだら祠は済みになり、出る。
 */
export function showShrine(root: HTMLElement, run: RunState, opts: ShrineOptions): void {
  /** バージョンアップの候補（21 の会心の一撃の系統だけ。終焉の一撃まで育ったら、なし）。 */
  const upgradeCandidates = shrineUpgradeChoices(run, opts.rng);

  const choices: { icon: string; name: string; description: string; tone: 'a' | 'b' | 'c' | 'd'; run(): void }[] = [];
  choices.push({ icon: '替', tone: 'a', name: '入れ替え', description: 'スキル・道具袋の中身を、好きなだけ入れ替える（入れ替えても祠は終わらず、続けてバージョンアップや祈りを選べる）', run: () => showSwapScreen(root, run, { onClose: () => show() }) });
  if (upgradeCandidates.length > 0) choices.push({ icon: '昇', tone: 'b', name: 'バージョンアップ', description: 'ゴールドを払って、21 の会心の一撃を育てる（会心の一撃 → 覇王の一撃 → 終焉の一撃。ほかのスキルの＋は、同じスキルの合成で作る）', run: pickUpgrade });
  choices.push({ icon: '祈', tone: 'c', name: '祈る', description: '祠の力にまかせる（最大HP・全回復・スキル獲得・血の契約・呪いなど、ランダム）', run: pray });

  const show = (): void => showChoiceScreen(root, {
    heading: '祠', sub: 'ひとつだけ選べ',
    scene: { kind: 'shrine', title: '月夜の祠', line: 'ひとつだけ選べ。' },
    onBack: opts.onLeave, // 何もせず戻る（マスは済みにならない。また来られる）
    options: choices.map(({ icon, name, description, tone }) => ({ icon, name, description, tone })),
    onPick: (i) => choices[i].run(),
  });

  function pickUpgrade(): void {
    openSheet({
      title: 'バージョンアップ', subtitle: `会心の一撃を育てる（所持 ${run.gold} G）`,
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
