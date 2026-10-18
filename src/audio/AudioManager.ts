export type SfxName =
  | 'click' | 'deal' | 'flip' | 'block' | 'break' | 'attack' | 'damage' | 'bust' | 'push' | 'blackjack' | 'victory' | 'defeat' | 'guard' | 'heal' | 'pick' | 'omen';

const STORAGE_KEY = 'bj-muted';

/**
 * 生成 AI で作った効果音（src/audio/sfx/<名前>.mp3。tools/sfx.sh で WAV から変換）。置くだけで使われ、ないものは合成音で鳴らす。
 * ファイルも Web Audio（decodeAudioData）で鳴らすので、音量・オン/オフ・スリープ明けの扱いは合成音と同じ。
 */
const SFX_FILES: Partial<Record<string, string>> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./sfx/*.mp3', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.replace(/^.*\/([^/]+)\.mp3$/, '$1'), u]),
);
/** 効果音ファイルの音量（ファイルは大きめに作られているので、合成音と同じくらいに下げる）。 */
const FILE_GAIN = 0.45;
/** 頻繁に鳴る軽い音（タップ・配る・めくる・選ぶ）は、戦闘の音より小さくする（ファイルはどれも同じ大きさで作られている）。 */
const FILE_VOLUME: Partial<Record<SfxName, number>> = { click: 0.55, deal: 0.4, flip: 0.55, pick: 0.7, push: 0.8 };

export type BgmTrack = 'field' | 'stage1' | 'stage2' | 'stage3' | 'event' | 'battle' | 'midboss' | 'boss' | 'ending' | 'none';

/**
 * 階層番号（1〜3）に応じたステージ探索 BGM トラックを返す。
 * - 第 1 階層（忘れられた地下墓所）: `'stage1'` (A-1)
 * - 第 2 階層（沈んだ大聖堂）: `'stage2'` (A-2)
 * - 第 3 階層（竜の巣）: `'stage3'` (A-3)
 */
export function bgmForStage(stage: number): BgmTrack {
  if (stage <= 1) return 'stage1';
  if (stage === 2) return 'stage2';
  return 'stage3';
}

/**
 * 戦う相手に応じた BGM トラックを返す。
 * - 黒竜（ラスボス）: `'boss'`
 * - 中ボス（midBoss = true）および第1・第2階層ボス（knight, serpent, またはボス戦マス）: `'midboss'`
 * - 通常モンスター: `'battle'`
 */
export function bgmForBattle(enemy: { id: string; midBoss?: boolean }, isBossTile = false): BgmTrack {
  if (enemy.id === 'dragon') return 'boss';
  if (enemy.midBoss || isBossTile || enemy.id === 'knight' || enemy.id === 'serpent') return 'midboss';
  return 'battle';
}

// ---- 1. タイトル・準備 BGM ('field'): A ハーモニックマイナー（Am - F - Dm - E）、84 BPM ----
const FIELD_BASS = [110.0, 87.31, 73.42, 82.41];
const FIELD_ARP: number[][] = [
  [220.0, 261.63, 329.63, 261.63],
  [174.61, 220.0, 261.63, 220.0],
  [146.83, 174.61, 220.0, 174.61],
  [164.81, 207.65, 246.94, 207.65],
];
const FIELD_STEP = 60 / 84 / 2; // 84bpm の8分音符

// ---- 2. ステージ 1 BGM ('stage1' / A-1): 94 BPM、D ハーモニックマイナー（探索型2オクターブアルペジオ＋冷たい鈴） ----
const STAGE1_STEP = 60 / 94 / 2;
const STAGE1_BASS = [73.42, 58.27, 49.0, 55.0]; // Dm - Bb - Gm - A
const STAGE1_ARP: number[][] = [
  [146.83, 174.61, 220.0, 293.66],  // Dm
  [116.54, 146.83, 174.61, 233.08], // Bb
  [98.0, 116.54, 146.83, 220.0],    // Gm(add9)
  [110.0, 138.59, 164.81, 233.08],  // A7(b9)
];
const STAGE1_CHIME = [587.33, 466.16, 392.0, 440.0];

// ---- 3. ステージ 2 BGM ('stage2' / A-2): 104 BPM、C ハーモニックマイナー（減七アルペジオ＋弔いの鐘） ----
const STAGE2_STEP = 60 / 104 / 2;
const STAGE2_BASS = [65.41, 51.91, 73.42, 49.0]; // Cm - Ab - Dm7b5 - G7
const STAGE2_ARP: number[][] = [
  [130.81, 155.56, 196.0, 246.94],  // Cm(maj7)
  [103.83, 130.81, 155.56, 207.65], // Ab
  [146.83, 174.61, 207.65, 261.63], // Dm7(b5)
  [98.0, 123.47, 155.56, 207.65],   // G7(b9)
];
const STAGE2_BELL = [261.63, 311.13, 293.66, 246.94];

// ---- 4. ステージ 3 BGM ('stage3' / A-3): 116 BPM、E ハーモニックマイナー（倍速2層アルペジオ＋聖堂大鐘） ----
const STAGE3_STEP = 60 / 116 / 2;
const STAGE3_BASS = [82.41, 65.41, 55.0, 61.74]; // Em - C - Am - B7
const STAGE3_ARP: number[][] = [
  [164.81, 196.0, 246.94, 311.13],  // Em(maj7)
  [130.81, 164.81, 196.0, 293.66],  // Cmaj7#11
  [110.0, 130.81, 164.81, 246.94],  // Am9
  [123.47, 155.56, 185.0, 261.63],  // B7(b9)
];
const STAGE3_CHIME = [659.25, 587.33, 523.25, 493.88];

// ---- 5. イベントマス BGM ('event' / C-1): 88 BPM、宿屋・店・祠・宝箱（亡者のハープと孤独な鈴の調べ） ----
const EVENT_STEP = 60 / 88 / 2;
const EVENT_BASS = [73.42, 65.41, 58.27, 55.0]; // Dm - C - Bb - A
const EVENT_PAD: number[][] = [
  [146.83, 220.0, 293.66, 349.23],
  [130.81, 196.0, 261.63, 329.63],
  [116.54, 174.61, 233.08, 293.66],
  [110.0, 164.81, 220.0, 277.18],
];
const EVENT_MEL: number[][] = [
  [587.33, 0, 0, 523.25, 440.0, 0, 0, 0],
  [523.25, 0, 0, 466.16, 392.0, 0, 0, 0],
  [466.16, 0, 0, 440.0, 349.23, 0, 392.0, 0],
  [415.3, 0, 0, 440.0, 277.18, 0, 0, 0],
];

// ---- 6. 戦闘 BGM ('battle'、および 'midboss'・'boss' の仮置き / 元①-3): 110 BPM、E ハーモニックマイナー ----
// 地を揺るがす疾走重低音オスティナート、4声の大聖堂パイプオルガン、深淵の大鐘と連続バスドラム
const BATTLE_STEP = 60 / 110 / 2;
const BATTLE_BASS = [82.41, 65.41, 55.0, 61.74]; // Em - C - Am - B
const BATTLE_OSTINATO: number[][] = [
  // Bar 0 (Em: E - E - F - E - G - E - Bb - D# / 増4度と短2度の緊迫感)
  [82.41, 82.41, 87.31, 82.41, 98.0, 82.41, 116.54, 77.78],
  // Bar 1 (C: C - C - E - C - F# - C - G - B)
  [65.41, 65.41, 82.41, 65.41, 92.5, 65.41, 98.0, 61.74],
  // Bar 2 (Am/F#: A - A - C - A - D# - A - E - G)
  [55.0, 55.0, 65.41, 55.0, 77.78, 55.0, 82.41, 98.0],
  // Bar 3 (B7b9: B - B - D# - B - C - B - F - A)
  [61.74, 61.74, 77.78, 61.74, 65.41, 61.74, 87.31, 110.0],
];
const BATTLE_CHORDS: number[][] = [
  [164.81, 196.0, 246.94, 311.13], // Em(maj7)
  [130.81, 164.81, 196.0, 293.66], // Cmaj7#11
  [110.0, 130.81, 164.81, 233.08],  // Am6/dim
  [123.47, 155.56, 185.0, 246.94], // B7(b9)
];

// ---- 7. エンディング BGM ('ending'): 夜明けと凱旋の余韻、72 BPM（8小節ループ） ----
// 暗い地下迷宮（Dm）から、朝の光が差し込む温かい長調（F - C - D ピカルディ終止）へ静かにほどけていくハープと鐘と弦の曲
const ENDING_STEP = 60 / 72 / 2;
const ENDING_BASS = [73.42, 58.27, 87.31, 65.41, 98.0, 73.42, 55.0, 73.42]; // Dm - Bb - F - C - Gm - Dm - A - D(Picardy)
const ENDING_CHORDS: number[][] = [
  [146.83, 174.61, 220.0],  // Dm
  [116.54, 174.61, 233.08], // Bbmaj7
  [174.61, 220.0, 261.63],  // F
  [130.81, 196.0, 246.94],  // C
  [146.83, 196.0, 233.08],  // Gm
  [146.83, 174.61, 220.0],  // Dm
  [138.59, 164.81, 220.0],  // A
  [146.83, 185.0, 220.0],   // D major (夜明けのピカルディ終止)
];
const ENDING_ARP: number[][] = [
  [220.0, 293.66, 349.23, 440.0],
  [233.08, 293.66, 349.23, 440.0],
  [261.63, 349.23, 440.0, 523.25],
  [261.63, 329.63, 392.0, 523.25],
  [233.08, 293.66, 392.0, 466.16],
  [220.0, 293.66, 349.23, 440.0],
  [220.0, 277.18, 329.63, 440.0],
  [220.0, 293.66, 369.99, 440.0],
];
const ENDING_MELODY: number[][] = [
  [440.0, 0, 349.23, 0, 293.66, 0, 349.23, 440.0],
  [523.25, 0, 466.16, 0, 440.0, 0, 392.0, 0],
  [440.0, 0, 523.25, 0, 659.25, 0, 587.33, 523.25],
  [587.33, 0, 523.25, 0, 392.0, 0, 0, 0],
  [466.16, 0, 440.0, 0, 392.0, 0, 349.23, 0],
  [440.0, 0, 349.23, 0, 293.66, 0, 0, 0],
  [329.63, 0, 349.23, 0, 392.0, 0, 440.0, 0],
  [369.99, 0, 440.0, 0, 587.33, 0, 0, 0],
];

/** トラックごとの音量基準値。 */
const BGM_VOLUME: Record<BgmTrack, number> = {
  field: 0.26,
  stage1: 0.34,
  stage2: 0.35,
  stage3: 0.36,
  event: 0.32,
  battle: 0.40,
  midboss: 0.42,
  boss: 0.44,
  ending: 0.28,
  none: 0.26,
};

/** トラックごとのローパス周波数（地下の深みと重厚な空気感を出し、耳障りな高周波をカット）。 */
const BGM_CUTOFF: Record<BgmTrack, number> = {
  field: 1100,
  stage1: 1550,
  stage2: 1650,
  stage3: 1750,
  event: 1550,
  battle: 1850,
  midboss: 1950,
  boss: 2050,
  ending: 1600,
  none: 1100,
};

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
  private bgmFilter: BiquadFilterNode | null = null;
  private bgmNodes: AudioScheduledSourceNode[] = [];
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  /** 読み込んだ効果音ファイル（AudioContext を作り直したら、読み直す）。 */
  private buffers: Partial<Record<SfxName, AudioBuffer>> = {};
  private fileGain!: GainNode;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private _bgm: BgmTrack = 'field';
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

  get bgm(): BgmTrack {
    return this._bgm;
  }

  /**
   * BGM トラックを切り替える（探索 `'field'`・通常戦闘 `'battle'`・中ボス `'midboss'`・ラスボス `'boss'`・エンディング `'ending'`・無音 `'none'`）。
   * 前のトラックで予約されていた音は即座に止め、delaySec 秒後に新しいトラックを頭から鳴らす。
   */
  setBgm(track: BgmTrack, delaySec = 0.06): void {
    if (this._bgm === track && delaySec <= 0.1) return;
    this._bgm = track;
    this.step = 0;
    this.stopScheduledBgm();
    if (this.ctx) {
      this.nextTime = Math.max(this.ctx.currentTime + delaySec, 0);
      if (this.bgmFilter) {
        this.bgmFilter.frequency.value = BGM_CUTOFF[track];
      }
      if (this.bgmGain) {
        this.bgmGain.gain.setTargetAtTime(BGM_VOLUME[track], this.ctx.currentTime, 0.05);
      }
    }
  }

  /** すでに予約されている BGM のオシレータ・ノイズを即座に止める（場面が切り替わったときに前の曲が鳴り続けないように）。 */
  private stopScheduledBgm(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (const node of this.bgmNodes) {
      try {
        node.stop(now);
      } catch {
        /* すでに止まっているノードは無視 */
      }
    }
    this.bgmNodes = [];
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
      this.bgmGain.gain.value = BGM_VOLUME[this._bgm];
      // こもった暗い音色にするローパス（戦闘の格が上がるとカットオフを開いて迫力を増す）
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = BGM_CUTOFF[this._bgm];
      this.bgmFilter = lowpass;
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
      this.fileGain = this.ctx.createGain();
      this.fileGain.gain.value = FILE_GAIN;
      this.fileGain.connect(this.master);
      this.loadSfxFiles(this.ctx);
    }
    void this.ctx.resume().catch(noop);
    this.startBgm();
  }

  sfx(name: SfxName, delaySec = 0): void {
    const ctx = this.ctx;
    if (!ctx || this._muted) return;
    if (ctx.state !== 'running') void ctx.resume().catch(noop);
    const t = ctx.currentTime + delaySec;
    const file = this.buffers[name];
    if (file) {
      // 配る音は、毎回ほんの少し高さを変える（同じ音が続かないように）
      this.playBuffer(file, t, name === 'deal' ? 0.94 + Math.random() * 0.12 : 1, FILE_VOLUME[name] ?? 1);
      return;
    }
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
      case 'omen':
        // BUST or DIE の予告: 低い弔いの鐘がひとつ鳴り、心臓の鼓動のような重い低音が 2 回。上で三全音（不協和）がかすかに鳴る
        this.bell(55, t, 1.6, 0.34);
        this.tone(62, t + 0.05, 0.16, 'sine', 0.55, 40);
        this.tone(62, t + 0.33, 0.2, 'sine', 0.5, 38);
        this.noise(t + 0.05, 0.06, 260, 0.22);
        this.noise(t + 0.33, 0.06, 240, 0.2);
        this.chime(311.13, t + 0.1, 0.9, 0.07);
        this.chime(440, t + 0.12, 0.9, 0.06);
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
    if (!ctx || this._bgm === 'none') return;
    while (this.nextTime < ctx.currentTime + 0.35) {
      const t = this.nextTime;
      switch (this._bgm) {
        case 'field':
          this.stepField(t);
          this.nextTime += FIELD_STEP;
          break;
        case 'stage1':
          this.stepStage1(t);
          this.nextTime += STAGE1_STEP;
          break;
        case 'stage2':
          this.stepStage2(t);
          this.nextTime += STAGE2_STEP;
          break;
        case 'stage3':
          this.stepStage3(t);
          this.nextTime += STAGE3_STEP;
          break;
        case 'event':
          this.stepEvent(t);
          this.nextTime += EVENT_STEP;
          break;
        case 'battle':
        case 'midboss':
        case 'boss':
          // 通常戦闘 BGM（元①-3）。中ボス・ラスボスも現時点では同じ曲を仮置きとして流す
          this.stepBattle(t);
          this.nextTime += BATTLE_STEP;
          break;
        case 'ending':
          this.stepEnding(t);
          this.nextTime += ENDING_STEP;
          break;
      }
      this.step++;
    }
  }

  /** タイトル・準備 BGM ('field'): 静かで不穏な地下迷宮の歩み（84 BPM, A ハーモニックマイナー）。 */
  private stepField(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    if (pos % 4 === 0) {
      this.tone(FIELD_BASS[bar], t, FIELD_STEP * 3.8, 'sawtooth', 0.28, undefined, this.bgmGain);
      this.tone(FIELD_BASS[bar] / 2, t, FIELD_STEP * 3.8, 'sine', 0.5, undefined, this.bgmGain);
    }
    this.tone(FIELD_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1), t, FIELD_STEP * 0.9, 'triangle', 0.16, undefined, this.bgmGain);
    if (pos % 2 === 1) this.noise(t, 0.03, 7000, 0.06, this.bgmGain);
  }

  /** ステージ 1 BGM ('stage1' / A-1): 94 BPM、D ハーモニックマイナー。探索型 2 オクターブアルペジオ＋冷たい鈴。 */
  private stepStage1(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    const root = STAGE1_BASS[bar];
    if (pos % 4 === 0) {
      this.tone(root, t, STAGE1_STEP * 3.8, 'sawtooth', 0.32, undefined, this.bgmGain);
      this.tone(root / 2, t, STAGE1_STEP * 3.8, 'sine', 0.52, undefined, this.bgmGain);
    }
    if (pos === 0) this.chimeBgm(STAGE1_CHIME[bar], t, STAGE1_STEP * 3.5, 0.16);
    const arp = STAGE1_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1);
    this.tone(arp, t, STAGE1_STEP * 0.95, 'triangle', 0.25, undefined, this.bgmGain);
    if (pos % 2 === 1) this.noise(t, 0.03, 6500, 0.06, this.bgmGain);
  }

  /** ステージ 2 BGM ('stage2' / A-2): 104 BPM、C ハーモニックマイナー。減七アルペジオ＋弔いの鐘。 */
  private stepStage2(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    const root = STAGE2_BASS[bar];
    if (pos % 4 === 0) {
      this.tone(root, t, STAGE2_STEP * 3.8, 'sawtooth', 0.34, undefined, this.bgmGain);
      this.tone(root * 1.5, t, STAGE2_STEP * 3.6, 'triangle', 0.2, undefined, this.bgmGain);
      this.tone(root / 2, t, STAGE2_STEP * 3.8, 'sine', 0.55, undefined, this.bgmGain);
    }
    if (pos === 0 || pos === 4) {
      this.bellBgm(STAGE2_BELL[bar] * (pos === 4 ? 1.5 : 1), t, STAGE2_STEP * 3.5, 0.2);
    }
    const arp = STAGE2_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1);
    this.tone(arp, t, STAGE2_STEP * 0.95, 'triangle', 0.26, undefined, this.bgmGain);
    this.tone(arp * 0.5, t, STAGE2_STEP * 0.9, 'sawtooth', 0.12, undefined, this.bgmGain);
    if (pos % 2 === 1) this.noise(t, 0.03, 6000, 0.07, this.bgmGain);
  }

  /** ステージ 3 BGM ('stage3' / A-3): 116 BPM、E ハーモニックマイナー。倍速 2 層アルペジオ＋聖堂大鐘。 */
  private stepStage3(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    const root = STAGE3_BASS[bar];
    if (pos % 4 === 0) {
      this.tone(root, t, STAGE3_STEP * 3.8, 'sawtooth', 0.36, undefined, this.bgmGain);
      this.tone(root / 2, t, STAGE3_STEP * 3.8, 'sine', 0.58, undefined, this.bgmGain);
      for (const f of STAGE3_ARP[bar]) {
        this.tone(f, t, STAGE3_STEP * 3.7, 'triangle', 0.14, undefined, this.bgmGain);
      }
    }
    if (pos === 0) this.bellBgm(root * 2, t, STAGE3_STEP * 5.0, 0.26);
    if (pos === 4) this.chimeBgm(STAGE3_CHIME[bar], t, STAGE3_STEP * 3.8, 0.22);
    const arp = STAGE3_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1);
    this.tone(arp, t, STAGE3_STEP * 0.9, 'triangle', 0.26, undefined, this.bgmGain);
    // 16分音符の残響エコー（アルペジオが2層で激しく渦巻く）
    this.tone(arp * 1.5, t + STAGE3_STEP * 0.5, STAGE3_STEP * 0.45, 'triangle', 0.16, undefined, this.bgmGain);
    if (pos % 2 === 1) this.noise(t, 0.03, 6500, 0.08, this.bgmGain);
  }

  /** イベントマス BGM ('event' / C-1): 88 BPM、宿屋・店・祠・宝箱で流れる亡者のハープと孤独な鈴の調べ。 */
  private stepEvent(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    const root = EVENT_BASS[bar];
    if (pos === 0) {
      this.tone(root, t, EVENT_STEP * 7.8, 'sine', 0.52, undefined, this.bgmGain);
      this.tone(root, t, EVENT_STEP * 7.6, 'sawtooth', 0.24, undefined, this.bgmGain);
      for (const f of EVENT_PAD[bar]) {
        this.tone(f, t, EVENT_STEP * 7.5, 'triangle', 0.14, undefined, this.bgmGain);
      }
    }
    const arp = EVENT_PAD[bar][pos % 4];
    this.tone(arp, t, EVENT_STEP * 1.6, 'triangle', 0.2, undefined, this.bgmGain);
    const mel = EVENT_MEL[bar][pos];
    if (mel > 0) this.chimeBgm(mel, t, EVENT_STEP * 3.5, 0.24);
  }

  /** 戦闘 BGM ('battle'、および中ボス・ラスボス仮置き / 元①-3): 110 BPM。暗黒疾走オスティナート、大聖堂オルガン、深淵の大鐘。 */
  private stepBattle(t: number): void {
    const bar = Math.floor(this.step / 8) % 4;
    const pos = this.step % 8;
    const root = BATTLE_BASS[bar];
    const note = BATTLE_OSTINATO[bar][pos];

    // 地を揺るがす暗黒オスティナート（重厚な低音鋸波 + 超低音サイン波 + 三角波）
    this.tone(note, t, BATTLE_STEP * 1.15, 'sawtooth', 0.36, undefined, this.bgmGain);
    this.tone(note / 2, t, BATTLE_STEP * 1.1, 'sine', 0.55, undefined, this.bgmGain);
    this.tone(note * 2, t, BATTLE_STEP * 0.85, 'triangle', 0.22, undefined, this.bgmGain);

    // 深淵の大鐘（圧倒的な質量感）
    if (pos === 0) {
      this.bellBgm(root * 1.5, t, BATTLE_STEP * 7.0, 0.38);
    } else if (pos === 4) {
      this.bellBgm(root * 2.25, t, BATTLE_STEP * 3.5, 0.24);
    }

    // 聖堂パイプオルガン風の重厚な4声の不協和音（逃げ場のない絶望感）
    if (pos === 0 || pos === 4) {
      for (const freq of BATTLE_CHORDS[bar]) {
        this.tone(freq, t, BATTLE_STEP * 3.8, 'triangle', 0.2, undefined, this.bgmGain);
        this.tone(freq * 0.5, t, BATTLE_STEP * 3.8, 'sawtooth', 0.14, undefined, this.bgmGain);
      }
    }

    // 地鳴りのような連続連打バスドラムと巨大な咆哮衝撃波
    if (pos === 0 || pos === 2 || pos === 4 || pos === 6) {
      this.tone(125, t, 0.22, 'sine', 0.65, 28, this.bgmGain);
      this.noise(t, 0.11, 130, 0.44, this.bgmGain);
    } else {
      this.noise(t, 0.035, 3400, 0.16, this.bgmGain);
    }
  }

  /** エンディング BGM: 夜明けと凱旋の余韻（72 BPM, Dマイナーから温かい長調・ピカルディ終止へほどけるハープとチャイム）。 */
  private stepEnding(t: number): void {
    const bar = Math.floor(this.step / 8) % 8;
    const pos = this.step % 8;
    const root = ENDING_BASS[bar];
    // 小節頭に深く温かい持続低音と、柔らかい3声の弦パッド
    if (pos === 0) {
      this.tone(root, t, ENDING_STEP * 7.6, 'sine', 0.42, undefined, this.bgmGain);
      this.tone(root * 2, t, ENDING_STEP * 7.2, 'triangle', 0.18, undefined, this.bgmGain);
      for (const freq of ENDING_CHORDS[bar]) {
        this.tone(freq, t, ENDING_STEP * 7.4, 'triangle', 0.11, undefined, this.bgmGain);
      }
    }
    // ハープのように澄んだ分散和音
    const arpFreq = ENDING_ARP[bar][pos % 4] * (pos >= 4 ? 1.5 : 1);
    this.tone(arpFreq, t, ENDING_STEP * 1.8, 'triangle', 0.16, undefined, this.bgmGain);
    // 朝の光のように澄んだチャイムの主旋律
    const mel = ENDING_MELODY[bar][pos];
    if (mel > 0) {
      this.chimeBgm(mel, t, ENDING_STEP * 3.2, 0.2);
    }
  }

  /** BGM 用の金属の鐘（bgmGain に流す）。 */
  private bellBgm(freq: number, start: number, dur: number, vol: number): void {
    this.tone(freq, start, dur, 'sine', vol, undefined, this.bgmGain);
    this.tone(freq * 2.76, start, dur * 0.6, 'sine', vol * 0.35, undefined, this.bgmGain);
    this.tone(freq * 5.4, start, dur * 0.35, 'sine', vol * 0.15, undefined, this.bgmGain);
  }

  /** BGM 用のやわらかい鈴（bgmGain に流す）。 */
  private chimeBgm(freq: number, start: number, dur: number, vol: number): void {
    this.tone(freq, start, dur, 'sine', vol, undefined, this.bgmGain);
    this.tone(freq * 2, start, dur * 0.6, 'sine', vol * 0.3, undefined, this.bgmGain);
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
    if (dest === this.bgmGain) this.trackBgmNode(osc);
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
    if (dest === this.bgmGain) this.trackBgmNode(src);
  }

  private trackBgmNode(node: AudioScheduledSourceNode): void {
    this.bgmNodes.push(node);
    if (this.bgmNodes.length > 64) this.bgmNodes.splice(0, this.bgmNodes.length - 64);
  }

  /** 効果音ファイルを読み込む（失敗しても、合成音で鳴るだけ）。 */
  private loadSfxFiles(ctx: AudioContext): void {
    this.buffers = {};
    if (typeof fetch !== 'function' || typeof ctx.decodeAudioData !== 'function') return;
    for (const [name, url] of Object.entries(SFX_FILES)) {
      if (!url) continue;
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          if (this.ctx === ctx) this.buffers[name as SfxName] = buf;
        })
        .catch(noop);
    }
  }

  private playBuffer(buf: AudioBuffer, start: number, rate: number, volume: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.fileGain);
    src.start(start);
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
