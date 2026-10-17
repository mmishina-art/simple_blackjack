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

export type BgmTrack = 'field' | 'battle' | 'midboss' | 'boss';

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

// ---- 1. 探索 BGM ('field'): A ハーモニックマイナー（Am - F - Dm - E）、84 BPM ----
const FIELD_BASS = [110.0, 87.31, 73.42, 82.41];
const FIELD_ARP: number[][] = [
  [220.0, 261.63, 329.63, 261.63],
  [174.61, 220.0, 261.63, 220.0],
  [146.83, 174.61, 220.0, 174.61],
  [164.81, 207.65, 246.94, 207.65],
];
const FIELD_STEP = 60 / 84 / 2; // 84bpm の8分音符

// ---- 2. 通常戦闘 BGM ('battle'): D ハーモニックマイナー、110 BPM（8小節ループ） ----
// 地下墓所や大聖堂で雑魚敵と刃を交える緊張感。刻むベースと短調の旋律が前に進む
const BATTLE_STEP = 60 / 110 / 2;
const BATTLE_BASS = [73.42, 65.41, 58.27, 55.0, 73.42, 98.0, 58.27, 82.41]; // Dm - C - Bb - A - Dm - Gm - Bb - A
const BATTLE_ARP: number[][] = [
  [146.83, 174.61, 220.0, 174.61],  // Dm
  [130.81, 164.81, 196.0, 164.81],  // C
  [116.54, 146.83, 174.61, 146.83], // Bb
  [110.0, 138.59, 164.81, 138.59],  // A7
  [146.83, 220.0, 293.66, 220.0],   // Dm
  [196.0, 233.08, 293.66, 233.08],  // Gm
  [116.54, 174.61, 233.08, 174.61], // Bb
  [164.81, 207.65, 277.18, 220.0],  // A7
];
const BATTLE_MELODY: number[][] = [
  [293.66, 0, 329.63, 349.23, 440.0, 0, 392.0, 349.23],
  [329.63, 0, 293.66, 261.63, 293.66, 0, 220.0, 0],
  [233.08, 0, 293.66, 349.23, 392.0, 0, 349.23, 329.63],
  [277.18, 0, 293.66, 329.63, 220.0, 0, 0, 0],
  [440.0, 0, 523.25, 466.16, 440.0, 0, 392.0, 349.23],
  [392.0, 0, 466.16, 440.0, 392.0, 0, 349.23, 293.66],
  [349.23, 329.63, 293.66, 233.08, 293.66, 349.23, 440.0, 0],
  [415.3, 0, 440.0, 493.88, 554.37, 0, 440.0, 0],
];

// ---- 3. 中ボス・階層ボス BGM ('midboss'): C ハーモニックマイナー、128 BPM（8小節ループ） ----
// 重装の騎士や大蛇が立ちはだかる威圧感。重い5度和音・半音階の刻み・金属の鐘で強敵らしさを出す
const MIDBOSS_STEP = 60 / 128 / 2;
const MIDBOSS_BASS = [65.41, 77.78, 87.31, 98.0, 65.41, 69.3, 103.83, 98.0]; // Cm - Eb - Fm - G - Cm - Db - Ab - G
const MIDBOSS_FIFTH = [98.0, 116.54, 130.81, 146.83, 98.0, 103.83, 155.56, 146.83];
const MIDBOSS_ARP: number[][] = [
  [130.81, 155.56, 196.0, 246.94],  // Cm(maj7)
  [155.56, 196.0, 233.08, 311.13],  // Eb
  [174.61, 207.65, 261.63, 349.23], // Fm
  [196.0, 246.94, 293.66, 349.23],  // G7
  [130.81, 196.0, 261.63, 311.13],  // Cm
  [138.59, 174.61, 207.65, 277.18], // Db (Phrygian bII)
  [207.65, 261.63, 311.13, 415.3],  // Ab
  [196.0, 246.94, 311.13, 392.0],   // G7(b13)
];
const MIDBOSS_MELODY: number[][] = [
  [261.63, 0, 311.13, 293.66, 261.63, 246.94, 261.63, 392.0],
  [311.13, 0, 392.0, 466.16, 392.0, 0, 349.23, 311.13],
  [349.23, 0, 415.3, 392.0, 349.23, 311.13, 293.66, 261.63],
  [246.94, 0, 293.66, 349.23, 415.3, 392.0, 293.66, 246.94],
  [523.25, 0, 493.88, 523.25, 622.25, 0, 587.33, 523.25],
  [554.37, 0, 523.25, 466.16, 415.3, 0, 392.0, 349.23],
  [415.3, 466.16, 523.25, 415.3, 349.23, 415.3, 466.16, 523.25],
  [493.88, 0, 587.33, 0, 622.25, 587.33, 493.88, 392.0],
];

// ---- 4. ラスボス BGM ('boss'): E ハーモニックマイナー、146 BPM（8小節ループ） ----
// 竜の巣の主・黒竜との決戦。疾走する低音ペダル・重厚なオルガン風3声和音・弔いの大鐘・高音リードでクライマックスを描く
const BOSS_STEP = 60 / 146 / 2;
const BOSS_BASS = [82.41, 87.31, 98.0, 92.5, 110.0, 82.41, 73.42, 123.47]; // Em - F(bII) - G - F#dim - Am - Em - D - B7
const BOSS_CHORDS: number[][] = [
  [164.81, 196.0, 246.94],  // Em
  [174.61, 220.0, 261.63],  // F (bII)
  [196.0, 246.94, 293.66],  // G
  [185.0, 220.0, 261.63],   // F#dim (tritone tension)
  [220.0, 261.63, 329.63],  // Am
  [164.81, 246.94, 329.63], // Em
  [146.83, 220.0, 293.66],  // Dm/D
  [185.0, 246.94, 311.13],  // B7
];
const BOSS_ARP: number[][] = [
  [164.81, 246.94, 329.63, 392.0],
  [174.61, 261.63, 349.23, 440.0],
  [196.0, 293.66, 392.0, 493.88],
  [185.0, 261.63, 369.99, 440.0],
  [220.0, 329.63, 440.0, 523.25],
  [164.81, 246.94, 329.63, 493.88],
  [146.83, 220.0, 293.66, 440.0],
  [246.94, 311.13, 369.99, 493.88],
];
const BOSS_MELODY: number[][] = [
  [329.63, 392.0, 493.88, 0, 440.0, 392.0, 369.99, 329.63],
  [349.23, 440.0, 523.25, 0, 493.88, 440.0, 392.0, 349.23],
  [392.0, 493.88, 587.33, 0, 523.25, 493.88, 440.0, 392.0],
  [369.99, 440.0, 523.25, 493.88, 440.0, 369.99, 311.13, 246.94],
  [440.0, 523.25, 659.25, 0, 587.33, 523.25, 493.88, 440.0],
  [659.25, 0, 587.33, 523.25, 493.88, 0, 440.0, 392.0],
  [587.33, 523.25, 493.88, 440.0, 392.0, 440.0, 493.88, 587.33],
  [622.25, 0, 659.25, 739.99, 783.99, 739.99, 622.25, 493.88],
];

/** トラックごとのローパス周波数（探索はこもらせ、強敵になるほど倍音を開いて迫力を増す）。 */
const BGM_CUTOFF: Record<BgmTrack, number> = {
  field: 1100,
  battle: 1450,
  midboss: 1750,
  boss: 2100,
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

  /** BGM トラックを切り替える（探索 `'field'`・通常戦闘 `'battle'`・中ボス `'midboss'`・ラスボス `'boss'`）。 */
  setBgm(track: BgmTrack): void {
    if (this._bgm === track) return;
    this._bgm = track;
    this.step = 0;
    if (this.ctx) {
      this.nextTime = Math.max(this.ctx.currentTime + 0.06, 0);
      if (this.bgmFilter) {
        this.bgmFilter.frequency.value = BGM_CUTOFF[track];
      }
    }
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
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.35) {
      const t = this.nextTime;
      switch (this._bgm) {
        case 'field':
          this.stepField(t);
          this.nextTime += FIELD_STEP;
          break;
        case 'battle':
          this.stepBattle(t);
          this.nextTime += BATTLE_STEP;
          break;
        case 'midboss':
          this.stepMidboss(t);
          this.nextTime += MIDBOSS_STEP;
          break;
        case 'boss':
          this.stepBoss(t);
          this.nextTime += BOSS_STEP;
          break;
      }
      this.step++;
    }
  }

  /** 探索 BGM: 静かで不穏な地下迷宮の歩み（84 BPM, A ハーモニックマイナー）。 */
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

  /** 通常戦闘 BGM: 雑魚敵との緊迫した切り結び（110 BPM, D ハーモニックマイナー）。 */
  private stepBattle(t: number): void {
    const bar = Math.floor(this.step / 8) % 8;
    const pos = this.step % 8;
    const root = BATTLE_BASS[bar];
    // 8分音符で刻むドライビングベース（表拍は重く、裏拍は1オクターブ上で推進力を出す）
    const bassFreq = pos % 2 === 0 ? root : root * 2;
    this.tone(bassFreq, t, BATTLE_STEP * 0.88, 'sawtooth', pos % 2 === 0 ? 0.28 : 0.2, undefined, this.bgmGain);
    if (pos % 4 === 0) {
      this.tone(root, t, BATTLE_STEP * 3.6, 'sine', 0.44, undefined, this.bgmGain);
    }
    // アルペジオと短調の主旋律
    this.tone(BATTLE_ARP[bar][pos % 4], t, BATTLE_STEP * 0.85, 'triangle', 0.14, undefined, this.bgmGain);
    const mel = BATTLE_MELODY[bar][pos];
    if (mel > 0) {
      this.tone(mel, t, BATTLE_STEP * 1.55, 'sawtooth', 0.15, undefined, this.bgmGain);
      this.tone(mel * 0.5, t, BATTLE_STEP * 1.4, 'triangle', 0.1, undefined, this.bgmGain);
    }
    // パーカッション: 1・3拍にローキック、2・4拍にリムスネア、裏拍にハイハット
    if (pos % 4 === 0) this.tone(92, t, 0.09, 'sine', 0.36, 42, this.bgmGain);
    if (pos % 4 === 2) this.noise(t, 0.06, 1800, 0.14, this.bgmGain);
    if (pos % 2 === 1) this.noise(t, 0.025, 6500, 0.07, this.bgmGain);
  }

  /** 中ボス・階層ボス BGM: 威圧感のある重装行進（128 BPM, C ハーモニックマイナー）。 */
  private stepMidboss(t: number): void {
    const bar = Math.floor(this.step / 8) % 8;
    const pos = this.step % 8;
    const root = MIDBOSS_BASS[bar];
    const fifth = MIDBOSS_FIFTH[bar];
    // 重い5度パワーコードとシンコペーションの低音
    if (pos === 0 || pos === 3 || pos === 4 || pos === 6) {
      this.tone(root, t, MIDBOSS_STEP * 1.7, 'sawtooth', 0.3, undefined, this.bgmGain);
      this.tone(fifth, t, MIDBOSS_STEP * 1.5, 'sawtooth', 0.2, undefined, this.bgmGain);
      this.tone(root, t, MIDBOSS_STEP * 1.8, 'sine', 0.46, undefined, this.bgmGain);
    } else {
      this.tone(root * 2, t, MIDBOSS_STEP * 0.8, 'sawtooth', 0.18, undefined, this.bgmGain);
    }
    // 4小節ごとの冒頭に不吉な金属の鐘を重ねる
    if (pos === 0 && bar % 2 === 0) {
      this.bellBgm(root * 4, t, MIDBOSS_STEP * 3.5, 0.12);
    }
    // 鋭いアルペジオと攻撃的なリードメロディ
    this.tone(MIDBOSS_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1), t, MIDBOSS_STEP * 0.85, 'triangle', 0.15, undefined, this.bgmGain);
    const mel = MIDBOSS_MELODY[bar][pos];
    if (mel > 0) {
      this.tone(mel, t, MIDBOSS_STEP * 1.35, 'sawtooth', 0.18, undefined, this.bgmGain);
      this.tone(mel, t, MIDBOSS_STEP * 1.35, 'triangle', 0.14, undefined, this.bgmGain);
    }
    // 重い太鼓と鋭いスネア
    if (pos === 0 || pos === 3 || pos === 4) this.tone(105, t, 0.1, 'sine', 0.42, 38, this.bgmGain);
    if (pos === 2 || pos === 6) {
      this.noise(t, 0.08, 1600, 0.2, this.bgmGain);
      this.tone(160, t, 0.06, 'triangle', 0.18, 75, this.bgmGain);
    }
    if (pos % 2 === 1) this.noise(t, 0.03, 7200, 0.09, this.bgmGain);
  }

  /** ラスボス BGM: 黒竜との最終決戦（146 BPM, E ハーモニックマイナー）。 */
  private stepBoss(t: number): void {
    const bar = Math.floor(this.step / 8) % 8;
    const pos = this.step % 8;
    const root = BOSS_BASS[bar];
    // 疾走するオクターブベース + 16分音符のギャロップ刻み
    this.tone(pos % 2 === 0 ? root : root * 2, t, BOSS_STEP * 0.85, 'sawtooth', 0.3, undefined, this.bgmGain);
    if (pos % 2 === 1) {
      this.tone(root * 2, t + BOSS_STEP * 0.5, BOSS_STEP * 0.42, 'sawtooth', 0.2, undefined, this.bgmGain);
    }
    if (pos % 4 === 0) {
      this.tone(root * 0.5, t, BOSS_STEP * 3.8, 'sine', 0.52, undefined, this.bgmGain);
    }
    // 聖堂オルガン風の重厚な3声和音パッド（小節頭と中盤で鳴らす）
    if (pos === 0 || pos === 4) {
      for (const freq of BOSS_CHORDS[bar]) {
        this.tone(freq, t, BOSS_STEP * 3.6, 'sawtooth', 0.11, undefined, this.bgmGain);
      }
    }
    // 弔いの大鐘（2小節ごとに鳴り響く）
    if (pos === 0 && bar % 2 === 0) {
      this.bellBgm(root * 2, t, BOSS_STEP * 5.0, 0.16);
    }
    // 高速アルペジオと劇的な高音クライマックス旋律
    this.tone(BOSS_ARP[bar][pos % 4] * (pos >= 4 ? 2 : 1), t, BOSS_STEP * 0.8, 'triangle', 0.15, undefined, this.bgmGain);
    const mel = BOSS_MELODY[bar][pos];
    if (mel > 0) {
      this.tone(mel, t, BOSS_STEP * 1.4, 'sawtooth', 0.2, undefined, this.bgmGain);
      this.tone(mel * 0.5, t, BOSS_STEP * 1.4, 'sawtooth', 0.12, undefined, this.bgmGain);
    }
    // 激しいドラムビート（連打キック・重いスネア・刻むシンバル）
    if (pos % 2 === 0 || pos === 7) this.tone(115, t, 0.09, 'sine', 0.46, 36, this.bgmGain);
    if (pos === 2 || pos === 6) {
      this.noise(t, 0.09, 1900, 0.24, this.bgmGain);
      this.tone(180, t, 0.07, 'triangle', 0.22, 70, this.bgmGain);
    }
    this.noise(t, 0.025, pos % 2 === 0 ? 6000 : 8000, pos % 2 === 0 ? 0.06 : 0.11, this.bgmGain);
  }

  /** BGM 用の金属の鐘（bgmGain に流す）。 */
  private bellBgm(freq: number, start: number, dur: number, vol: number): void {
    this.tone(freq, start, dur, 'sine', vol, undefined, this.bgmGain);
    this.tone(freq * 2.76, start, dur * 0.6, 'sine', vol * 0.35, undefined, this.bgmGain);
    this.tone(freq * 5.4, start, dur * 0.35, 'sine', vol * 0.15, undefined, this.bgmGain);
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
