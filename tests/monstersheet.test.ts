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
    for (const k of ['enemyLevel(def)', 'def.maxHp', 'def.trait', 'buildEnemySkillList', 'dropsOf(enemyId)']) expect(sheet).toContain(k);
  });
});
