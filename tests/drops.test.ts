import { describe, expect, it } from 'vitest';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { SKILL_POOL } from '../src/core/skills/catalog';
import { seededRng } from '../src/core/util/Rng';
import { STAGES } from '../src/map/stages';
import { createRun, offerSkills } from '../src/run/Run';
import { dropsOf, ENEMY_DROPS } from '../src/run/drops';
import { generateShop } from '../src/run/shop';

describe('敵ごとの落とし物（報酬のスキル）', () => {
  it('敵ごとの候補は、すべて報酬に出るスキルで、どの敵にも用意がある（マップに出る敵すべて）', () => {
    for (const [id, drops] of Object.entries(ENEMY_DROPS)) {
      expect(drops.length, id).toBeGreaterThanOrEqual(4);
      for (const s of drops) expect(SKILL_POOL, `${id}: ${s}`).toContain(s);
    }
    const onMaps = new Set(STAGES.flatMap((st) => Object.values(st.tiles).filter((t) => t.kind === 'enemy' && t.enemyId).map((t) => t.enemyId!)));
    for (const id of onMaps) expect(dropsOf(id).length, id).toBeGreaterThan(0);
    expect(ENEMY_LINEUP.length).toBeGreaterThan(0);
  });

  it('報酬の 3 つのうち 2 つは、倒した敵の落とし物から出る（残り 1 つは全体から）', () => {
    for (const enemy of ['skeleton', 'bat', 'gargoyle']) {
      for (let seed = 1; seed <= 40; seed++) {
        const o = offerSkills(seededRng(seed), createRun(), enemy);
        expect(o.filter((id) => dropsOf(enemy).includes(id)).length, `${enemy} ${seed}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('敵が分からない（または落とし物がない）ときは、全体から 3 つ', () => {
    const o = offerSkills(seededRng(3), createRun(), 'no_such_enemy');
    expect(o).toHaveLength(3);
    expect(new Set(o).size).toBe(3);
  });
});

describe('ショップはスキルを売らない', () => {
  it('品揃えは、道具・防具・遺物だけ。スキルは並ばない', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const offers = generateShop(createRun(), seededRng(seed));
      expect(offers.filter((o) => o.type === 'skill').some((o) => SKILL_POOL.includes(o.id))).toBe(false);
      expect(offers.filter((o) => o.type === 'relic')).toHaveLength(2);
      expect(offers.filter((o) => o.type === 'skill').length).toBeGreaterThanOrEqual(3);
    }
  });
});
