import { describe, expect, it } from 'vitest';
import { pickWeighted, RARITY_LABEL, RARITY_WEIGHT } from '../src/core/rarity';
import { Entity } from '../src/core/entities/Entity';
import { ENEMY_LINEUP } from '../src/core/entities/enemies/catalog';
import { SKILL_POOL } from '../src/core/skills/catalog';
import { skillForTotal } from '../src/core/skills/execute';
import { fallbackLabel, getSkill, rarityOfSkill } from '../src/core/skills/Skill';
import { seededRng } from '../src/core/util/Rng';
import { Lockpick, RELIC_POOL, SealKey } from '../src/relics/catalog';
import { createRun, equipSkill, isSlotLocked, offerRelics, offerSkills, unequipSlot } from '../src/run/Run';

describe('レア度', () => {
  it('ラベルはコモン / レア / レジェンド', () => {
    expect(RARITY_LABEL).toEqual({ common: 'コモン', rare: 'レア', legend: 'レジェンド' });
  });

  it('スキルとレリックに3段階のレア度があり、レジェンドも存在する', () => {
    const skills = SKILL_POOL.map((id) => rarityOfSkill(getSkill(id)));
    const relics = RELIC_POOL.map((r) => r.rarity ?? 'common');
    for (const set of [skills, relics]) {
      expect(new Set(set)).toEqual(new Set(['common', 'rare', 'legend']));
    }
    expect(rarityOfSkill(getSkill('ace_strike'))).toBe('rare');
    expect(rarityOfSkill(getSkill('overlord_strike'))).toBe('legend');
    expect(RELIC_POOL.find((r) => r.id === 'orb')!.rarity).toBe('legend');
  });

  it('重み付き抽選: 重複なし。レア度が高いほど出にくい', () => {
    const counts: Record<string, number> = { common: 0, rare: 0, legend: 0 };
    const rng = seededRng(5);
    for (let i = 0; i < 600; i++) {
      const picked = offerSkills(rng);
      expect(new Set(picked).size).toBe(picked.length);
      picked.forEach((id) => counts[rarityOfSkill(getSkill(id))]++);
    }
    // 1つあたりの出現率で比較（プール内の数で割る）
    const per = (r: string, n: number) => counts[r] / n;
    const n = (r: string) => SKILL_POOL.filter((id) => rarityOfSkill(getSkill(id)) === r).length;
    expect(per('common', n('common'))).toBeGreaterThan(per('rare', n('rare')));
    expect(per('rare', n('rare'))).toBeGreaterThan(per('legend', n('legend')));
    expect(RARITY_WEIGHT.common).toBeGreaterThan(RARITY_WEIGHT.legend);
  });

  it('宝箱のレリックも所持済みを除き、重み付きで3つ選ばれる', () => {
    const run = createRun();
    run.relics.push(RELIC_POOL[0]);
    const offered = offerRelics(run, seededRng(1));
    expect(offered).toHaveLength(3);
    expect(offered.some((r) => r.id === RELIC_POOL[0].id)).toBe(false);
  });

  it('pickWeighted は候補が足りなければある分だけ返す', () => {
    expect(pickWeighted(['a', 'b'], 5, seededRng(1), () => 1)).toHaveLength(2);
  });
});

describe('空スロット = 通常攻撃', () => {
  it('通常攻撃はスキルとして外すことも、セットすることもできない', () => {
    const run = createRun();
    run.inventory.push('basic_attack');
    expect(equipSkill(run, 13, 'basic_attack')).toBe(false);
    expect(unequipSlot(run, 13)).toBe(false); // 空スロット
    expect(run.slots[13]).toBeUndefined();
    expect(Object.values(run.slots)).not.toContain('basic_attack');
  });

  it('スキルを外した空スロットは通常攻撃が発動する', () => {
    const run = createRun();
    expect(unequipSlot(run, 15)).toBe(true); // シールドを外す
    const e = new Entity('player', 'p', 60, run.slots, run.fallbackSkill, run.baseAttack);
    expect(skillForTotal(e, 15).id).toBe('basic_attack');
    expect(run.inventory).toEqual(['guard']); // 通常攻撃は持ち物に入らない
  });

  it('表記: プレイヤーは「通常攻撃」、敵は「通常攻撃（技名）」', () => {
    expect(fallbackLabel(getSkill('basic_attack'))).toBe('通常攻撃');
    expect(fallbackLabel(getSkill(ENEMY_LINEUP[0].fallbackSkill))).toBe('通常攻撃（ぬめる体当たり）');
  });
});

describe('固定スロットの解錠（11以下はレリックで変更できる）', () => {
  it('解錠の鍵で 11以下 が付け替え可能になる（21 は固定のまま）', () => {
    const run = createRun();
    run.inventory.push('slash');
    expect(equipSkill(run, 11, 'slash')).toBe(false);
    run.relics.push(Lockpick);
    expect(isSlotLocked(run, 11)).toBe(false);
    expect(isSlotLocked(run, 21)).toBe(true);
    expect(equipSkill(run, 11, 'slash')).toBe(true);
    expect(run.slots[11]).toBe('slash');
    expect(run.inventory).toEqual(['small_attack']);
    expect(unequipSlot(run, 11)).toBe(true); // 外すと空 = 通常攻撃
    expect(run.slots[11]).toBeUndefined();
  });

  it('封印の鍵は 21 だけを解錠する', () => {
    const run = createRun();
    run.relics.push(SealKey);
    expect(isSlotLocked(run, 21)).toBe(false);
    expect(isSlotLocked(run, 11)).toBe(true);
  });
});

describe('レリックによる上書きの検出（編成画面の赤字表示）', async () => {
  const { effectiveSlotSkills } = await import('../src/run/effective');
  const { TitanBlood, Whetstone, OverlordOrb } = await import('../src/relics/catalog');

  it('レリックなしなら、どのスロットも上書きなし', () => {
    for (const eff of effectiveSlotSkills(createRun()).values()) expect(eff.changed).toBe(false);
  });

  it('巨人の血: 11以下の小攻撃が ATK×0.5＝2 から ATK＝5 に上書きされる', () => {
    const run = createRun();
    run.relics.push(TitanBlood);
    const eff = effectiveSlotSkills(run).get(11)!;
    expect(eff.changed).toBe(true);
    expect(eff.baseText).toBe('攻撃 ATK×0.5＝2');
    expect(eff.text).toBe('攻撃 ATK＝5');
    expect(effectiveSlotSkills(run).get(20)!.changed).toBe(false);
  });

  it('砥石（ATK+2）は攻撃スキルの実数値を上書きする。防御スキルは変わらない', () => {
    const run = createRun();
    run.relics.push(Whetstone);
    const all = effectiveSlotSkills(run);
    expect(all.get(20)!.text).toBe('攻撃 ATK+5＝12');
    expect(all.get(20)!.changed).toBe(true);
    expect(all.get(15)!.changed).toBe(false);
  });

  it('覇王の宝珠: 21 のスキルが別のスキル（覇王の一撃）に上書きされる', () => {
    const run = createRun();
    run.relics.push(OverlordOrb);
    const eff = effectiveSlotSkills(run).get(21)!;
    expect(eff.skill.id).toBe('overlord_strike');
    expect(eff.base.id).toBe('ace_strike');
    expect(eff.changed).toBe(true);
  });
});

describe('アイコン', () => {
  it('小=小攻撃 / 攻=通常攻撃 / 大=大攻撃。空スロットの記号も「攻」', async () => {
    const { BASIC_ICON } = await import('../src/core/skills/Skill');
    expect(getSkill('small_attack').icon).toBe('小');
    expect(getSkill('basic_attack').icon).toBe('攻');
    expect(getSkill('big_attack').icon).toBe('大');
    expect(BASIC_ICON).toBe('攻');
  });

  it('プレイヤーのスキルのアイコンは1文字で、通常攻撃（攻）と重複しない', () => {
    const icons = SKILL_POOL.map((id) => getSkill(id).icon);
    for (const i of icons) expect(i).toHaveLength(1);
    expect(icons).not.toContain('攻');
  });
});

describe('スロットの見た目の規則（全画面共通）', async () => {
  const { slotLook } = await import('../src/core/skills/look');

  it('11以下と21は特殊スロット（金）。それ以外は特殊ではない', () => {
    for (let key = 11; key <= 21; key++) expect(slotLook(key, null).special).toBe(key === 11 || key === 21);
  });

  it('通常スロットはセットされたスキルのレア度に合わせ、空き（通常攻撃）はコモン扱い', () => {
    expect(slotLook(15, getSkill('guard')).rarity).toBe('common');
    expect(slotLook(20, getSkill('big_attack')).rarity).toBe('rare');
    expect(slotLook(17, getSkill('smash')).rarity).toBe('legend');
    expect(slotLook(13, null).rarity).toBe('common');
    expect(slotLook(13, undefined).rarity).toBe('common');
  });

  it('敵のスキルも強さに応じたレア度（弱い技=コモン、大技=レア、必殺=レジェンド）', () => {
    expect(rarityOfSkill(getSkill('slime_acid'))).toBe('common');
    expect(rarityOfSkill(getSkill('slime_melt'))).toBe('rare');
    expect(rarityOfSkill(getSkill('dragon_apocalypse'))).toBe('legend');
    expect(rarityOfSkill(getSkill('slime_touch'))).toBe('common');
  });
});
