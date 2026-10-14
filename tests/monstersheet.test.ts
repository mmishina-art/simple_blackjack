import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const map = readFileSync('src/ui/MapView.ts', 'utf8');
const sheet = readFileSync('src/ui/components/MonsterSheet.ts', 'utf8');

describe('マップの敵の詳細', () => {
  it('敵のマスのタップは、移動ではなく詳細シートを開く', () => {
    expect(map).toContain('openMonsterSheet(enemyId');
    expect(map).toContain('onGo: () => handlers.onMove(t.id)');
    expect(map).toMatch(/else handlers\.onMove\(t\.id\)/);
  });
  it('進める敵のときだけ「進む」を出し、閉じるボタンは常にある', () => {
    expect(sheet).toContain("opts.canGo ? [{ kind: 'confirm'");
    expect(sheet).toContain("closeLabel: '閉じる'");
  });
  it('LV・HP・特性・技・落とし物を出す', () => {
    for (const k of ['enemyLevel(def)', 'def.maxHp', 'def.trait', 'buildEnemySkillList', 'dropChances(opts.run, enemyId)']) expect(sheet).toContain(k);
  });
});

describe('敵の技の一覧', () => {
  const info = readFileSync('src/ui/components/EnemyInfo.ts', 'utf8');
  it('standOn 未満の合計（実質選ばれない数字）の行は出さない', () => {
    expect(info).toContain('filter((r) => r.key >= standOn)');
    expect(info).toContain('buildEnemySkillList(enemy, def.ai.standOn)');
    expect(sheet).toContain('buildEnemySkillList(enemy, def.ai.standOn)');
  });
  it('POW ではなく実際の攻撃値を出す', () => {
    expect(info).toContain('describeSkillShort(row.skill, enemy.attackAt(row.key))');
    expect(info).not.toContain('${row.text}');
  });
});

import { createRun, dropChances } from '../src/run/Run';
import { dropsOf } from '../src/run/drops';

describe('落とし物の出やすさ', () => {
  it('落とし物のなかでの割合になり、合計はおよそ 100%', () => {
    const run = createRun();
    const ch = dropChances(run, 'slime');
    expect(ch.map((c) => c.id).sort()).toEqual([...dropsOf('slime')].sort());
    const sum = ch.reduce((s, c) => s + c.percent, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(3);
  });
  it('レア度が高いほど出にくく、図鑑のスキルは出やすい', () => {
    const run = createRun();
    const base = dropChances(run, 'slime');
    run.favored = [base[base.length - 1].id];
    const boosted = dropChances(run, 'slime').find((c) => c.id === base[base.length - 1].id)!;
    expect(boosted.percent).toBeGreaterThan(base[base.length - 1].percent);
  });
  it('詳細シートは、名前とレア度（色）と%だけで、効果は出さない', () => {
    expect(sheet).toContain('dropChances(opts.run, enemyId)');
    expect(sheet).toContain('rarityClass(rarityOfSkill(sk))');
    expect(sheet).not.toContain('rarityBadge');
    expect(sheet).not.toContain('describeSkill');
  });
});

describe('マップのマスの絵', () => {
  const icons = readFileSync('src/ui/components/tileIcons.ts', 'utf8');
  it('宝・店・祠・宿屋に絵があり、マップが使う', () => {
    for (const k of ['start', 'chest', 'shop', 'shrine', 'inn']) expect(icons).toContain(`${k}:`);
    expect(map).toContain('TILE_ICONS[t.kind]');
    expect(map).toContain("start: '', empty: '', enemy: '敵', chest: '', inn: '', shrine: '', boss: '王', shop: ''");
  });
});
