import type { Entity } from '../../core/entities/Entity';
import type { RuleSet } from '../../core/rules/RuleSet';
import { badgeText, type PreviewPart } from '../../core/skills/preview';
import { BASIC_ICON, describeSkill, fallbackLabel, getSkill, SLOT_MAX, slotLabel, type SlotKey } from '../../core/skills/Skill';
import { effectTone, slotLook } from '../../core/skills/look';
import { rarityClass } from '../rarity';
import { gaugeKeys, gaugeState } from '../slotGauge';
import { fxChips, type Callout } from '../callout';

/**
 * 合計値スロット表と、現在の合計値で発動するスキルの表示。プレイヤーと敵の両方で使う。
 * 合計値がたまるにつれて、左から順に点灯していく（メーターのイメージ）。いちばん右の点灯が、いま発動するスロット。
 * 各マスには、そのスロットのスキルの効果（ダメージ数・回復数・ブロック）を添える。
 * minTotal: 敵が「この合計値以上になるまで引く」ときの値。それ未満のスロットは出さない（敵の個性が見える）。
 */
export class SlotStrip {
  readonly el = document.createElement('div');
  private cells = new Map<SlotKey, HTMLElement>();
  private keys: SlotKey[];
  /** 発動するスキルの表示。BattleView が、手札の右側へ移す（合計値を上に、スキルを手札の横に置くため）。 */
  readonly caption = document.createElement('div');
  private calloutKey = '';

  constructor(minTotal?: number) {
    this.keys = gaugeKeys(minTotal);
    this.el.className = 'slots';
    const row = document.createElement('div');
    row.className = 'slots__row';
    row.style.gridTemplateColumns = `repeat(${this.keys.length}, minmax(0, 1fr))`;
    this.keys.forEach((key, i) => {
      const cell = document.createElement('div');
      cell.className = 'slot';
      cell.style.setProperty('--i', String(i)); // 点灯が、左から順に波のように広がる
      this.cells.set(key, cell);
      row.append(cell);
    });
    this.caption.className = 'slots__caption';
    this.el.append(row, this.caption);
  }

  /**
   * callout: いま発動するスキルの大きな表示（名前・アイコン・効果の数値。レリック補正込みの予測）。
   * totalHidden: 手札が伏せられていて合計値が分からない（敵の行動前）。
   * effects: スロットごとの効果の予測（レリック・特性・相手のバーストを反映）。
   */
  update(entity: Entity, rules: RuleSet, callout?: Callout | null, totalHidden = false, effects?: ReadonlyMap<SlotKey, readonly PreviewPart[]>, hiddenNote = '最後の1枚が伏せられている'): void {
    const size = entity.hand.size;
    const total = entity.hand.total(rules);
    const known = size > 0 && !totalHidden;
    const bust = known && total > rules.bustLimit;
    const { lit, tip } = gaugeState(this.keys, total, known, bust);
    const fallback = getSkill(entity.fallbackSkill);

    for (const [key, cell] of this.cells) {
      const id = entity.slots[key];
      const skill = id ? getSkill(id) : null;
      // プレイヤーの 11以下・21 は特殊スロット（金/鋼）。
      // 敵の 21 は特殊スロット（金枠・光）ではなく、他のスロットと同じ形で、レジェンドの金の枠（rar-legend）。
      // 攻撃の技なら、下地を危険と同じ赤にして（slot--die）、危険より上の「必殺」と分かるようにする
      const isEnemy = entity.id === 'enemy';
      const isEnemy21 = isEnemy && key === SLOT_MAX;
      const look = slotLook(key, skill);
      const isSpecial = !isEnemy && look.special;
      const rarity = isEnemy21 ? 'legend' : look.rarity;
      // 敵の技の役割の色: 攻撃はオレンジ（アイコンだけ）、ブロックは青、回復は緑。21 はレジェンド枠色
      const tone = isEnemy && !isEnemy21 && !skill?.fatal ? effectTone(skill) ?? 'attack' : null;
      const slotTypeClass = isSpecial ? `slot--special slot--${look.tone}` : `slot--set ${rarityClass(rarity)}`;
      // 敵の危険な合計値は、血の赤色（slot--fatal）で下地ごと赤く塗る
      cell.className = `slot ${slotTypeClass}${skill?.fatal ? ' slot--fatal' : ''}${isEnemy21 && skill?.effects.some((e) => e.type === 'attack') ? ' slot--die' : ''}${tone ? ` slot--tone-${tone}` : ''}${lit.has(key) ? ' slot--on' : ''}${key === tip ? ' slot--active' : ''}`;
      cell.innerHTML = `<span class="slot__key">${slotLabel(key)}</span><span class="slot__icon">${skill ? skill.icon : BASIC_ICON}</span>`;
      const val = document.createElement('span');
      val.className = 'slot__val';
      for (const part of effects?.get(key) ?? []) {
        const b = document.createElement('span');
        b.className = `slot__badge slot__badge--${part.type}`;
        b.textContent = badgeText(part);
        val.append(b);
      }
      cell.append(val);
      cell.title = skill
        ? `${skill.fatal ? '危険: ' : ''}${entity.id === 'enemy' && key === SLOT_MAX ? '必殺（攻撃2倍）: ' : ''}${skill.name}（${describeSkill(skill, entity.attackAt(key))}）`
        : `${fallbackLabel(fallback)}（空きスロット・${describeSkill(fallback, entity.attackAt(key))}）`;
    }

    const text = (s: string) => {
      this.caption.className = 'slots__caption';
      this.caption.textContent = s;
      this.calloutKey = '';
    };
    if (size < rules.initialCards) text('');
    else if (totalHidden) text(hiddenNote);
    else if (bust) text('');
    else if (callout) this.renderCallout(callout);
    else text('');
    this.el.classList.toggle('slots--bust', bust);
  }

  /** 発動するスキルを、アイコン・名前・効果の数値で大きく出す。スキルが変わったときだけ、ぽんと弾む。 */
  private renderCallout(c: Callout): void {
    const chips = fxChips(c.parts, c.targetBlock);
    const key = `${c.name}|${chips.map((x) => x.main + x.unit).join(',')}`;
    const changed = key !== this.calloutKey;
    this.calloutKey = key;
    const medal = document.createElement('span');
    medal.className = `medal medal--sm callout__icon ${rarityClass(c.rarity)}${c.item ? ' medal--item' : ''}`;
    medal.textContent = c.icon;
    const name = document.createElement('span');
    name.className = 'callout__name';
    name.textContent = c.name;
    this.caption.className = `slots__caption slots__caption--callout${c.fizzled ? ' is-fizzle' : ''}`;
    this.caption.replaceChildren(medal, name);
    for (const chip of chips) {
      const fx = document.createElement('span');
      fx.className = `callout__fx callout__fx--${chip.type}`;
      const main = document.createElement('b');
      main.textContent = chip.main;
      const unit = document.createElement('small');
      unit.textContent = chip.unit;
      fx.append(main, unit);
      if (chip.note) {
        const note = document.createElement('span');
        note.className = 'callout__note';
        note.textContent = chip.note;
        fx.append(note);
      }
      this.caption.append(fx);
    }
    if (c.fizzled) {
      const why = document.createElement('small');
      why.className = 'callout__note';
      why.textContent = 'スキルが発動しない';
      this.caption.append(why);
    }
    if (changed) {
      this.caption.classList.remove('is-pop');
      void this.caption.offsetWidth; // アニメーション再始動
      this.caption.classList.add('is-pop');
    }
  }
}
