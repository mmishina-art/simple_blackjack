import type { Entity } from '../../core/entities/Entity';
import type { EnemyDef } from '../../core/entities/enemies/EnemyDef';
import { BASIC_ICON, fallbackLabel } from '../../core/skills/Skill';
import { slotLook } from '../../core/skills/look';
import { describeSlotTable } from '../../core/skills/table';
import { rarityClass } from '../rarity';

/** 敵の ATK・特性・全スロットのスキル（実数値つき）を一覧するシート。 */
export function buildEnemyInfo(enemy: Entity, def: EnemyDef, onClose: () => void): HTMLElement {
  const sheet = document.createElement('div');
  sheet.className = 'enemy-info';
  const head = document.createElement('div');
  head.className = 'enemy-info__head';
  head.innerHTML = `<h2>${enemy.name}の技</h2><p>ATK ${enemy.attack}　HP ${enemy.maxHp}${def.trait ? `<br>特性: ${def.trait}` : ''}</p>`;
  const list = document.createElement('div');
  list.className = 'enemy-info__list';
  for (const row of describeSlotTable(enemy)) {
    const el = document.createElement('div');
    const look = slotLook(row.key, row.isFallback ? null : row.skill);
    el.className = `lslot lslot--info lslot--set ${rarityClass(look.rarity)}${look.special ? ' lslot--special' : ''}`;
    el.innerHTML = `<span class="lslot__key">${row.label}</span>
      <span class="medal medal--sm">${row.isFallback ? BASIC_ICON : row.skill.icon}</span>
      <span class="lslot__name">${row.isFallback ? fallbackLabel(row.skill) : row.skill.name}</span>
      <span class="lslot__desc">${row.text}</span>`;
    list.append(el);
  }
  const close = document.createElement('button');
  close.className = 'btn btn--retry enemy-info__close';
  close.innerHTML = '<span class="btn__main">閉じる</span>';
  close.addEventListener('click', onClose);
  sheet.append(head, list, close);
  return sheet;
}
