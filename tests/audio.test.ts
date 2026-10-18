// 音を始めるタイミング（ボタンを押したとき）と、スリープ明けに音が出ない問題のテスト。
// ブラウザの AudioContext は無いので、最小限の偽物で、状態の遷移（suspended / interrupted / running）だけを確かめる。
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager, bgmForBattle, bgmForStage } from '../src/audio/AudioManager';
import { BlackDragon, DrownedKnight, GraveKnight, MagmaSerpent, Serpent, Skeleton } from '../src/core/entities/enemies/catalog';

type State = 'suspended' | 'running' | 'interrupted' | 'closed';

const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const node = (): Record<string, unknown> => {
  const n: Record<string, unknown> = { gain: param(), frequency: param(), start: vi.fn(), stop: vi.fn(), type: '', buffer: null };
  n.connect = vi.fn(() => n);
  return n;
};

class FakeContext {
  static instances: FakeContext[] = [];
  /** resume() を呼んだあとの状態（'interrupted' のまま戻らない端末を再現する）。 */
  static resumeTo: State = 'running';
  state: State = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  resume = vi.fn(async () => { this.state = FakeContext.resumeTo; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  gains: Array<Record<string, unknown>> = [];
  createGain = () => { const n = node(); this.gains.push(n); return n; };
  filters: Array<Record<string, unknown>> = [];
  oscs: Array<Record<string, unknown>> = [];
  createBiquadFilter = () => { const n = node(); this.filters.push(n); return n; };
  createOscillator = () => { const n = node(); this.oscs.push(n); return n; };
  createBufferSource = node;
  createConvolver = node;
  createBuffer = () => ({ getChannelData: () => new Float32Array(8) });
  constructor() { FakeContext.instances.push(this); }
}

type Listener = (e?: unknown) => void;
const listeners: Record<string, Listener[]> = {};
const fire = (type: string) => (listeners[type] ?? []).forEach((l) => l());
const doc = { hidden: false, addEventListener: (t: string, l: Listener) => { (listeners[t] ??= []).push(l); } };

beforeEach(() => {
  vi.useFakeTimers();
  for (const k of Object.keys(listeners)) delete listeners[k];
  FakeContext.instances = [];
  FakeContext.resumeTo = 'running';
  doc.hidden = false;
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', {
    AudioContext: FakeContext, addEventListener: doc.addEventListener,
    setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, setTimeout: globalThis.setTimeout,
  });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ctxOf = () => FakeContext.instances.at(-1)!;

describe('音を始めるタイミング（ボタンを押したとき）', () => {
  it('画面のどこかをタップ・キー操作しただけでは、音は始まらない（AudioContext も作らない）', () => {
    new AudioManager();
    fire('click');
    fire('touchend');
    fire('keydown');
    expect(FakeContext.instances).toHaveLength(0);
  });

  it('ボタンを押して unlock() すると、AudioContext を作って BGM を始める', () => {
    const a = new AudioManager();
    a.unlock();
    expect(FakeContext.instances).toHaveLength(1);
    expect(ctxOf().resume).toHaveBeenCalled();
    expect(ctxOf().state).toBe('running');
    vi.advanceTimersByTime(300);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // BGM のスケジューラが動いている
  });

  it('unlock() は何度呼んでも、AudioContext は1つだけ（ボタンを押すたびに呼ばれる）', () => {
    const a = new AudioManager();
    a.unlock();
    a.unlock();
    a.unlock();
    expect(FakeContext.instances).toHaveLength(1);
  });

  it('作ったあとは、タップのたびに、止まった音を戻す（スリープ明けなど）', () => {
    const a = new AudioManager();
    a.unlock();
    ctxOf().state = 'suspended';
    fire('click');
    expect(ctxOf().state).toBe('running');
  });
});

describe('スリープ・ロックから戻ったとき', () => {
  const started = () => {
    const a = new AudioManager();
    a.unlock(); // ボタンを押して音を始めた
    ctxOf().state = 'running';
    return a;
  };

  it('画面が見えなくなったら止め、戻ったら再開する', () => {
    started();
    const c = ctxOf();
    doc.hidden = true; fire('visibilitychange');
    expect(c.suspend).toHaveBeenCalled();
    doc.hidden = false; fire('visibilitychange');
    expect(c.resume).toHaveBeenCalledTimes(2); // 音を始めたときと、戻ったとき
    expect(c.state).toBe('running');
  });

  it('ページが復元されたとき（pageshow）も再開を試みる', () => {
    started();
    const c = ctxOf();
    c.state = 'suspended';
    fire('pageshow');
    expect(c.resume).toHaveBeenCalledTimes(2);
  });

  it('止まったままなら、次のタップで再開する', () => {
    started();
    const c = ctxOf();
    c.state = 'suspended';
    fire('click');
    expect(c.resume).toHaveBeenCalledTimes(2);
    expect(c.state).toBe('running');
    expect(FakeContext.instances).toHaveLength(1); // 作り直さない
  });

  it("iOS で 'interrupted' のまま戻らないときは、タップの中で AudioContext を作り直して BGM を鳴らし直す", () => {
    started();
    const old = ctxOf();
    old.state = 'interrupted';
    fire('click');
    expect(FakeContext.instances).toHaveLength(2);
    expect(old.close).toHaveBeenCalled();
    expect(ctxOf()).not.toBe(old);
    expect(ctxOf().resume).toHaveBeenCalled();
  });

  it('resume しても動かない（suspended のまま）なら、その次のタップで作り直す', () => {
    started();
    const old = ctxOf();
    old.state = 'suspended';
    FakeContext.resumeTo = 'suspended';
    fire('click'); // 再開を試みる（効かない）
    expect(FakeContext.instances).toHaveLength(1);
    vi.advanceTimersByTime(500);
    fire('click'); // 効かなかったので、作り直す
    expect(FakeContext.instances).toHaveLength(2);
    expect(old.close).toHaveBeenCalled();
  });

  it('画面が見えない間は、何もしない（作り直さない）', () => {
    started();
    ctxOf().state = 'interrupted';
    doc.hidden = true;
    fire('click');
    expect(FakeContext.instances).toHaveLength(1);
  });

  it('作り直しても、ミュートの設定は保たれる', () => {
    const a = started();
    a.setMuted(true);
    ctxOf().state = 'interrupted';
    fire('click');
    expect(a.muted).toBe(true);
    const master = ctxOf().gains[0].gain as { value: number }; // 最初に作る gain がマスター
    expect(master.value).toBe(0);
  });
});

describe('カードの効果音（軽く落ち着いた音。ほかの効果音と区別する）', () => {
  const unlocked = () => {
    const a = new AudioManager();
    a.unlock();
    ctxOf().state = 'running';
    return a;
  };

  it('配る音（deal）は、やわらかいノイズと小さな sine だけ。square や sawtooth は使わない', () => {
    const a = unlocked();
    const c = ctxOf();
    const before = { oscs: c.oscs.length, filters: c.filters.length }; // BGM が作った分は除く
    a.sfx('deal');
    const oscs = c.oscs.slice(before.oscs);
    expect(oscs.length).toBeGreaterThan(0);
    for (const o of oscs) expect(o.type).toBe('sine');
    expect(c.filters.length - before.filters).toBe(1); // 紙のすべる音（ノイズ）
  });

  it('配る音は、毎回ほんの少し高さが変わる（同じ音が続かない）', () => {
    const a = unlocked();
    const c = ctxOf();
    const before = c.filters.length;
    const rand = vi.spyOn(Math, 'random');
    rand.mockReturnValueOnce(0).mockReturnValueOnce(1);
    a.sfx('deal');
    a.sfx('deal');
    rand.mockRestore();
    const [x, y] = c.filters.slice(before).map((f) => (f.frequency as { value: number }).value);
    expect(x).not.toBe(y);
    expect(Math.abs(x - y) / x).toBeLessThan(0.3); // 別の音になるほどは変えない
  });

  it('めくる音（flip）は、配る音と別の音: 帯域が上へ動く「しゅっ」という音', () => {
    const a = unlocked();
    const c = ctxOf();
    const before = c.filters.length;
    a.sfx('flip');
    const swept = c.filters.slice(before).some((f) => (f.frequency as { exponentialRampToValueAtTime: { mock: { calls: unknown[] } } }).exponentialRampToValueAtTime.mock.calls.length > 0);
    expect(swept).toBe(true);
    const d = unlocked();
    const c2 = ctxOf();
    const before2 = c2.filters.length;
    d.sfx('deal');
    expect(c2.filters.slice(before2).some((f) => (f.frequency as { exponentialRampToValueAtTime: { mock: { calls: unknown[] } } }).exponentialRampToValueAtTime.mock.calls.length > 0)).toBe(false);
  });
});

describe('ブロック・回復の効果音', () => {
  const play = (name: Parameters<AudioManager['sfx']>[0]) => {
    const a = new AudioManager();
    a.unlock();
    ctxOf().state = 'running';
    const c = ctxOf();
    const o0 = c.oscs.length;
    const f0 = c.filters.length;
    a.sfx(name);
    const oscs = c.oscs.slice(o0).map((o) => ({
      type: o.type as string,
      freq: ((o.frequency as { setValueAtTime: { mock: { calls: number[][] } } }).setValueAtTime.mock.calls[0] ?? [0, 0])[0],
      at: ((o.frequency as { setValueAtTime: { mock: { calls: number[][] } } }).setValueAtTime.mock.calls[0] ?? [0, 0])[1],
    }));
    const filters = c.filters.slice(f0);
    const swept = filters.some((f) => (f.frequency as { exponentialRampToValueAtTime: { mock: { calls: unknown[] } } }).exponentialRampToValueAtTime.mock.calls.length > 0);
    return { oscs, filters, swept };
  };

  it('回復: sine だけの、暗い短調の4音（ラドミラ）が順に上がる', () => {
    const { oscs } = play('heal');
    for (const o of oscs) expect(['sine', 'triangle']).toContain(o.type);
    // 基音の開始時刻（ラ の1オクターブ上の倍音も 440 なので、いちばん遅い開始を、その音の基音とみなす）
    const rising = [220, 261.63, 329.63, 440].map((f) => Math.max(...oscs.filter((o) => o.freq === f).map((o) => o.at)));
    expect(rising).toEqual([...rising].sort((a, b) => a - b));
    expect(new Set(rising).size).toBe(4);
  });

  it('ブロックを得る: 低い響きと、高い金属の余韻（鋭い矩形波・鋸波は使わない）', () => {
    const { oscs, swept } = play('block');
    for (const o of oscs) expect(['sine']).toContain(o.type);
    expect(oscs.some((o) => o.freq < 250)).toBe(true);
    expect(oscs.some((o) => o.freq > 1000)).toBe(true);
    expect(swept).toBe(true); // 立ち上がる空気
  });

  it('防いだ音（guard）は、ブロックを得る音（block）と別の音: 帯域は動かず、短く硬い', () => {
    const guard = play('guard');
    const block = play('block');
    expect(guard.swept).toBe(false);
    expect(block.swept).toBe(true);
    expect(guard.oscs.some((o) => o.freq < 150)).toBe(true); // 低いどすっ
    expect(guard.oscs.length).not.toBe(block.oscs.length);
  });
});

describe('効果音の雰囲気（ダークファンタジーの重く暗い音）', () => {
  const ALL = ['click', 'pick', 'deal', 'flip', 'attack', 'damage', 'guard', 'block', 'break', 'heal', 'push', 'bust', 'blackjack', 'victory', 'defeat', 'omen'] as const;
  it('ピコピコした矩形波（square）は、どの効果音にも使わない', () => {
    for (const name of ALL) {
      const a = new AudioManager();
      a.unlock();
      ctxOf().state = 'running';
      const c = ctxOf();
      const o0 = c.oscs.length;
      a.sfx(name);
      for (const o of c.oscs.slice(o0)) expect(o.type, name).not.toBe('square');
    }
  });
  it('効果音には、少しこもらせるフィルターと、石の部屋の残響（convolver）を通す', () => {
    const src = readFileSync('src/audio/AudioManager.ts', 'utf8');
    expect(src).toContain('createConvolver()');
    expect(src).toContain('this.makeImpulse(');
  });
});

describe('生成 AI で作った効果音ファイル', () => {
  const src = readFileSync('src/audio/AudioManager.ts', 'utf8');
  it('src/audio/sfx/<名前>.mp3 を置くだけで使い、ないものは合成音で鳴らす', () => {
    expect(src).toContain("import.meta.glob<string>('./sfx/*.mp3'");
    expect(src).toContain('const file = this.buffers[name];');
    expect(src).toContain('this.loadSfxFiles(this.ctx);');
  });
  it('ファイルも Web Audio で鳴らす（音量・オン/オフは合成音と同じ経路）', () => {
    expect(src).toContain('ctx.decodeAudioData(data)');
    expect(src).toContain('this.fileGain.connect(this.master);');
  });
  it('mp3 は Service Worker の precache に入る（オフラインでも鳴る）', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/globPatterns: \['\*\*\/\*\.\{[^}]*mp3/);
  });
});

describe('BUST or DIE の予告の効果音', () => {
  it('予告が出たとき（onBustOrDie）に omen を鳴らす。ファイルがなければ合成音', () => {
    expect(readFileSync('src/audio/bindBattleSounds.ts', 'utf8')).toContain("bus.on('onBustOrDie', () => audio.sfx('omen'))");
    expect(readFileSync('src/core/battle/states/EnemyActionState.ts', 'utf8')).toContain("ctx.bus.emit('onBustOrDie', { enemy });");
    expect(readFileSync('src/audio/AudioManager.ts', 'utf8')).toContain("case 'omen':");
    expect(readFileSync('docs/sfx-prompts.md', 'utf8')).toContain('sfx_omen.wav');
  });

  it('src/audio/sfx/omen.mp3 が配置され、全16種の効果音ファイルが揃っている', () => {
    const ALL = ['click', 'deal', 'flip', 'block', 'break', 'attack', 'damage', 'bust', 'push', 'blackjack', 'victory', 'defeat', 'guard', 'heal', 'pick', 'omen'] as const;
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    for (const name of ALL) {
      expect(existsSync(`src/audio/sfx/${name}.mp3`)).toBe(true);
    }
  });
});

describe('ステージ・イベント・戦闘・エンディング BGM の切り替え', () => {
  it('階層（1〜3）と敵の種類に応じて BGM トラックが決まる', () => {
    expect(bgmForStage(1)).toBe('stage1');
    expect(bgmForStage(2)).toBe('stage2');
    expect(bgmForStage(3)).toBe('stage3');
    expect(bgmForBattle(Skeleton)).toBe('battle');
    expect(bgmForBattle(DrownedKnight)).toBe('midboss');
    expect(bgmForBattle(MagmaSerpent)).toBe('midboss');
    expect(bgmForBattle(GraveKnight, true)).toBe('midboss');
    expect(bgmForBattle(Serpent, true)).toBe('midboss');
    expect(bgmForBattle(BlackDragon, true)).toBe('boss');
  });

  it('setBgm でトラックが切り替わり、ローパスフィルターの開き具合が タイトル < 第1階層 < 第2階層 < 第3階層 < 戦闘 の順に上がる', () => {
    const a = new AudioManager();
    a.unlock();
    const bgmFilter = ctxOf().filters[0].frequency as { value: number };
    expect(a.bgm).toBe('field');
    const fField = bgmFilter.value;

    a.setBgm('stage1');
    expect(a.bgm).toBe('stage1');
    const fStage1 = bgmFilter.value;

    a.setBgm('stage2');
    expect(a.bgm).toBe('stage2');
    const fStage2 = bgmFilter.value;

    a.setBgm('stage3');
    expect(a.bgm).toBe('stage3');
    const fStage3 = bgmFilter.value;

    a.setBgm('battle');
    expect(a.bgm).toBe('battle');
    const fBattle = bgmFilter.value;

    a.setBgm('midboss');
    expect(a.bgm).toBe('midboss');
    const fMidboss = bgmFilter.value;

    a.setBgm('boss');
    expect(a.bgm).toBe('boss');
    const fBoss = bgmFilter.value;

    expect(fField).toBeLessThan(fStage1);
    expect(fStage1).toBeLessThan(fStage2);
    expect(fStage2).toBeLessThan(fStage3);
    expect(fStage3).toBeLessThan(fBattle);
    expect(fBattle).toBeLessThanOrEqual(fMidboss);
    expect(fMidboss).toBeLessThanOrEqual(fBoss);
  });

  it('9種すべての BGM（field / stage1 / stage2 / stage3 / event / battle / midboss / boss / ending）が矩形波を使わずに音をスケジュールする', () => {
    for (const track of ['field', 'stage1', 'stage2', 'stage3', 'event', 'battle', 'midboss', 'boss', 'ending'] as const) {
      const a = new AudioManager();
      a.setBgm(track);
      a.unlock();
      const c = ctxOf();
      for (let i = 0; i < 20; i++) {
        c.currentTime += 0.25;
        vi.advanceTimersByTime(100);
      }
      expect(c.oscs.length, track).toBeGreaterThan(10);
      for (const o of c.oscs) expect(o.type, track).not.toBe('square');
    }
  });

  it('setBgm で別のトラックや none に切り替えたとき、前の BGM の予約済みノートが即座に stop され、delaySec の間は新しい音が鳴らない', () => {
    const a = new AudioManager();
    a.setBgm('boss');
    a.unlock();
    const c = ctxOf();
    c.currentTime = 0.2;
    vi.advanceTimersByTime(100);
    const bossOscs = [...c.oscs];
    expect(bossOscs.length).toBeGreaterThan(0);

    // ラスボス撃破: 戦闘 BGM を即座に止め、2.4 秒後にエンディング BGM を始める
    c.currentTime = 0.5;
    a.setBgm('ending', 2.4);
    expect(a.bgm).toBe('ending');
    // 前のラスボス BGM のオシレータに対して stop(0.5) が呼ばれていること
    for (const o of bossOscs) {
      const stopCalls = (o.stop as { mock: { calls: number[][] } }).mock.calls;
      expect(stopCalls.some(([t]) => t === 0.5)).toBe(true);
    }

    // 2.4 秒が経つ前（勝利ジングルの余韻中）は、まだエンディング BGM のノートは作られない
    const countAfterStop = c.oscs.length;
    c.currentTime = 1.5;
    vi.advanceTimersByTime(500);
    expect(c.oscs.length).toBe(countAfterStop);

    // 2.4 秒経過すると、エンディング BGM のノートがスケジュールされる
    c.currentTime = 3.0;
    vi.advanceTimersByTime(200);
    expect(c.oscs.length).toBeGreaterThan(countAfterStop);

    // 敗北時（'none'）に切り替えると、以後は何もスケジュールされない
    a.setBgm('none');
    const countAtNone = c.oscs.length;
    c.currentTime = 5.0;
    vi.advanceTimersByTime(500);
    expect(c.oscs.length).toBe(countAtNone);
  });

  it('タイトル・各階層マップ・イベントマス・戦闘開始・決着（勝利/敗北/ラスボス撃破）・エンディングの各場面で BGM が適切に切り替わる', () => {
    const mainSrc = readFileSync('src/main.ts', 'utf8');
    const endingSrc = readFileSync('src/ui/EndingScreen.ts', 'utf8');
    // 戦闘開始時
    expect(mainSrc).toContain("audio.setBgm(bgmForBattle(enemy, tile.kind === 'boss'))");
    // 敗北時は戦闘 BGM を止める
    expect(mainSrc).toContain("audio.setBgm('none')");
    // 勝利時は戦闘 BGM を止め、ラスボス撃破なら ending、それ以外なら現在の階層の BGM を余韻後に流す
    expect(mainSrc).toContain("audio.setBgm(finalVictory ? 'ending' : bgmForStage(run.stage), 2.4)");
    // マップ画面・階層進行時は階層の BGM（stage1〜stage3）、イベントマスでは event、エンディングでは ending、タイトルでは field
    expect(mainSrc).toContain("audio.setBgm(bgmForStage(run.stage))");
    expect(mainSrc).toContain("audio.setBgm('event')");
    expect(endingSrc).toContain("audio.setBgm('ending')");
    expect(mainSrc).toContain("audio.setBgm('field')");
  });
});

