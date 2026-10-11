export type SfxName =
  | 'click' | 'deal' | 'attack' | 'damage' | 'bust' | 'push' | 'blackjack' | 'victory' | 'defeat';

const STORAGE_KEY = 'bj-muted';

// A マイナー。小節ごとのベース音とアルペジオの和音（Hz）
const BASS = [110.0, 87.31, 130.81, 98.0];
const ARP: number[][] = [
  [220.0, 261.63, 329.63, 261.63],
  [174.61, 220.0, 261.63, 220.0],
  [261.63, 329.63, 392.0, 329.63],
  [196.0, 246.94, 293.66, 246.94],
];
const STEP_SEC = 60 / 104 / 2; // 104bpm の8分音符

/**
 * 外部ファイルを使わず Web Audio で合成する BGM / SE。
 * ブラウザの自動再生制限のため、unlock() は必ずユーザー操作の中で呼ぶこと。
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

  constructor() {
    try {
      this._muted = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* ストレージ不可でも動作させる */
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
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
      this.bgmGain.gain.value = 0.22;
      this.bgmGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      this.noiseBuf = this.makeNoise();
    }
    void this.ctx.resume();
    this.startBgm();
  }

  sfx(name: SfxName, delaySec = 0): void {
    const ctx = this.ctx;
    if (!ctx || this._muted) return;
    const t = ctx.currentTime + delaySec;
    switch (name) {
      case 'click':
        this.tone(660, t, 0.06, 'square', 0.25, 880);
        break;
      case 'deal':
        this.noise(t, 0.05, 3500, 0.35);
        this.tone(300, t, 0.05, 'triangle', 0.2, 200);
        break;
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
      if (pos % 4 === 0) this.tone(BASS[bar], t, STEP_SEC * 3.6, 'triangle', 0.5, undefined, this.bgmGain);
      this.tone(ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1), t, STEP_SEC * 0.9, 'square', 0.07, undefined, this.bgmGain);
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

  private noise(start: number, dur: number, cutoff: number, vol: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, start);
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
