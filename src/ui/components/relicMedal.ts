import { relicActive, type Relic } from '../../relics/Relic';
import type { SlotTable } from '../../core/skills/Skill';
import { openRelicSheet } from './RelicSheet';
import { rarityClass, rarityNote } from '../rarity';

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

/** タップすると、そのレリックの説明が出るボタン（地図・戦闘画面の、所持レリックの並び）。見た目は 24px のまま、タップできる範囲を広げてある。 */
export function relicButton(r: Relic, slots: SlotTable): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'relic-btn';
  b.append(relicMedal(r, slots));
  b.setAttribute('aria-label', `${r.name}${relicActive(r, slots) ? '' : '（いまは効果なし）'}の説明を見る`);
  b.addEventListener('click', () => openRelicSheet(r, slots));
  return b;
}

/** レア度の高い順に並べたレリック（レジェンド → レア → コモン。同じレア度は、持った順）。 */
export function relicsByRarityDesc(relics: readonly Relic[]): Relic[] {
  const order = { legend: 0, rare: 1, common: 2 } as const;
  return relics.map((r, i) => ({ r, i })).sort((a, b) => order[a.r.rarity ?? 'common'] - order[b.r.rarity ?? 'common'] || a.i - b.i).map((x) => x.r);
}

/** レリックの 1 行（装備画面のレリックの一覧）: アイコン・名前・レア度・効果。効果が出ていないときは、その旨も出す。 */
export function buildRelicRow(r: Relic, slots: SlotTable): HTMLElement {
  const active = relicActive(r, slots);
  const row = document.createElement('div');
  row.className = `relic-row ${rarityClass(r.rarity)}${active ? '' : ' relic-row--idle'}`;
  row.append(relicMedal(r, slots));
  const text = document.createElement('span');
  text.className = 'relic-row__text';
  text.innerHTML = `<strong>${r.name} ${rarityNote(r.rarity)}${active ? '' : ' <em class="relic-row__idle">いまは効果なし</em>'}</strong><small>${r.description}</small>`;
  row.append(text);
  return row;
}
