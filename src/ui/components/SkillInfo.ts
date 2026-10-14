import { describeSkill, kindOfSkill, placementNote, rarityOfSkill, type SkillDef } from '../../core/skills/Skill';
import { kindTag, medalKindClass } from '../kind';
import { rarityBadge, rarityClass } from '../rarity';
import { openSheet } from './SkillSheet';

export interface SkillInfoOptions {
  /** そのスロットの基本パワー（POW）。あれば、計算式といっしょに実数値を出す。 */
  atk?: number;
  /** どのスロットの話か（例: 「15 のスロット」「防御」）。 */
  where?: string;
  /** 補足（例: 「防御したラウンドに受けるダメージの上限」）。 */
  note?: string;
}

/** スキル・道具・防具 1 つの説明をポップアップで出す（装備画面のアイコンをタップしたとき）。 */
export function openSkillInfo(skill: SkillDef, opts: SkillInfoOptions = {}): () => void {
  const content = document.createElement('div');
  content.className = 'relic-detail';
  const row = document.createElement('div');
  row.className = `relic-row ${rarityClass(rarityOfSkill(skill))}`;
  const where = placementNote(skill);
  row.innerHTML = `<span class="medal${medalKindClass(kindOfSkill(skill))}">${skill.icon}</span>
    <span class="relic-row__text"><strong>${skill.name} ${kindTag(skill)} ${rarityBadge(rarityOfSkill(skill))}</strong>
    <small>${describeSkill(skill, opts.atk)}</small>${where ? `<small>${where}</small>` : ''}${opts.note ? `<small>${opts.note}</small>` : ''}</span>`;
  content.append(row);
  return openSheet({ title: skill.name, subtitle: opts.where, content, options: [], closeLabel: '閉じる' });
}
