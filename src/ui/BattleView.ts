import { audio } from '../audio/AudioManager';
import type { BattleMachine } from '../core/battle/BattleMachine';
import { enemyLevel } from '../core/entities/enemies/level';
import { drawOdds, formatPercent } from '../core/cards/odds';
import type { Entity } from '../core/entities/Entity';
import { BattleLog } from './components/BattleLog';
import { EnemyView, floatText, playFx } from './components/EnemyView';
import { HandView } from './components/HandView';
import { HpBar } from './components/HpBar';
import { buildEnemyInfo } from './components/EnemyInfo';
import type { RunState } from '../run/Run';
import { SlotStrip } from './components/SlotStrip';
import { rarityClass } from './rarity';
import { previewAllSlots } from '../core/skills/preview';
import { SLOT_KEYS } from '../core/skills/Skill';
import { calloutOf } from './callout';
import { damageTakenMultiplier } from '../core/rules/bust';
import { turnBanner } from './turnBanner';
import type { TurnInfo } from '../core/rules/initiative';

/**
 * 縦画面レイアウト: 上=敵 / 下=プレイヤー / 最下=ボタン。
 * 戦闘ログは常時は出さない（BattleLog: 読み上げ用の領域と、「記録」ボタンのシート）。行動順は敵の舞台に帯で出す。
 */
export class BattleView {
  private enemyView: EnemyView;
  private enemyHp = new HpBar('enemy');
  private playerHp = new HpBar('player');
  private enemyHand = new HandView();
  private playerHand = new HandView();
  private slotStrip = new SlotStrip();
  private enemySlotStrip: SlotStrip;
  private log = new BattleLog();
  private banner = document.createElement('div');
  private bannerTimer = 0;
  private shownTurn: TurnInfo | null = null;
  private roundEl = document.createElement('div');
  private hitBtn = document.createElement('button');
  private hitSub!: HTMLElement;
  private surrenderSub!: HTMLElement;
  /** 敵のレベル（攻撃するときの平均ダメージ）。 */
  private enemyLv = 1;
  private standBtn = document.createElement('button');
  private surrenderBtn = document.createElement('button');
  private muteBtn = document.createElement('button');
  private overlay = document.createElement('div');
  private infoLayer = document.createElement('div');
  private playerArea: HTMLElement;
  private unsubs: Array<() => void> = [];
  private container: HTMLElement;

  constructor(
    root: HTMLElement,
    private readonly machine: BattleMachine,
    private readonly run: RunState,
    /** 戦闘終了時のオーバーレイ内容を作る（次の画面への遷移はここで行う）。 */
    private readonly buildResult: (won: boolean) => HTMLElement,
  ) {
    this.enemyLv = enemyLevel(machine.ctx.enemyDef);
    this.container = document.createElement('main');
    this.container.className = 'battle';
    this.enemyView = new EnemyView(machine.ctx.enemyDef.id, run.stage);
    // 敵が「N以上になるまで引く」なら、N未満のスロットは出さない
    this.enemySlotStrip = new SlotStrip(machine.ctx.enemyDef.ai.standOn);

    this.roundEl.className = 'round';
    this.muteBtn.className = 'mute';
    this.muteBtn.setAttribute('aria-label', 'サウンドの切り替え');
    this.muteBtn.textContent = '♪';
    this.muteBtn.addEventListener('click', () => {
      audio.setMuted(!audio.muted);
      audio.sfx('click');
      this.renderMute();
    });
    const infoBtn = document.createElement('button');
    infoBtn.className = 'info-btn';
    infoBtn.textContent = '敵の技';
    infoBtn.addEventListener('click', () => this.showSheet((close) => buildEnemyInfo(machine.ctx.enemy, machine.ctx.enemyDef, machine.ctx.player.hp, close)));
    const historyBtn = document.createElement('button');
    historyBtn.className = 'info-btn';
    historyBtn.textContent = '記録';
    historyBtn.addEventListener('click', () => this.showSheet((close) => this.log.buildSheet(close)));
    const topRight = document.createElement('span');
    topRight.className = 'top-row__right';
    topRight.append(historyBtn, infoBtn, this.muteBtn);
    const topRow = section('top-row', this.roundEl, topRight);
    this.enemyView.el.append(this.buildTraits()); // 敵の舞台の上に重ねる（高さを使わない）
    const enemyArea = section('enemy-area', topRow, this.enemyHp.el, this.enemySlotStrip.el, this.enemyView.el, this.enemyHand.el);
    // 合計値（勝負の結果）を上に、発動するスキルとダメージを手札の右側に出す
    this.enemyHand.side.append(this.enemySlotStrip.caption);
    this.playerHand.side.append(this.slotStrip.caption);
    this.banner.className = 'turn-banner';
    this.banner.hidden = true;
    this.banner.setAttribute('aria-hidden', 'true'); // 同じ内容が、読み上げ用のログにも出る
    this.enemyView.el.append(this.banner);
    this.playerHp.attach(this.buildRelicChips());
    this.playerArea = section('player-area', this.playerHand.el, this.slotStrip.el, this.playerHp.el);

    this.hitBtn.className = 'btn btn--hit';
    this.hitBtn.innerHTML = '<span class="btn__main">Hit</span><span class="btn__sub">引く</span>';
    this.hitSub = this.hitBtn.querySelector('.btn__sub')!;
    this.standBtn.className = 'btn btn--stand';
    this.standBtn.innerHTML = '<span class="btn__main">Stand</span><span class="btn__sub">勝負</span>';
    this.surrenderBtn.className = 'btn btn--surrender';
    this.surrenderBtn.innerHTML = '<span class="btn__main">防御</span><span class="btn__sub"></span>';
    this.surrenderSub = this.surrenderBtn.querySelector('.btn__sub')!;
    this.renderDefend();
    const actions = section('actions', this.hitBtn, this.standBtn, this.surrenderBtn);
    this.hitBtn.addEventListener('click', () => this.act('hit'));
    this.standBtn.addEventListener('click', () => this.act('stand'));
    this.surrenderBtn.addEventListener('click', () => this.act('surrender'));

    this.overlay.className = 'overlay';
    this.overlay.hidden = true;

    this.infoLayer.className = 'info-layer';
    this.infoLayer.hidden = true;
    this.container.append(enemyArea, this.playerArea, actions, this.log.liveEl, this.overlay, this.infoLayer);
    root.replaceChildren(this.container);

    this.unsubs.push(
      machine.onChange(() => this.render()),
      machine.onLog((text) => this.log.append(text)),
      // 効果は1つずつ見せる（間は PACE）。スキル名 → Block → 回復 → ダメージの順に、それぞれ画面演出が出る
      machine.bus.on('onSkillUsed', ({ user, skill }) => floatText(this.areaOf(user), `「${skill.name}」`, 'skill')),
      machine.bus.on('onBlockApplied', ({ entity, amount }) => this.playSupportEffect(entity, 'block', amount)),
      machine.bus.on('onHealApplied', ({ entity, amount }) => this.playSupportEffect(entity, 'heal', amount)),
      machine.bus.on('onDamageDealt', (p) => this.playDamageEffects(p.attacker?.id ?? null, p.defender, p.hpLoss, p.absorbed, p.damage, p.broken ?? 0, p.reduced ?? 0)),
      machine.bus.on('onBattleEnd', ({ winner }) => {
        if (winner.id === 'player') window.setTimeout(() => this.enemyView.play('defeated'), 300);
      }),
    );
    this.renderMute();
    this.render();
  }

  destroy(): void {
    window.clearTimeout(this.bannerTimer);
    this.unsubs.forEach((u) => u());
    this.container.remove();
  }

  /** 全面のシート（敵の技・戦闘の記録）を開く。閉じるボタンで閉じる。 */
  private showSheet(build: (close: () => void) => HTMLElement): void {
    this.infoLayer.replaceChildren(build(() => { this.infoLayer.hidden = true; }));
    this.infoLayer.hidden = false;
  }

  /** 行動順の帯を、敵の舞台に少しのあいだ出す。 */
  private showTurnBanner(): void {
    const b = turnBanner(this.machine.ctx);
    if (!b) return;
    const main = document.createElement('span');
    main.className = 'turn-banner__main';
    main.textContent = b.main;
    this.banner.replaceChildren(main);
    if (b.sub) {
      const sub = document.createElement('span');
      sub.className = 'turn-banner__sub';
      sub.textContent = b.sub;
      this.banner.append(sub);
    }
    this.banner.hidden = false;
    this.banner.classList.remove('is-show');
    void this.banner.offsetWidth; // アニメーション再始動
    this.banner.classList.add('is-show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => { this.banner.hidden = true; }, 1900);
  }

  private act(input: 'hit' | 'stand' | 'surrender'): void {
    if (this.machine.submit(input)) audio.sfx('click');
  }

  /** 演出を出す場所: 敵は舞台、プレイヤーはプレイヤー欄。 */
  private areaOf(entity: Entity): HTMLElement {
    return entity.id === 'enemy' ? this.enemyView.el : this.playerArea;
  }

  /** Block を得た・回復した、の演出（光と、+数）。0 のときは出さない。 */
  private playSupportEffect(entity: Entity, kind: 'block' | 'heal', amount: number): void {
    if (amount <= 0) return;
    const area = this.areaOf(entity);
    playFx(area, kind);
    floatText(area, `+${amount}`, kind, kind === 'block' ? 'Block' : 'HP');
  }

  private playDamageEffects(attacker: 'player' | 'enemy' | null, target: Entity, hpLoss: number, absorbed: number, damage: number, broken = 0, reduced = 0): void {
    const text = hpLoss > 0 ? `-${hpLoss}` : absorbed > 0 ? 'GUARD' : reduced > 0 ? 'GUARD' : '';
    if (!text) return;
    const kind = hpLoss > 0 ? 'damage' : 'block'; // 全部防いだときは、ダメージの色ではなく Block の色
    if (absorbed > 0) playFx(this.areaOf(target), 'guard');
    if (broken > 0) playFx(this.areaOf(target), 'break'); // Block を破壊（会心の一撃）
    // ログ欄の代わりに、数字の下へ内訳（Block が防いだ量・バーストの倍率）を添える
    const mult = damageTakenMultiplier(target, this.machine.ctx.rules);
    const notes = [absorbed > 0 ? `Block ${absorbed}` : '', broken > 0 ? `Block破壊 ${broken}` : '', mult !== 1 && damage > 0 ? `バースト×${mult}` : '', reduced > 0 ? `防具 −${reduced}` : ''].filter(Boolean).join('・');
    if (target.id === 'enemy') {
      if (hpLoss > 0) this.enemyView.play('hurt');
      this.enemyView.floatText(text, kind, notes);
    } else {
      if (attacker === 'enemy') this.enemyView.play('attack');
      floatText(this.playerArea, text, kind, notes);
      if (hpLoss > 0) {
        this.container.classList.remove('is-flash');
        void this.container.offsetWidth;
        this.container.classList.add('is-flash');
      }
    }
  }

  /** 敵の特殊能力（特性）を、常に見える1行で出す。長いときは省略し、タップ・長押しで全文（title）。 */
  private buildTraits(): HTMLElement {
    const line = document.createElement('div');
    line.className = 'enemy-trait';
    const traits = this.machine.ctx.enemyDef.relics ?? [];
    line.hidden = traits.length === 0;
    for (const t of traits) {
      const chip = document.createElement('span');
      chip.className = 'enemy-trait__item';
      chip.title = `${t.name}: ${t.description}`;
      const icon = document.createElement('span');
      icon.className = 'medal medal--sm';
      icon.textContent = t.icon;
      const text = document.createElement('span');
      text.className = 'enemy-trait__text';
      const strong = document.createElement('strong');
      strong.textContent = t.name;
      const desc = document.createElement('span');
      desc.className = 'enemy-trait__desc';
      desc.textContent = ` ${t.description}`;
      text.append(strong, desc);
      chip.append(icon, text);
      line.append(chip);
    }
    return line;
  }

  /** 所持レリックのメダリオン（HPバーの名前の横に表示）。 */
  private buildRelicChips(): HTMLElement {
    const relics = document.createElement('span');
    relics.className = 'status-strip__relics';
    for (const r of this.run.relics) {
      const chip = document.createElement('span');
      chip.className = `medal medal--sm ${rarityClass(r.rarity)}`;
      chip.textContent = r.icon;
      chip.title = `${r.name}: ${r.description}`;
      relics.append(chip);
    }
    return relics;
  }

  private renderMute(): void {
    this.muteBtn.classList.toggle('mute--off', audio.muted);
    this.muteBtn.setAttribute('aria-pressed', String(audio.muted));
  }

  private render(): void {
    const { ctx } = this.machine;
    this.enemyHp.update(ctx.enemy.name, ctx.enemy.hp, ctx.enemy.maxHp, ctx.enemy.block, this.enemyLv);
    // 自分の POW は表示しない（スロット表の各マスと、発動するスキルの数値に出ているため）。敵の LV（攻撃するときの平均ダメージ）は出す
    this.playerHp.update(ctx.player.name, ctx.player.hp, ctx.player.maxHp, ctx.player.block);
    this.enemyHand.update(ctx.enemy, ctx.rules);
    this.playerHand.update(ctx.player, ctx.rules);
    this.slotStrip.update(ctx.player, ctx.rules, calloutOf(ctx, ctx.player, ctx.enemy), false, previewAllSlots(ctx, ctx.player, ctx.enemy, SLOT_KEYS));
    const hidden = ctx.enemy.hand.hasHidden;
    this.enemySlotStrip.update(ctx.enemy, ctx.rules, hidden ? undefined : calloutOf(ctx, ctx.enemy, ctx.player), hidden, previewAllSlots(ctx, ctx.enemy, ctx.player, SLOT_KEYS));
    this.roundEl.textContent =
      ctx.round > 0 ? `ROUND ${ctx.round}` : '';
    // 行動順が決まったら（伏せカードがめくられたあと）、帯で知らせる
    if (ctx.turn !== this.shownTurn) {
      this.shownTurn = ctx.turn;
      if (ctx.turn) this.showTurnBanner();
    }

    // Hit / Stand は PlayerAction で入力待ちのときのみ活性
    const active = this.machine.canAct;
    this.hitBtn.disabled = !active;
    this.renderOdds(active);
    this.renderDefend();
    this.standBtn.disabled = !active;
    this.surrenderBtn.disabled = !active;

    if (ctx.winner) this.showResult(ctx.winner === ctx.player);
  }

  /** 防御ボタンの説明。装備している防具と、このラウンドに受けるダメージの上限（レリックの補正後）を出す。 */
  private renderDefend(): void {
    const { ctx } = this.machine;
    const cap = ctx.player.armorCap ?? ctx.rules.defendCap;
    const text = `被ダメージ最大 ${cap}・スキルは発動しない`;
    if (this.surrenderSub.textContent !== text) this.surrenderSub.textContent = text;
  }

  /** Hit ボタンの下に、次に引いたときのバースト・ブラックジャックの確率を、アイコン + 数字で出す（入力待ちのときだけ）。 */
  private renderOdds(active: boolean): void {
    const { ctx } = this.machine;
    const odds = active ? drawOdds(ctx.deck, ctx.player.hand, ctx.enemy.hand, ctx.rules) : null;
    const bust = odds ? formatPercent(odds.bust) : '';
    const bj = odds ? formatPercent(odds.blackjack) : '';
    const key = `${bust}|${bj}`;
    if (this.hitSub.dataset.key === key) return;
    this.hitSub.dataset.key = key;
    this.hitSub.classList.toggle('btn__sub--odds', !!odds);
    // 読み上げ・長押しの説明は文字で（アイコンだけに頼らない）
    this.hitBtn.setAttribute('aria-label', odds ? `Hit 引く。次に引くとバースト ${bust}、ブラックジャック ${bj}` : 'Hit 引く');
    this.hitBtn.title = odds ? `バースト ${bust} / ブラックジャック ${bj}` : '';
    if (!odds) return void (this.hitSub.textContent = '引く');
    const chip = (icon: string, cls: string, text: string): HTMLElement => {
      const el = document.createElement('span');
      el.className = `odds odds--${cls}`;
      el.innerHTML = icon;
      el.append(text);
      return el;
    };
    this.hitSub.replaceChildren(chip(ICON_BURST, 'bust', bust), chip(ICON_SPADE, 'bj', bj));
  }

  private showResult(won: boolean): void {
    if (!this.overlay.hidden) return;
    this.overlay.hidden = false;
    this.overlay.replaceChildren(this.buildResult(won));
  }
}

/** バースト（とげとげの爆発）とブラックジャック（スペード）のアイコン。色は CSS（currentColor）。 */
const ICON_BURST = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1l2.4 6.1L20 4l-2.1 6.2L23 12l-5.1 1.8L20 20l-5.6-3.1L12 23l-2.4-6.1L4 20l2.1-6.2L1 12l5.1-1.8L4 4l5.6 3.1z"/></svg>';
const ICON_SPADE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5C12 1.5 3 8.8 3 14.2a4.6 4.6 0 0 0 8 3.1L10 22.5h4l-1-5.2a4.6 4.6 0 0 0 8-3.1C21 8.8 12 1.5 12 1.5z"/></svg>';

function section(cls: string, ...children: HTMLElement[]): HTMLElement {
  const el = document.createElement('section');
  el.className = cls;
  el.append(...children);
  return el;
}
