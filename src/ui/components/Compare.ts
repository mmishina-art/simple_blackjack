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

/** 差分の行が、良くなる(up)・悪くなる(down)・変わらない(same)のどれか。防具は、上限が下がる（硬くなる）のが良い方向。 */
function tone(line: string): 'up' | 'down' | 'same' {
  if (line.includes('硬くなる') || line.includes('（+') && !line.includes('柔らかく')) return 'up';
  if (line.includes('柔らかくなる') || line.includes('（−')) return 'down';
  return 'same';
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
    li.className = `compare__line compare__line--${tone(line)}`; // 良くなる=緑 / 悪くなる=赤 / 変わらない=灰（色だけでなく、+/−の文字もある）
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
  const note = before.id ? `「${before.name}」は失われる（上書き。道具袋には戻らない）` : undefined;
  return wrap(
    side('いま', before.name, before.icon, before.id ? medalKindClass(before.kind) : ' medal--basic', tagOf(before), before.short),
    side('セット後', after.name, after.icon, after.id ? medalKindClass(after.kind) : ' medal--basic', tagOf(after), after.short, true),
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
  return wrap(
    side('いま', before.name, before.icon, medalKindClass('armor'), kindTag(before, true), describeSkillShort(before, 0)),
    side('装備後', after.name, after.icon, medalKindClass('armor'), kindTag(after, true), describeSkillShort(after, 0), true),
    lines,
    `「${before.name}」は失われる（上書き。道具袋には戻らない）`,
  );
}

