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
  /** 何もせず立ち去る（マスは済みにしない）。 */
  onLeave(): void;
}

/**
 * 祠。できることは**1 つだけ**: 入れ替え（スロット・道具袋を好きなだけ。1 つでも入れ替えたら祠を出る）・
 * バージョンアップ（候補は最大 3 つ。スキルを1つ上のレア度に。道具は不可）・祈り（ランダムな効果）。選んだら祠は済みになり、出る。
 */
export function showShrine(root: HTMLElement, run: RunState, opts: ShrineOptions): void {
  /** バージョンアップの候補（最大 3 つ。21 の会心の一撃系は、レジェンドになるまで必ず入る）。強化先のレア度の制限で置けないものは、理由つきで選べなくして出す。 */
  const upgradeCandidates = shrineUpgradeChoices(run, opts.rng);

  const choices: { icon: string; name: string; description: string; tone: 'a' | 'b' | 'c' | 'd'; run(): void }[] = [];
  choices.push({ icon: '替', tone: 'a', name: '入れ替え', description: 'スキル・道具袋の中身を、好きなだけ入れ替える（祠でできることは1つだけ。1 つでも入れ替えたら、祠を出る）', run: () => showSwapScreen(root, run, { onClose: (swapped) => (swapped ? opts.onDone('祠でスキルや道具を入れ替えた。') : show()) }) });
  if (upgradeCandidates.length > 0) choices.push({ icon: '昇', tone: 'b', name: 'バージョンアップ', description: 'ゴールドを払って、スキルを1つ上のレア度に変える（候補は最大 3 つ。会心の一撃系は必ず入る。コモン→レア 40 G、レア→レジェンド 80 G）', run: pickUpgrade });
  choices.push({ icon: '祈', tone: 'c', name: '祈る', description: '祠の力にまかせる（最大HP・全回復・スキル獲得・血の契約・呪いなど、ランダム）', run: pray });
  choices.push({ icon: '去', tone: 'd', name: '立ち去る', description: '何もしない（また来られる）', run: opts.onLeave });

  const show = (): void => showChoiceScreen(root, {
    heading: '祠', sub: 'ひとつだけ選べ',
    scene: { kind: 'shrine', line: 'ひとつだけ選べ。' },
    options: choices.map(({ icon, name, description, tone }) => ({ icon, name, description, tone })),
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
