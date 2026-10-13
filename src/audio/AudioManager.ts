export type SfxName =
  | 'click' | 'deal' | 'flip' | 'attack' | 'damage' | 'bust' | 'push' | 'blackjack' | 'victory' | 'defeat' | 'guard' | 'heal' | 'pick';

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

  /** ユーザー操作の中で呼ぶ。AudioContext を作成し BGM を開始する。 */
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
        this.noise(t, 0.08, 2600 * r, 0.14, undefined, 0.012);
        this.tone(1500 * r, t + 0.015, 0.04, 'sine', 0.035, 1000 * r);
        break;
      }
      case 'flip': {
        // 伏せカードをめくる音: 「しゅっ」と上がる紙の音。置く音より少し長く、明るい
        this.sweepNoise(t, 0.16, 1400, 4600, 0.2, 0.03);
        this.tone(900, t + 0.1, 0.07, 'sine', 0.05, 1300);
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
      case 'guard':
        this.noise(t, 0.08, 4200, 0.4);
        this.tone(880, t, 0.14, 'square', 0.18, 660);
        this.tone(1320, t + 0.02, 0.1, 'triangle', 0.15);
        break;
      case 'heal':
        [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.07, 0.22, 'sine', 0.3));
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
