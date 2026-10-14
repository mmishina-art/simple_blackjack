import type { SlotTable } from '../../core/skills/Skill';
import { relicActive, type Relic } from '../../relics/Relic';
import { rarityBadge } from '../rarity';
import { buildRelicRow } from './relicMedal';
import { openSheet } from './SkillSheet';

/** レリック 1 つの説明をポップアップで出す（地図・戦闘画面のアイコンをタップしたとき）。 */
export function openRelicSheet(relic: Relic, slots: SlotTable): () => void {
  const content = document.createElement('div');
  content.className = 'relic-detail';
  content.append(buildRelicRow(relic, slots));
  if (!relicActive(relic, slots)) {
    const note = document.createElement('p');
    note.className = 'sheet__notice';
    note.textContent = 'いまは条件を満たしていないので、効果は出ていない。';
    content.append(note);
  }
  return openSheet({ title: relic.name, subtitle: `レリック・${rarityBadge(relic.rarity).replace(/<[^>]+>/g, '')}`, content, options: [], closeLabel: '閉じる' });
}
