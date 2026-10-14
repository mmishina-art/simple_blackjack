export type SfxName =
  | 'click' | 'deal' | 'flip' | 'block' | 'break' | 'attack' | 'damage' | 'bust' | 'push' | 'blackjack' | 'victory' | 'defeat' | 'guard' | 'heal' | 'pick';

const STORAGE_KEY = 'bj-muted';

// A ハーモニックマイナー（Am - F - Dm - E）。小節ごとのベース音とアルペジオ（Hz）
const BASS = [110.0, 87.31, 73.42, 82.41];
const ARP: number[][] = [
  [220.0, 261.63, 329.63, 261.63],
  [174.61, 220.0, 261.63, 220.0],
  [146.83, 174.61, 220.0, 174.61],
  [164.81, 207.65, 246.94, 207.65],
];
const STEP_SEC = 60 / 84 / 2; // 84bpm の8分音符

/** 音を出してよい操作（ブラウザの自動再生制限。iOS は touchstart / pointerdown では許可されず、touchend / click で許可される）。 */
const GESTURES = ['click', 'touchend', 'keydown'] as const;
const noop = (): void => {};

/**
 * 外部ファイルを使わず Web Audio で合成する BGM / SE。
 * ブラウザの自動再生制限のため、unlock() は必ずユーザー操作の中で呼ぶこと。
 * 音は、ボタン（冒険を始める・出撃準備・祭壇・図鑑・音のオン/オフ）を押したときに始まる（unlock）。画面のほかの場所をタップしても始まらない。
 * スリープ・ロック・別アプリから戻ったあとに音が止まったままのときは、戻った時と次のタップで音を戻す（recover）。
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bgmGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private _muted = false;
  /** 戻した（resume）あとも動かなかった。次のタップで、AudioContext を作り直す。 */
  private needsRebuild = false;

  constructor() {
    try {
      this._muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* ストレージ不可でも動作させる */
    }
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(noop);
      else this.recover(false);
    });
    window.addEventListener('pageshow', () => this.recover(false));
    for (const ev of GESTURES) document.addEventListener(ev, () => this.onGesture(), { capture: true, passive: true });
  }

  /** タップ・キー操作のたびに呼ばれる。音を始める（unlock）のはボタンを押したときだけで、ここでは、止まった音を戻すだけ。 */
  private onGesture(): void {
    this.recover(true);
  }

  /**
   * スリープ・画面ロックなどのあとに、止まった AudioContext を動かす。
   * iOS では、戻っても 'interrupted' のまま resume() が効かないことがあるので、タップの中で作り直す（作成は操作の中でないと許可されない）。
   */
  private recover(fromGesture: boolean): void {
    const ctx = this.ctx;
    if (!ctx || document.hidden) return;
    const state = ctx.state as string;
    if (state === 'running') {
      this.needsRebuild = false;
      return;
    }
    if (fromGesture && (state === 'interrupted' || state === 'closed' || this.needsRebuild)) {
      this.rebuild();
      return;
    }
    void ctx.resume().catch(noop);
    if (fromGesture) {
      window.setTimeout(() => {
        if (this.ctx === ctx && (ctx.state as string) !== 'running' && !document.hidden) this.needsRebuild = true;
      }, 400);
    }
  }

  /** AudioContext を作り直して、BGM を最初から鳴らす。ユーザー操作の中で呼ぶこと。 */
  private rebuild(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const old = this.ctx;
    this.ctx = null;
    this.needsRebuild = false;
    void old?.close().catch(noop);
    this.unlock();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* noop */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /**
   * AudioContext を作成し BGM を開始する。ボタンを押したときに呼ぶ（ブラウザの自動再生制限のため、ユーザー操作の中で）。
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.26;
      // こもった暗い音色にするローパス
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1100;
      this.bgmGain.connect(lowpass).connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      // 効果音は、少しこもらせて（高い音を落とす）、石の地下室のような短い残響を足す（ダークファンタジーの重く暗い音）
      const sfxTone = this.ctx.createBiquadFilter();
      sfxTone.type = 'lowpass';
      sfxTone.frequency.value = 4200;
      this.sfxGain.connect(sfxTone).connect(this.master);
      const reverb = this.ctx.createConvolver();
      reverb.buffer = this.makeImpulse(1.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.28;
      sfxTone.connect(reverb).connect(wet).connect(this.master);
      this.noiseBuf = this.makeNoise();
    }
    void this.ctx.resume().catch(noop);
    this.startBgm();
  }

  sfx(name: SfxName, delaySec = 0): void {
    const ctx = this.ctx;
    if (!ctx || this._muted) return;
    if (ctx.state !== 'running') void ctx.resume().catch(noop);
    const t = ctx.currentTime + delaySec;
    switch (name) {
      // 効果音は、ダークファンタジーに合わせた、重く暗い音（低い響き・金属・鐘。明るい長調のメロディや、ピコピコした矩形波は使わない）
      case 'click':
        // ボタン: 低くこもった、木を叩く音
        this.tone(190, t, 0.08, 'sine', 0.38, 110);
        this.noise(t, 0.04, 900, 0.16);
        break;
      case 'pick':
        // 選ぶ: 石を置くような低い音と、暗い鐘の小さな余韻
        this.tone(147, t, 0.14, 'sine', 0.34, 98);
        this.bell(587.33, t + 0.02, 0.4, 0.07);
        break;
      case 'deal': {
        // カードを置く・配る音: 紙がすべる小さな音（少し低め）。毎回ほんの少し高さを変える（同じ音が続かないように）
        const r = 0.9 + Math.random() * 0.2;
        this.noise(t, 0.09, 1800 * r, 0.3, undefined, 0.012);
        this.tone(900 * r, t + 0.015, 0.05, 'sine', 0.06, 600 * r);
        break;
      }
      case 'flip': {
        // 伏せカードをめくる音: 「しゅっ」と上がる紙の音
        this.sweepNoise(t, 0.18, 900, 2600, 0.36, 0.03);
        this.tone(600, t + 0.1, 0.07, 'sine', 0.07, 820);
        break;
      }
      case 'attack':
        // 敵にダメージを与えた: 刃が空を切り、肉を断つ鈍い衝撃と、骨のきしむ割れ音。うめくように下がる低い声で、痛みを出す
        this.sweepNoise(t, 0.12, 2600, 900, 0.36, 0.015);
        this.noise(t + 0.07, 0.09, 1200, 0.62);
        this.noise(t + 0.075, 0.035, 3600, 0.3);
        this.noise(t + 0.11, 0.03, 2800, 0.18);
        this.tone(115, t + 0.07, 0.32, 'sine', 0.5, 42);
        this.tone(190, t + 0.1, 0.34, 'sawtooth', 0.16, 85);
        this.tone(140, t + 0.12, 0.3, 'triangle', 0.14, 70);
        break;
      case 'damage':
        // ダメージを受ける: 体に響く、低く重い衝撃（ざらついた低音を少し重ねる）
        this.noise(t, 0.3, 320, 0.75);
        this.tone(95, t, 0.42, 'sine', 0.6, 34);
        this.tone(70, t, 0.26, 'sawtooth', 0.14, 40);
        break;
      case 'bust':
        // バースト: 不吉に下がる音（半音と三全音で落ちる）と、最後の低い響き
        [233.08, 220, 174.61, 116.54].forEach((f, i) => this.tone(f, t + i * 0.11, 0.22, 'triangle', 0.3));
        this.tone(58.27, t + 0.33, 0.7, 'sine', 0.4);
        break;
      case 'push':
        // 引き分け: 中身のない、低い 2 つのノック
        this.tone(196, t, 0.14, 'sine', 0.34, 150);
        this.noise(t, 0.05, 600, 0.12);
        this.tone(196, t + 0.18, 0.14, 'sine', 0.34, 150);
        this.noise(t + 0.18, 0.05, 600, 0.12);
        break;
      case 'blackjack':
        // ブラックジャック: 低い鐘が鳴り、暗い短調の和音が上へ積み上がる
        this.bell(110, t, 1.4, 0.32);
        [220, 261.63, 329.63, 440, 523.25].forEach((f, i) => this.chime(f, t + 0.06 + i * 0.08, 0.9, 0.16));
        break;
      case 'victory':
        // 勝利: 重い銅鑼（どら）のような鐘と、ゆっくり広がる和音（最後だけ長調にして、暗いまま「終わった」と分かるように）
        this.bell(73.42, t, 2.2, 0.34);
        this.sweepNoise(t, 0.9, 200, 900, 0.08, 0.3);
        [146.83, 174.61, 220].forEach((f) => this.chime(f, t + 0.15, 0.9, 0.12));
        [146.83, 185, 220, 293.66].forEach((f) => this.chime(f, t + 0.85, 1.6, 0.13));
        break;
      case 'block':
        // ブロックを得る: 盾を構える。低いどっしりした響きの上に、暗い金属の余韻が上へ立ち上がる
        this.tone(130, t, 0.24, 'sine', 0.46, 70);
        this.bell(1046.5, t + 0.02, 0.5, 0.1);
        this.bell(523.25, t + 0.04, 0.4, 0.12);
        this.sweepNoise(t, 0.2, 500, 1600, 0.07, 0.03);
        break;
      case 'break':
        // 会心の一撃がブロックを破壊した: 割れる破片の音と、深い衝撃
        this.noise(t, 0.09, 4200, 0.36);
        this.tone(1500, t, 0.2, 'sine', 0.2, 300);
        this.bell(1100, t + 0.02, 0.3, 0.1);
        this.tone(80, t, 0.36, 'sine', 0.5, 40);
        break;
      case 'guard':
        // ブロックが攻撃を防いだ: 短く硬い、鈍い金属の「ガキン」（ブロックを得る音とは別。余韻は短い）
        this.noise(t, 0.05, 2200, 0.36);
        this.bell(520, t, 0.2, 0.22);
        this.tone(95, t, 0.12, 'sine', 0.42, 55);
        break;
      case 'heal':
        // 回復: 暗い短調（ラドミラ）の鈴が、静かに上へ重なって消える。下に低い持続音
        [220, 261.63, 329.63, 440].forEach((f, i) => this.chime(f, t + i * 0.09, i === 3 ? 1.0 : 0.6, 0.16 + i * 0.02));
        this.tone(110, t, 1.0, 'sine', 0.12);
        break;
      case 'defeat':
        // 敗北: ゆっくり沈んでいく低い 4 音と、長く消えていく最低音
        [196, 174.61, 155.56, 130.81].forEach((f, i) => this.tone(f, t + i * 0.34, 0.6, 'triangle', 0.32));
        this.tone(65.41, t + 1.1, 2.0, 'sine', 0.42);
        break;
    }
  }

  private startBgm(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.scheduleBgm(), 100);
  }

  private scheduleBgm(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.35) {
      const bar = Math.floor(this.step / 8) % 4;
      const pos = this.step % 8;
      const t = this.nextTime;
      if (pos % 4 === 0) {
        this.tone(BASS[bar], t, STEP_SEC * 3.8, 'sawtooth', 0.28, undefined, this.bgmGain);
        this.tone(BASS[bar] / 2, t, STEP_SEC * 3.8, 'sine', 0.5, undefined, this.bgmGain);
      }
      this.tone(ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1), t, STEP_SEC * 0.9, 'triangle', 0.16, undefined, this.bgmGain);
      if (pos % 2 === 1) this.noise(t, 0.03, 7000, 0.06, this.bgmGain);
      this.nextTime += STEP_SEC;
      this.step++;
    }
  }

  /** 金属の鈴: 基音に、整数倍でない倍音（2.76 倍・5.4 倍）を短く重ねる。 */
  private bell(freq: number, start: number, dur: number, vol: number): void {
    this.tone(freq, start, dur, 'sine', vol);
    this.tone(freq * 2.76, start, dur * 0.6, 'sine', vol * 0.35);
    this.tone(freq * 5.4, start, dur * 0.35, 'sine', vol * 0.15);
  }

  /** やわらかい鈴: 基音と 1 オクターブ上の sine だけ（金属っぽくならない、あたたかい音）。 */
  private chime(freq: number, start: number, dur: number, vol: number): void {
    this.tone(freq, start, dur, 'sine', vol);
    this.tone(freq * 2, start, dur * 0.6, 'sine', vol * 0.3);
  }

  private tone(
    freq: number, start: number, dur: number, type: OscillatorType, vol: number,
    slideTo?: number, dest?: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest ?? this.sfxGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** attack > 0 なら、立ち上がりをなだらかにする（やわらかい音）。 */
  private noise(start: number, dur: number, cutoff: number, vol: number, dest?: AudioNode, attack = 0): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    this.envelope(src, filter, start, dur, vol, attack, dest);
  }

  /** 帯域が from → to へ動くノイズ（しゅっという紙の音）。 */
  private sweepNoise(start: number, dur: number, from: number, to: number, vol: number, attack: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + dur);
    this.envelope(src, filter, start, dur, vol, attack);
  }

  private envelope(src: AudioBufferSourceNode, filter: BiquadFilterNode, start: number, dur: number, vol: number, attack: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(vol, start + attack);
    } else {
      g.gain.setValueAtTime(vol, start);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(g).connect(dest ?? this.sfxGain);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  /** 残響（石の部屋）: 指数的に消えていくノイズの響き。 */
  private makeImpulse(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    return buf;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export const audio = new AudioManager();
