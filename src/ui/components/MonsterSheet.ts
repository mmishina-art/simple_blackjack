import { Entity } from '../../core/entities/Entity';
import { getEnemy } from '../../core/entities/enemies/catalog';
import { enemyLevel } from '../../core/entities/enemies/level';
import { getSkill } from '../../core/skills/Skill';
import { dropsOf } from '../../run/drops';
import { ENEMY_SPRITES } from './enemySprites';
import { buildEnemySkillList } from './EnemyInfo';
import { openSheet } from './SkillSheet';

/**
 * マップで敵のマスをタップしたときの詳細（姿・LV・HP・特性・技・落とし物）。
 * canGo のときは「進む」を出す（押すと onGo）。図鑑の発見状況には左右されない（マップに姿が見えているため）。
 */
export function openMonsterSheet(enemyId: string, opts: { boss: boolean; canGo: boolean; onGo(): void }): void {
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

  const drops = document.createElement('p');
  drops.className = 'monster-sheet__drops';
  const names = dropsOf(enemyId).map((id) => getSkill(id).name);
  drops.textContent = opts.boss ? '落とし物: 階層を踏破すると、遺物をひとつ選べる' : `落とし物: ${names.length ? names.join('・') : 'なし'}`;

  content.append(top, drops, buildEnemySkillList(enemy, def.ai.standOn));

  openSheet({
    title: opts.boss ? `${def.name}（ボス）` : def.name,
    content,
    options: opts.canGo ? [{ kind: 'confirm', icon: '進', name: '進む', detail: 'この敵と戦う', onPick: opts.onGo }] : [],
    closeLabel: '閉じる',
  });
}
