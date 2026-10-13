import { describeSkillShort, diffLines, getSkill, type SkillDef } from '../../core/skills/Skill';
import type { SlotPreview } from '../../run/effective';
import { kindTag, medalKindClass } from '../kind';

function side(label: string, name: string, icon: string, kindClass: string, tag: string, short: string, after = false): HTMLElement {
  const el = document.createElement('div');
  el.className = `compare__side${after ? ' compare__side--after' : ''}`;
  el.innerHTML = `<span class="compare__label">${label}</span>
    <span class="medal${kindClass}">${icon}</span>
    <strong class="compare__name">${name}${tag ? ` ${tag}` : ''}</strong>
    <span class="compare__short">${short}</span>`;
  return el;
}

function wrap(before: HTMLElement, after: HTMLElement, lines: string[], note?: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'compare';
  const row = document.createElement('div');
  row.className = 'compare__row';
  const arrow = document.createElement('span');
  arrow.className = 'compare__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  row.append(before, arrow, after);
  const list = document.createElement('ul');
  list.className = 'compare__diff';
  list.setAttribute('role', 'status'); // 読み上げ
  for (const line of lines) {
    const li = document.createElement('li');
    li.textContent = line;
    list.append(li);
  }
  box.append(row, list);
  if (note) {
    const p = document.createElement('p');
    p.className = 'compare__note';
    p.textContent = note;
    box.append(p);
  }
  return box;
}

/** スロットにセットするときの、ビフォー（いま）とアフター（セット後）の比較。数値はレリックの補正後。 */
export function buildSlotCompare(before: SlotPreview, after: SlotPreview): HTMLElement {
  const tagOf = (p: SlotPreview): string => (p.id ? kindTag(getSkill(p.id)) : '');
  const note = before.id ? `「${before.name}」は失われる（上書き。持ち物には戻らない）` : undefined;
  return wrap(
    side('いま', before.name, before.icon, before.id ? medalKindClass(before.kind) : '', tagOf(before), before.short),
    side('セット後', after.name, after.icon, after.id ? medalKindClass(after.kind) : '', tagOf(after), after.short, true),
    diffLines(before.totals, after.totals),
    note,
  );
}

/** 防具を装備するときの、ビフォーアフターの比較。上限は小さいほど硬い。 */
export function buildArmorCompare(before: SkillDef, after: SkillDef): HTMLElement {
  const lines: string[] = [];
  const bc = before.damageCap ?? 0;
  const ac = after.damageCap ?? 0;
  lines.push(`被ダメージの上限 ${bc} → ${ac}（${ac === bc ? '変わらない' : ac < bc ? `−${bc - ac}。硬くなる` : `+${ac - bc}。柔らかくなる`}）`);
  const bh = before.defendHeal ?? 0;
  const ah = after.defendHeal ?? 0;
  if (bh !== 0 || ah !== 0) lines.push(`防御したときの回復 ${bh === 0 ? 'なし' : bh} → ${ah === 0 ? 'なし' : ah}`);
  return wrap(
    side('いま', before.name, before.icon, medalKindClass('armor'), kindTag(before, true), describeSkillShort(before, 0)),
    side('装備後', after.name, after.icon, medalKindClass('armor'), kindTag(after, true), describeSkillShort(after, 0), true),
    lines,
    `「${before.name}」は失われる（上書き。持ち物には戻らない）`,
  );
}

