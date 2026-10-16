import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getEnemy } from '../src/core/entities/enemies/catalog';

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
  const css = readFileSync('src/ui/styles/main.css', 'utf8');
  it('宝・店・祠・宿屋に絵があり、マップが使う。通常マスは r=28・中ボスは r=30・ボスマスは r=32 に拡大して見やすくする', () => {
    for (const k of ['start', 'chest', 'shop', 'shrine', 'inn']) expect(icons).toContain(`${k}:`);
    expect(map).toContain('TILE_ICONS[t.kind]');
    expect(map).toContain("start: '', empty: '', enemy: '敵', chest: '', inn: '', shrine: '', boss: '王', shop: ''");
    expect(map).toContain("if (t.kind === 'boss') return 32;");
    expect(map).toContain('if (isMidBoss(t)) return 30;');
    expect(map).toContain('return 28;');
    expect(map).toContain("transform: 'scale(1.45)'");
  });
  it('ボスは金色の枠＋金の王冠、中ボス（水没した騎士・溶岩の大蛇）は銅色の二重リングで、通常の敵（赤）と見分けられる', () => {
    expect(map).toContain("'tile__crown'");
    expect(map).toContain("if (midBoss) g.append(svg('circle', { r: r + 3.5 }, 'tile__ring'));");
    expect(map).toContain("' tile--midboss'");
    expect(css).toContain('.tile--boss:not(.tile--reach):not(.tile--here) .tile__bg { stroke: #e6c878;');
    expect(css).toContain('.tile__crown { fill: #e6c878;');
    expect(css).toContain('.tile--midboss .tile__ring {');
    expect(getEnemy('drowned_knight').midBoss).toBe(true);
    expect(getEnemy('magma_serpent').midBoss).toBe(true);
    expect(getEnemy('skeleton').midBoss).toBeFalsy();
    expect(sheet).toContain('def.midBoss ? `${def.name}（中ボス）`');
  });
  it('未討伐のボス（図鑑未登録）は、デバッグモードを除きマップ上も詳細シートもシルエットと「？？？」になる（真っ黒ではなく、姿がうっすら分かる）', () => {
    expect(map).toContain("const bossUnknown = t.kind === 'boss' && Boolean(t.enemyId) && !isDebug() && !(run.knownEnemies ?? []).includes(t.enemyId!);");
    expect(map).toContain("tile--unknown");
    expect(css).toContain('.tile--unknown .tile__monster { filter: grayscale(1)');
    expect(css).not.toContain('.tile--unknown .tile__monster { filter: brightness(0)');
    expect(css).toContain('.monster-sheet--silhouette .codex__sprite svg { filter: grayscale(1)');
    expect(sheet).toContain("const unknown = opts.boss && !isDebug() && !(opts.run.knownEnemies ?? []).includes(enemyId);");
    expect(sheet).toContain("if (!unknown) content.append(buildEnemySkillList(enemy, def.ai.standOn));");
  });
});
