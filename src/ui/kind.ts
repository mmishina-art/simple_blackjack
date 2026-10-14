import { KIND_LABEL, kindOfSkill, type SkillDef, type SkillKind } from '../core/skills/Skill';

/**
 * スキル・道具・防具の見分け方（形 + 札の色 + 札の文字）。
 *  - スキル: 丸いメダル（札は報酬の選択などで「スキル」と添える）
 *  - 道具: 角丸の四角いメダル + 緑の「道具」札
 *  - 防具: 盾の形のメダル + 青鋼色の「防具」札
 *  - レリック（遺物）: 六角形（宝石の形）のメダル（`medal--relic`）
 * 色だけに頼らないよう、形と文字でも区別する。
 */
export function medalKindClass(kind: SkillKind): string {
  return kind === 'skill' ? '' : ` medal--${kind}`;
}

/** 札（小さなタグ）。スキルは、showSkill が true のときだけ出す（一覧では、道具・防具だけに付けて、すっきり見せる）。 */
export function kindTag(skill: SkillDef, showSkill = false): string {
  const kind = kindOfSkill(skill);
  if (kind === 'skill' && !showSkill) return '';
  return `<em class="kind-tag kind-tag--${kind}">${KIND_LABEL[kind]}</em>`;
}

export function kindTagOf(kind: SkillKind): string {
  return `<em class="kind-tag kind-tag--${kind}">${KIND_LABEL[kind]}</em>`;
}
