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
 * 最初のタップ（どこでも）で自動的に unlock するので、タイトル画面でも BGM が鳴る。
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

  private onGesture(): void {
    if (!this.ctx) this.unlock();
    else this.recover(true);
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
   * AudioContext を作成し BGM を開始する。起動時にも呼ぶ（タイトルの BGM を最初から鳴らすため）。
   * 自動再生が許されない環境では、止まった状態（suspended）で待ち、最初のタップで resume されて鳴り始める。
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
      this.sfxGain.connect(this.master);
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
      case 'click':
        this.tone(660, t, 0.06, 'square', 0.25, 880);
        break;
      case 'deal': {
        // カードを置く・配る音: 軽くて落ち着いた、紙がすべる小さな音。毎回ほんの少し高さを変える（同じ音が続かないように）
        const r = 0.9 + Math.random() * 0.2;
        this.noise(t, 0.08, 2600 * r, 0.32, undefined, 0.012);
        this.tone(1500 * r, t + 0.015, 0.04, 'sine', 0.07, 1000 * r);
        break;
      }
      case 'flip': {
        // 伏せカードをめくる音: 「しゅっ」と上がる紙の音。置く音より少し長く、明るい
        this.sweepNoise(t, 0.16, 1400, 4600, 0.4, 0.03);
        this.tone(900, t + 0.1, 0.07, 'sine', 0.08, 1300);
        break;
      }
      case 'attack':
        this.noise(t, 0.18, 1800, 0.5);
        this.tone(520, t, 0.22, 'sawtooth', 0.35, 90);
        break;
      case 'damage':
        this.noise(t, 0.25, 700, 0.6);
        this.tone(180, t, 0.3, 'sawtooth', 0.4, 50);
        break;
      case 'bust':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.09, 0.14, 'square', 0.22));
        break;
      case 'push':
        this.tone(440, t, 0.1, 'triangle', 0.3);
        this.tone(440, t + 0.14, 0.1, 'triangle', 0.3);
        break;
      case 'blackjack':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.07, 0.18, 'triangle', 0.3));
        break;
      case 'victory':
        [523, 659, 784, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, t + i * 0.13, i === 5 ? 0.7 : 0.16, 'square', 0.22),
        );
        break;
      case 'block':
        // Block を得る: 盾を構える。低いどっしりした響きの上に、澄んだ金属の余韻が上へ立ち上がる
        this.tone(190, t, 0.16, 'sine', 0.42, 95);
        this.bell(1175, t + 0.01, 0.42, 0.2);
        this.bell(1760, t + 0.07, 0.3, 0.1);
        this.sweepNoise(t, 0.12, 900, 3200, 0.07, 0.02);
        break;
      case 'break':
        // 会心の一撃が Block を破壊した: ガラスが割れるような、高い破片の音と、低い衝撃
        this.noise(t, 0.07, 5200, 0.4);
        this.tone(1900, t, 0.18, 'sine', 0.25, 500);
        this.bell(1400, t + 0.02, 0.25, 0.14);
        this.tone(140, t, 0.12, 'sine', 0.35, 70);
        break;
      case 'guard':
        // Block が攻撃を防いだ: 短く硬い「ガキン」（Block を得る音とは別。鋭く、余韻は短い）
        this.noise(t, 0.05, 3400, 0.38);
        this.bell(780, t, 0.16, 0.22);
        this.tone(120, t, 0.09, 'sine', 0.3, 70);
        break;
      case 'heal':
        // 回復: やさしく上がる鈴の4音（ドミソド）が重なって、ゆっくり消える。あたたかい低音と、最後にきらめき
        [523.25, 659.25, 784, 1046.5].forEach((f, i) => this.chime(f, t + i * 0.075, i === 3 ? 0.8 : 0.5, 0.2 + i * 0.02));
        this.tone(261.63, t, 0.9, 'sine', 0.1);
        this.tone(2093, t + 0.3, 0.18, 'triangle', 0.05);
        break;
      case 'pick':
        this.tone(440, t, 0.08, 'square', 0.2);
        this.tone(880, t + 0.07, 0.18, 'triangle', 0.3);
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(f, t + i * 0.28, 0.5, 'triangle', 0.35));
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

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export const audio = new AudioManager();
