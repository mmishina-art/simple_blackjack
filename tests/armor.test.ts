import { describe, expect, it } from 'vitest';
import { ARMOR_POOL, ALL_POOL, DEFAULT_ARMOR_ID, ITEM_POOL, SKILL_POOL } from '../src/core/skills/catalog';
import { describeSkill, describeSkillBonus, getSkill, isArmor, kindOfSkill, rarityOfSkill } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { CODEX_ARMOR_TOTAL } from '../src/meta/Meta';
import { ArtisanTools } from '../src/relics/catalog';
import { armorCap, createRun, equipArmor, equipSkill, offerSkills } from '../src/run/Run';
import { BlackDragon } from '../src/core/entities/enemies/catalog';
import type { Rank } from '../src/core/cards/Card';
import { playRound } from './helpers';

describe('防具', () => {
  it('種類: スキル・道具・防具は別。防具はスロットに置くものの一覧（ALL_POOL）に入らない', () => {
    expect(ARMOR_POOL.every((id) => isArmor(getSkill(id)))).toBe(true);
    expect([...SKILL_POOL, ...ITEM_POOL].some((id) => isArmor(getSkill(id)))).toBe(false);
    expect(ALL_POOL.some((id) => ARMOR_POOL.includes(id))).toBe(false);
    expect(kindOfSkill(getSkill('herb'))).toBe('item');
    expect(kindOfSkill(getSkill('big_attack'))).toBe('skill');
    expect(kindOfSkill(getSkill('iron_shield'))).toBe('armor');
    expect(CODEX_ARMOR_TOTAL).toBe(ARMOR_POOL.length);
  });

  it('戦士の初期装備は鉄の盾（被ダメージ上限 5）。硬い防具ほどレア度が高い', () => {
    const run = createRun();
    expect(DEFAULT_ARMOR_ID).toBe('iron_shield');
    expect(run.armor).toBe('iron_shield');
    expect(armorCap(run)).toBe(5);
    expect(['iron_shield', 'steel_shield', 'mithril_shield'].map((id) => getSkill(id).damageCap)).toEqual([5, 4, 3]);
    expect(['iron_shield', 'steel_shield', 'mithril_shield'].map((id) => rarityOfSkill(getSkill(id)))).toEqual(['common', 'rare', 'legend']);
    expect(describeSkill(getSkill('steel_shield'))).toBe('防御: 被ダメージ最大 4');
    expect(describeSkillBonus(getSkill('mithril_shield'))).toBe('防御: 被ダメージ最大 3');
  });

  it('防具は防御スロットにだけ置け、上書きのみ（元の防具は失われ、持ち物に戻らない）', () => {
    const run = createRun();
    run.inventory.push('steel_shield', 'herb');
    expect(equipSkill(run, 13, 'steel_shield')).toBe(false); // スキルのスロットには置けない
    expect(equipArmor(run, 'herb')).toBe(false);              // 防具以外は置けない
    expect(equipArmor(run, 'mithril_shield')).toBe(false);     // 持っていない
    expect(equipArmor(run, 'steel_shield')).toBe(true);
    expect(run.armor).toBe('steel_shield');
    expect(armorCap(run)).toBe(4);
    expect(run.inventory).toEqual(['herb']); // 鉄の盾は戻らない
  });

  it('報酬には防具が出ない（ショップでだけ買える）。道具の枠は、道具から 1 つ', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const o = offerSkills(seededRng(seed), createRun());
      expect(o).toHaveLength(3);
      expect(o.some((id) => isArmor(getSkill(id)))).toBe(false);
      expect(ITEM_POOL).toContain(o[2]);
    }
  });

  it('戦闘: 装備の上限が防御に効く。匠の工具で上限が 1 下がる', async () => {
    const dragon = { enemy: BlackDragon, enemyHand: ['9', '9'] as Rank[], from: 'Surrender' as const }; // 火炎の息は、どの上限も超える
    const base = await playRound({ player: ['K', '5'], ...dragon, playerArmorCap: 4 });
    expect(base.ctx.player.hp).toBe(60 - 4);
    const tools = await playRound({ player: ['K', '5'], ...dragon, playerArmorCap: 4, relics: [ArtisanTools] });
    expect(tools.ctx.player.hp).toBe(60 - 3);
    const def = await playRound({ player: ['K', '5'], ...dragon, relics: [ArtisanTools] });
    expect(def.ctx.player.hp).toBe(60 - 4); // 既定の上限 5 → 4
  });
});
