import { Entity } from '../../core/entities/Entity';
import { getEnemy } from '../../core/entities/enemies/catalog';
import { enemyLevel } from '../../core/entities/enemies/level';
import { ELEMENT_LABEL, getSkill } from '../../core/skills/Skill';
import { dropChances, type RunState } from '../../run/Run';
import { rarityClass } from '../rarity';
import { rarityOfSkill } from '../../core/skills/Skill';
import { enemyArtHtml } from './enemyArt';
import { buildEnemySkillList } from './EnemyInfo';
import { openSheet } from './SkillSheet';
import { isDebug } from '../../debug';

/**
 * マップで敵のマスをタップしたときの詳細（姿・LV・HP・特性・技・落とし物）。
 * canGo のときは「進む」を出す（押すと onGo）。
 * ボスは、一度倒して図鑑に載るまで（デバッグモード時を除き）シルエットと「？？？」で詳細を伏せる。
 */
export function openMonsterSheet(enemyId: string, opts: { run: RunState; boss: boolean; canGo: boolean; onGo(): void }): void {
  const def = getEnemy(enemyId);
  const unknown = opts.boss && !isDebug() && !(opts.run.knownEnemies ?? []).includes(enemyId);
  const enemy = new Entity('enemy', def.name, def.maxHp, { ...def.slots }, def.fallbackSkill, def.attack);
  const content = document.createElement('div');
  content.className = `monster-sheet${unknown ? ' codex__item--unknown monster-sheet--silhouette' : ''}`;

  const top = document.createElement('div');
  top.className = 'monster-sheet__top';
  const sprite = document.createElement('div');
  sprite.className = 'codex__sprite monster-sheet__sprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.innerHTML = enemyArtHtml(enemyId);
  const facts = document.createElement('div');
  facts.className = 'monster-sheet__facts';
  const stats = document.createElement('strong');
  stats.textContent = unknown ? 'LV ？　HP ？' : `LV ${enemyLevel(def)}　HP ${def.maxHp}`;
  facts.append(stats);
  if (unknown) {
    const trait = document.createElement('small');
    trait.textContent = '未討伐（一度倒して図鑑に載ると詳細が見える）';
    facts.append(trait);
  } else {
    if (def.weakness || def.attackElement) {
      const elemInfo = document.createElement('small');
      const parts = [
        def.weakness ? `弱点: ${ELEMENT_LABEL[def.weakness]}` : '',
        def.attackElement ? `攻撃属性: ${ELEMENT_LABEL[def.attackElement]}` : '',
      ].filter(Boolean);
      elemInfo.textContent = parts.join('　');
      facts.append(elemInfo);
    }
    if (def.trait) {
      const trait = document.createElement('small');
      trait.textContent = `特性: ${def.trait}`;
      facts.append(trait);
    }
  }
  top.append(sprite, facts);

  const drops = document.createElement('div');
  drops.className = 'monster-sheet__drops';
  if (opts.boss) {
    drops.textContent = '落とし物: 階層を踏破すると、遺物を3つから1つ選べる';
  } else {
    // 効果は伏せて、名前と、落とし物のなかでの出やすさ（%）だけ見せる。レア度は色（枠・アイコン）で示す
    const label = document.createElement('span');
    label.className = 'drops__label';
    label.textContent = '落とし物（出やすさ）';
    const chips = document.createElement('div');
    chips.className = 'drops';
    for (const { id, percent } of dropChances(opts.run, enemyId)) {
      const sk = getSkill(id);
      const chip = document.createElement('span');
      chip.className = `drop ${rarityClass(rarityOfSkill(sk))}`;
      chip.innerHTML = `<span class="medal medal--sm">${sk.icon}</span><span class="drop__name"></span><b class="drop__pct">${percent}%</b>`;
      chip.querySelector('.drop__name')!.textContent = sk.name;
      chips.append(chip);
    }
    drops.append(label, chips);
  }

  content.append(top, drops);
  if (!unknown) content.append(buildEnemySkillList(enemy, def.ai.standOn));

  openSheet({
    title: opts.boss ? `${unknown ? '？？？' : def.name}（ボス）` : def.midBoss ? `${def.name}（中ボス）` : def.name,
    content,
    options: [],
    confirm: opts.canGo ? { label: '戦闘開始', onConfirm: opts.onGo } : undefined,
    closeLabel: '閉じる',
  });
}
