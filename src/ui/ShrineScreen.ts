import { slotAttack } from '../core/skills/catalog';
import { canPlaceAt, describeSkill, getSkill, placementNote, rarityOfSkill, SLOT_KEYS, slotLabel } from '../core/skills/Skill';
import { resolveShrine } from '../map/events';
import { upgradeCost } from '../run/shop';
import { upgradeSlot, type RunState } from '../run/Run';
import type { Rng } from '../core/util/Rng';
import { showSwapScreen } from './SwapScreen';
import { showChoiceScreen } from './ChoiceScreen';
import { openSheet } from './components/SkillSheet';

export interface ShrineOptions {
  rng: Rng;
  /** 祠で何かが起きた（マスを済みにする）。message はマップ画面に出す。 */
  onDone(message: string): void;
  /** 何もせず立ち去る（マスは済みにしない）。 */
  onLeave(): void;
}

/**
 * 祠。入れ替え（スロット・道具袋・防具を好きなだけ。回数の制限なし。済んでも祠は使える）・
 * バージョンアップ（スキルを1つ上のレア度に。道具は不可）・祈り（ランダムな効果）。入れ替え以外は、1 つ選ぶと祠は済みになる。
 */
export function showShrine(root: HTMLElement, run: RunState, opts: ShrineOptions): void {
  /** バージョンアップの候補（強化先がある）。強化先のレア度の制限で置けないものは、理由つきで選べなくして出す。 */
  const upgradeCandidates = SLOT_KEYS.filter((k) => { const id = run.slots[k]; return !!id && !!getSkill(id).upgradesTo; });

  const choices: { icon: string; name: string; description: string; run(): void }[] = [];
  choices.push({ icon: '替', name: '入れ替え', description: 'スキル・道具・道具袋・防具を、好きなだけ入れ替える（何度でも。済んでも、祠はまた使える）', run: () => showSwapScreen(root, run, { onClose: show }) });
  if (upgradeCandidates.length > 0) choices.push({ icon: '昇', name: 'バージョンアップ', description: 'ゴールドを払って、スキルを1つ上のレア度に変える（コモン→レア 40 G、レア→レジェンド 80 G。道具は不可）', run: pickUpgrade });
  choices.push({ icon: '祈', name: '祈る', description: '祠の力にまかせる（最大HP・全回復・スキル獲得・血の契約・呪いなど、ランダム）', run: pray });
  choices.push({ icon: '去', name: '立ち去る', description: '何もしない（また来られる）', run: opts.onLeave });

  const show = (): void => showChoiceScreen(root, {
    heading: '祠', sub: 'ひとつ選べ',
    options: choices.map(({ icon, name, description }) => ({ icon, name, description })),
    onPick: (i) => choices[i].run(),
  });

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
