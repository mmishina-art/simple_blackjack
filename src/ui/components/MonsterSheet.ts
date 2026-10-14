import { Entity } from '../../core/entities/Entity';
import { getEnemy } from '../../core/entities/enemies/catalog';
import { enemyLevel } from '../../core/entities/enemies/level';
import { getSkill } from '../../core/skills/Skill';
import { dropChances, type RunState } from '../../run/Run';
import { rarityClass } from '../rarity';
import { rarityOfSkill } from '../../core/skills/Skill';
import { ENEMY_SPRITES } from './enemySprites';
import { buildEnemySkillList } from './EnemyInfo';
import { openSheet } from './SkillSheet';

/**
 * マップで敵のマスをタップしたときの詳細（姿・LV・HP・特性・技・落とし物）。
 * canGo のときは「進む」を出す（押すと onGo）。図鑑の発見状況には左右されない（マップに姿が見えているため）。
 */
export function openMonsterSheet(enemyId: string, opts: { run: RunState; boss: boolean; canGo: boolean; onGo(): void }): void {
  const def = getEnemy(enemyId);
  const enemy = new Entity('enemy', def.name, def.maxHp, { ...def.slots }, def.fallbackSkill, def.attack);
  const content = document.createElement('div');
  content.className = 'monster-sheet';

  const top = document.createElement('div');
  top.className = 'monster-sheet__top';
  const sprite = document.createElement('div');
  sprite.className = 'codex__sprite monster-sheet__sprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.innerHTML = ENEMY_SPRITES[enemyId] ?? '';
  const facts = document.createElement('div');
  facts.className = 'monster-sheet__facts';
  const stats = document.createElement('strong');
  stats.textContent = `LV ${enemyLevel(def)}　HP ${def.maxHp}`;
  facts.append(stats);
  if (def.trait) {
    const trait = document.createElement('small');
    trait.textContent = `特性: ${def.trait}`;
    facts.append(trait);
  }
  top.append(sprite, facts);

  const drops = document.createElement('div');
  drops.className = 'monster-sheet__drops';
  if (opts.boss) {
    drops.textContent = '落とし物: 階層を踏破すると、遺物をひとつ選べる';
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

  content.append(top, drops, buildEnemySkillList(enemy, def.ai.standOn));

  openSheet({
    title: opts.boss ? `${def.name}（ボス）` : def.name,
    content,
    options: opts.canGo ? [{ kind: 'confirm', icon: '進', name: '進む', detail: 'この敵と戦う', onPick: opts.onGo }] : [],
    closeLabel: '閉じる',
  });
}
