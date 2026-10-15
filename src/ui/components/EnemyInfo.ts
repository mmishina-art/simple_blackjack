import type { Entity } from '../../core/entities/Entity';
import type { EnemyDef } from '../../core/entities/enemies/EnemyDef';
import { createRuleSet } from '../../core/rules/RuleSet';
import { BASIC_ICON, describeSkillShort, fallbackLabel, SLOT_MAX } from '../../core/skills/Skill';
import { effectTone, slotLook } from '../../core/skills/look';
import { describeSlotTable } from '../../core/skills/table';
import { enemyLevel, hitsToDefeat } from '../../core/entities/enemies/level';
import { rarityClass } from '../rarity';

/** 敵の LV・特性・全スロットのスキル（実数値つき）を一覧するシート。 */
export function buildEnemyInfo(enemy: Entity, def: EnemyDef, playerHp: number, onClose: () => void): HTMLElement {
  const lv = enemyLevel(def);
  const sheet = document.createElement('div');
  sheet.className = 'enemy-info';
  const head = document.createElement('div');
  head.className = 'enemy-info__head';
  head.innerHTML = `<h2>${enemy.name}の技</h2><p>LV ${lv}　HP ${enemy.maxHp}<br>1回の攻撃で平均 ${lv} ダメージ（あなたの HP ${playerHp} なら、約 ${hitsToDefeat(playerHp, lv)} 回で倒れる）${def.trait ? `<br>特性: ${def.trait}` : ''}</p>`;
  const list = buildEnemySkillList(enemy, def.ai.standOn);
  const close = document.createElement('button');
  close.className = 'btn btn--retry enemy-info__close';
  close.innerHTML = '<span class="btn__main">閉じる</span>';
  close.addEventListener('click', onClose);
  sheet.append(head, list, close);
  return sheet;
}

/**
 * 敵のスロットのスキル（実際の攻撃値つき。POW は出さない）の一覧。戦闘中の「技」シートと、マップの敵の詳細で使う。
 * standOn 未満の合計では、敵はカードを引き続けて手札が確定しないので、その数字の行は出さない。
 */
export function buildEnemySkillList(enemy: Entity, standOn = 0): HTMLElement {
  const list = document.createElement('div');
  list.className = 'enemy-info__list';
  for (const row of describeSlotTable(enemy).filter((r) => r.key >= standOn)) {
    const el = document.createElement('div');
    const look = slotLook(row.key, row.isFallback ? null : row.skill);
    const fatal = !row.isFallback && row.skill.fatal;
    const is21 = row.key === SLOT_MAX;
    const rarity = is21 ? 'legend' : look.rarity;
    const mult21 = createRuleSet().enemy21Multiplier;
    const die = is21 && row.skill.effects.some((e) => e.type === 'attack');
    // 役割の色: 攻撃はオレンジ（アイコンだけ）、ブロックは青、回復は緑。21 はレジェンド色枠
    const tone = !is21 && !fatal ? effectTone(row.skill) ?? 'attack' : null;
    const short = describeSkillShort(row.skill, enemy.attackAt(row.key));
    const desc = die ? `${short.replace(/攻撃 (\d+)/, (_, n: string) => `攻撃 ${Number(n) * mult21}`)} <em class="die-tag" title="21 は攻撃 ${mult21} 倍">必殺</em>` : short;
    el.className = `lslot lslot--info lslot--set ${rarityClass(rarity)}${fatal ? ' lslot--fatal' : ''}${tone ? ` lslot--tone-${tone}` : ''}`;
    // 危険な合計値は、赤い印と「危険」の文字で示す（色だけに頼らない）。21 は「必殺」（攻撃 2 倍）
    el.innerHTML = `<span class="lslot__key">${row.label}</span>
      <span class="medal medal--sm">${row.isFallback ? BASIC_ICON : row.skill.icon}</span>
      <span class="lslot__name">${row.isFallback ? fallbackLabel(row.skill) : row.skill.name}${fatal ? ' <em class="fatal-tag">危険</em>' : ''}</span>
      <span class="lslot__desc">${desc}</span>`;
    list.append(el);
  }
  return list;
}
