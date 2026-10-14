import { relicActive, type Relic } from '../../relics/Relic';
import type { SlotTable } from '../../core/skills/Skill';
import { rarityClass } from '../rarity';

/**
 * 所持レリックのメダリオン。条件つきのレリック（満杯の指輪など）は、効果が出ていないあいだ、
 * グレーで、枠が点線になる（色だけで伝えない）。タップ（ホバー）の説明にも「いまは効果なし」と出る。
 */
export function relicMedal(r: Relic, slots: SlotTable): HTMLElement {
  const active = relicActive(r, slots);
  const m = document.createElement('span');
  m.className = `medal medal--sm ${rarityClass(r.rarity)}${active ? '' : ' medal--idle'}`;
  m.textContent = r.icon;
  const note = active ? '' : '（いまは効果なし）';
  m.title = `${r.name}${note}: ${r.description}`;
  m.setAttribute('aria-label', `${r.name}${note}`);
  return m;
}
