import { audio } from '../audio/AudioManager';
import { slotAttack } from '../core/skills/catalog';
import { canPlaceAt, describeSkill, describeSkillBonus, describeSkillShort, placementNote, getSkill, isArmor, kindOfSkill, rarityOfSkill, SLOT_KEYS, slotLabel, type SkillId } from '../core/skills/Skill';
import { effectiveSlotSkills } from '../run/effective';
import { stashInPouch } from '../run/loadout';
import { previewSlot } from '../run/effective';
import { buildArmorCompare, buildSlotCompare } from './components/Compare';
import { sellFromInventory, sellPrice } from '../run/shop';
import { equipArmor, equipSkill, isSlotLocked, type RunState } from '../run/Run';
import { buildRelicRow, relicsByRarityDesc } from './components/relicMedal';
import { openSkillInfo } from './components/SkillInfo';
import { buildSlotRow, wrapIconAsButton } from './components/SlotRow';
import { buildTopBar } from './components/TopBar';
import { openSheet } from './components/SkillSheet';
import { kindTag, medalKindClass } from './kind';
import { rarityBadge, rarityClass } from './rarity';

export interface LoadoutOptions {
  /** スキル獲得直後など、あらかじめ「セット待ち」にしておく持ち物のスキル。置いたら自動で閉じる。 */
  armed?: SkillId;
  /**
   * セット待ちになった経緯。reward = 報酬・祈りで得た（袋に入れる / 売る）、pouch = 袋から取り出した（やめる / 売る）、
   * shop = ショップで買った（袋に入れる / 買うのをやめて返金）。省略時は reward。
   */
  mode?: 'reward' | 'pouch' | 'shop';
  /** shop のとき、「買うのをやめる」で呼ぶ（返金して売り切れを戻す）。 */
  undo?(): void;
  /** 閉じる。message があればマップ画面に表示する。 */
  onClose(message?: string): void;
}

/**
 * 装備画面（マップの「装備」）。いまのスキル・防具の確認が中心で、スロットの編集はできない。道具袋の中身だけ、置く・売るができる。
 *  - スロットをタップ → 持ち物から置くスキルを選ぶシートが開く（1ステップ）。外すのもそのシートから
 *  - スキル獲得直後は、上に「置くスキル」が表示され、置きたいスロットをタップするだけ
 *  - 11以下（小攻撃）と 21（会心の一撃）は固定で、選べない平らな行。レリックで解錠されると選べる
 */

export function showLoadout(root: HTMLElement, run: RunState, opts: LoadoutOptions): void {
  let armed: SkillId | null = opts.armed && run.inventory.includes(opts.armed) ? opts.armed : null;
  let armedMode = opts.mode ?? 'reward';
  let tab: 'skills' | 'relics' = 'skills'; // 確認のときだけ、レリックのタブを切り替えられる

  const render = (): void => {
    const screen = document.createElement('main');
    screen.className = `loadout${armed ? ' loadout--armed' : ''}`;

    const head = document.createElement('header');
    head.className = 'loadout__head';
    head.innerHTML = `<p class="loadout__hint">${armed ? (isArmor(getSkill(armed)) ? '防具の欄をタップして装備' : placementNote(getSkill(armed)) ? `置きたいスロットをタップ（${placementNote(getSkill(armed))}）` : '置きたいスロットをタップ') : tab === 'relics' ? 'いま持っているレリック（レア度の高い順）' : 'いまの装備の確認（道具袋の中身は、タップで置く・売る）'}</p>`;
    if (!armed) {
      const tabs = document.createElement('div');
      tabs.className = 'codex-tabs loadout__tabs';
      tabs.setAttribute('role', 'group');
      tabs.setAttribute('aria-label', '表示の切り替え');
      for (const t of ['skills', 'relics'] as const) {
        const b = document.createElement('button');
        b.className = `codex-tabs__btn${t === tab ? ' is-on' : ''}`;
        b.textContent = t === 'skills' ? 'スキル' : `レリック（${run.relics.length}）`;
        b.setAttribute('aria-pressed', String(t === tab));
        b.addEventListener('click', () => { if (t === tab) return; audio.sfx('click'); tab = t; render(); });
        tabs.append(b);
      }
      head.append(tabs);
    }
    // 上の左の「戻る」は全画面で同じ位置。置き先を決めるまで閉じられないセット待ちのときだけ、戻るボタンは出さない
    screen.append(buildTopBar('装備', armed ? undefined : () => opts.onClose()), head);

    if (armed) {
      const skill = getSkill(armed);
      const banner = document.createElement('div');
      banner.className = `armed ${rarityClass(rarityOfSkill(skill))}`;
      banner.innerHTML = `<span class="medal${medalKindClass(kindOfSkill(skill))}">${skill.icon}</span>
        <span class="armed__text"><strong>${skill.name} ${kindTag(skill, true)} ${rarityBadge(rarityOfSkill(skill))}</strong><span>${describeSkillBonus(skill)}${placementNote(skill) ? `<br>${placementNote(skill)}` : ''}</span></span>`;
      screen.append(banner);
    }

    // レリックのタブ: いま持っているレリックの一覧（名前・レア度・効果）
    if (!armed && tab === 'relics') {
      const list = document.createElement('div');
      list.className = 'loadout__relics';
      if (run.relics.length === 0) {
        const p = document.createElement('p');
        p.className = 'shop__empty';
        p.textContent = 'レリックは、まだ持っていない（宝箱・ショップ・階層の踏破で手に入る）';
        list.append(p);
      }
      for (const r of relicsByRarityDesc(run.relics)) list.append(buildRelicRow(r, run.slots));
      screen.append(list);
      root.replaceChildren(screen);
      return;
    }

    // スロット一覧
    const effective = effectiveSlotSkills(run);
    const slotList = document.createElement('div');
    slotList.className = 'loadout__slots';
    for (const key of SLOT_KEYS) {
      const id = run.slots[key];
      const locked = isSlotLocked(run, key);
      slotList.append(buildSlotRow({
        key,
        skill: id ? getSkill(id) : null,
        fallback: getSkill(run.fallbackSkill),
        atk: slotAttack(run.baseAttack, key),
        locked,
        effective: effective.get(key),
        target: !!armed && !isArmor(getSkill(armed)) && !locked && canPlaceAt(getSkill(armed), key),
        blocked: !!armed && !isArmor(getSkill(armed)) && !canPlaceAt(getSkill(armed), key),
        after: armed && !isArmor(getSkill(armed)) && !locked && canPlaceAt(getSkill(armed), key) ? previewSlot(run, key, armed).short : undefined,
        onInfo: armed ? undefined : () => openSkillInfo(id ? getSkill(id) : getSkill(run.fallbackSkill), { atk: slotAttack(run.baseAttack, key), where: `${slotLabel(key)} のスロット（基本パワー ${slotAttack(run.baseAttack, key)}）` }),
        onTap: !armed ? undefined : () => {
          if (armed && isArmor(getSkill(armed))) return; // 防具は、下の防具の欄に装備する
          if (armed && !canPlaceAt(getSkill(armed), key)) return; // レア度の制限: ここには置けない
          if (armed) {
            const skill = getSkill(armed);
            confirmPlace(key, armed, () => {
              if (equipSkill(run, key, skill.id)) {
                audio.sfx('pick');
                opts.onClose(`「${skill.name}」を ${slotLabel(key)} にセットした。`);
              }
            });
          }
        },
      }));
    }
    // 道具袋は 21 のすぐ下。防御（防具）の行は、確認のとき（セット待ちでない）か、防具を装備するとき（ショップで買った防具など）だけ出す。敵の報酬には防具が出ないので、スキルのセット待ちでは出さない
    slotList.append(buildPouchRow());
    if (!armed || isArmor(getSkill(armed))) slotList.append(buildArmorRow());
    screen.append(slotList);

    const actions = document.createElement('div');
    actions.className = 'loadout__actions';
    const mk = (cls: string, main: string, sub: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = `btn ${cls} loadout__btn`;
      b.innerHTML = `<span class="btn__main">${main}</span>${sub ? `<span class="btn__sub">${sub}</span>` : ''}`;
      b.addEventListener('click', () => { audio.sfx('click'); onClick(); });
      return b;
    };
    if (armed) {
      const id = armed;
      const sk = getSkill(id);
      const mode = armedMode;
      const sellIt = (): void => { openSheet({
        title: `「${sk.name}」を売る？`,
        subtitle: `セットしないものは売却する（${sellPrice(id)} G）。売ったものは戻らない`,
        options: [{ kind: 'confirm', icon: '売', name: `売る（+${sellPrice(id)} G）`, detail: describeSkillBonus(sk), onPick() {
          if (sellFromInventory(run, id) !== null) { audio.sfx('click'); opts.onClose(`「${sk.name}」を ${sellPrice(id)} G で売った（所持 ${run.gold} G）。`); }
        } }],
      }); };
      if (mode === 'pouch') {
        actions.append(mk('btn--stand', 'やめる', '袋にもどす', () => opts.onClose()), mk('btn--retry', '売る', `+${sellPrice(id)} G`, sellIt));
      } else if (mode === 'shop') {
        actions.append(mk('btn--retry', '買うのをやめる', '全額返金', () => { opts.undo?.(); opts.onClose(); }));
      } else {
        actions.append(mk('btn--retry', '売る', `+${sellPrice(id)} G`, sellIt));
      }
    }
    if (armed) screen.append(actions);
    root.replaceChildren(screen);
  };

  /** 防御スロット（防具）の行。防御したラウンドの被ダメージ上限は、装備している防具で決まる。 */
  function buildArmorRow(): HTMLElement {
    const cur = getSkill(run.armor);
    const target = !!armed && isArmor(getSkill(armed));
    const row = document.createElement(target ? 'button' : 'div');
    row.title = `${cur.name}\n${describeSkill(cur)}\n防御したラウンドに受けるダメージ（HP の減少）の上限`;
    row.className = `lslot lslot--set lslot--armor${target ? ' lslot--tap' : ''} ${rarityClass(rarityOfSkill(cur))}${target ? ' lslot--target' : ''}`;
    row.innerHTML = `<span class="lslot__key">防御</span>
      <span class="medal medal--sm medal--armor">${cur.icon}</span>
      <span class="lslot__name">${cur.name} ${kindTag(cur, true)}</span>
      <span class="lslot__desc">${describeSkillShort(cur, 0)}${target ? ` → <strong class="lslot__after">${describeSkillShort(getSkill(armed!), 0)}</strong>` : ''}</span>
      <span class="lslot__go" aria-hidden="true">${target ? '›' : ''}</span>`;
    if (!target) wrapIconAsButton(row, `${cur.name}の説明を見る`, () => openSkillInfo(cur, { where: '防御スロット', note: '防御したラウンドに受けるダメージ（HP の減少）の上限' }));
    if (target) row.addEventListener('click', () => {
      if (armed && isArmor(getSkill(armed))) {
        const id = armed;
        return confirmArmor(id, () => {
          if (equipArmor(run, id)) {
            audio.sfx('pick');
            opts.onClose(`「${getSkill(id).name}」を装備した。`);
          }
        });
      }
    });
    return row;
  }

  /** 道具袋の行（防御スロットの下）。中身があれば、タップで「スロットに置く / 売る」。セット待ちのときは、タップで袋に入れる。 */
  function buildPouchRow(): HTMLElement {
    const id = armed ? null : run.inventory[0] ?? null;
    const sk = id ? getSkill(id) : null;
    const row = document.createElement('button');
    const taking = !!armed && armedMode === 'pouch';
    row.className = `lslot lslot--set lslot--pouch lslot--noicon lslot--tap${armed && !taking ? ' lslot--target' : ''}`;
    const name = taking ? '取り出し中' : armed ? '袋に入れる' : sk ? `${sk.name} ${kindTag(sk)}` : '空き';
    const desc = taking ? 'やめると袋にもどる' : armed
      ? (run.inventory.some((x, i) => !(x === armed && i === run.inventory.indexOf(x))) ? '中身は売られる' : '1 つだけ')
      : sk ? describeSkillBonus(sk) : '';
    row.innerHTML = `<span class="lslot__key">道具袋</span><span class="lslot__name">${name}</span><span class="lslot__desc">${desc}</span><span class="lslot__go" aria-hidden="true">${(armed && !taking) || sk ? '›' : ''}</span>`;
    row.addEventListener('click', () => {
      if (armed) return stashArmed();
      if (!id || !sk) return;
      openSheet({
        title: `道具袋の「${sk.name}」`,
        subtitle: `${describeSkillBonus(sk)}（所持 ${run.gold} G）`,
        options: [
          { kind: 'confirm', icon: '置', name: 'スロットに置く', detail: '置きたいスロットを選ぶ', onPick() { armed = id; armedMode = 'pouch'; render(); } },
          { kind: 'confirm', icon: '売', name: `売る（+${sellPrice(id)} G）`, detail: describeSkillBonus(sk), onPick() { if (sellFromInventory(run, id) !== null) { audio.sfx('click'); render(); } } },
        ],
      });
    });
    return row;
  }

  /** セット待ちのものを道具袋に入れる。袋に先客がいれば、その中身は売られる（確認あり）。 */
  function stashArmed(): void {
    if (!armed) return;
    const id = armed;
    const sk = getSkill(id);
    if (armedMode === 'pouch') return; // 袋から出したものは、もう袋にある（「やめる」で戻す）
    const old = run.inventory.filter((x, i) => !(x === id && i === run.inventory.indexOf(id)));
    const doStash = (): void => {
      const r = stashInPouch(run, id);
      if (r) { audio.sfx('pick'); opts.onClose(`「${sk.name}」を道具袋に入れた${r.sold.length ? `（元の「${r.sold.map((x) => getSkill(x).name).join('」「')}」は ${r.gold} G で売った）` : ''}。`); }
    };
    if (old.length === 0) return doStash();
    const oldSk = getSkill(old[0]);
    openSheet({
      title: `「${sk.name}」を袋に入れる？`,
      subtitle: `袋は 1 つだけ。いまの「${oldSk.name}」は売られる（+${sellPrice(old[0])} G）`,
      options: [{ kind: 'confirm', icon: '袋', name: '袋に入れる', detail: `${oldSk.name} → ${sk.name}`, onPick: doStash }],
    });
  }

  /** 防具を装備する前の確認。ビフォーアフターを見せて、選ばせる。 */
  const confirmArmor = (id: SkillId, done: () => void): void => {
    const cur = getSkill(run.armor);
    const next = getSkill(id);
    openSheet({
      title: `「${next.name}」を装備する？`,
      subtitle: '防御スロットは上書きのみ',
      content: buildArmorCompare(cur, next),
      options: [{ kind: 'confirm', icon: '装', name: '装備する', detail: `${cur.name} → ${next.name}`, onPick: done }],
    });
  };

  /** セットする前の確認: ビフォーアフターを見せて、選ばせる（空きスロットでも、上書きでも）。 */
  const confirmPlace = (key: number, id: SkillId, done: () => void): void => {
    const before = previewSlot(run, key, run.slots[key] ?? null);
    const after = previewSlot(run, key, id);
    openSheet({
      title: `${slotLabel(key)} に「${after.name}」を置く？`,
      subtitle: `このスロットの基本パワー（POW）は ${after.atk}`,
      content: buildSlotCompare(before, after),
      options: [{ kind: 'confirm', icon: '置', name: 'セットする', detail: `${before.short} → ${after.short}`, onPick: done }],
    });
  };

  render();
}
