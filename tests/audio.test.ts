// スリープ明けに音が出ない問題と、タイトル画面の BGM（最初のタップで鳴る）のテスト。
// ブラウザの AudioContext は無いので、最小限の偽物で、状態の遷移（suspended / interrupted / running）だけを確かめる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';

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
  handlers: Array<() => void> = [];
  addEventListener = (_type: string, h: () => void) => { this.handlers.push(h); };
  /** 状態を変えて、statechange を発火する。 */
  setState(s: State) { this.state = s; this.handlers.forEach((h) => h()); }
  close = vi.fn(async () => { this.state = 'closed'; });
  gains: Array<Record<string, unknown>> = [];
  createGain = () => { const n = node(); this.gains.push(n); return n; };
  filters: Array<Record<string, unknown>> = [];
  oscs: Array<Record<string, unknown>> = [];
  createBiquadFilter = () => { const n = node(); this.filters.push(n); return n; };
  createOscillator = () => { const n = node(); this.oscs.push(n); return n; };
  createBufferSource = node;
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

describe('タイトル画面の BGM', () => {
  it('起動時に unlock() しておけば、自動再生が許される環境ではタップなしで鳴り、許されない環境では最初のタップで鳴る', () => {
    // 許される環境（resume() がそのまま running になる）
    const a = new AudioManager();
    a.unlock();
    expect(ctxOf().state).toBe('running');
    // 許されない環境（resume() しても suspended のまま）→ 最初のタップで鳴り始める
    FakeContext.instances = [];
    for (const k of Object.keys(listeners)) delete listeners[k];
    FakeContext.resumeTo = 'suspended';
    const b = new AudioManager();
    b.unlock();
    expect(ctxOf().state).toBe('suspended');
    FakeContext.resumeTo = 'running';
    fire('click');
    expect(ctxOf().state).toBe('running');
    expect(FakeContext.instances).toHaveLength(1); // 作り直さず、そのまま鳴らす
  });

  it('起動時に unlock() しなくても、最初のタップ（どこでも）で AudioContext を作り、BGM を始める', () => {
    new AudioManager();
    expect(FakeContext.instances).toHaveLength(0);
    fire('click');
    expect(FakeContext.instances).toHaveLength(1);
    expect(ctxOf().resume).toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // BGM のスケジューラが動いている
  });

  it('touchend・keydown でも始まる（iOS は touchstart では許可されない）', () => {
    new AudioManager();
    fire('touchend');
    expect(FakeContext.instances).toHaveLength(1);
    const b = new AudioManager();
    b.unlock();
    expect(FakeContext.instances.length).toBeGreaterThanOrEqual(2);
  });
});

describe('スリープ・ロックから戻ったとき', () => {
  const started = () => {
    const a = new AudioManager();
    fire('click');
    ctxOf().state = 'running';
    return a;
  };

  it('画面が見えなくなったら止め、戻ったら再開する', () => {
    started();
    const c = ctxOf();
    doc.hidden = true; fire('visibilitychange');
    expect(c.suspend).toHaveBeenCalled();
    doc.hidden = false; fire('visibilitychange');
    expect(c.resume).toHaveBeenCalledTimes(2); // 最初のタップと、戻ったとき
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
    fire('click');
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

describe('Block・回復の効果音', () => {
  const play = (name: Parameters<AudioManager['sfx']>[0]) => {
    const a = new AudioManager();
    fire('click');
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

  it('回復: sine と triangle だけの、やさしい4音（ドミソド）が順に上がる', () => {
    const { oscs } = play('heal');
    for (const o of oscs) expect(['sine', 'triangle']).toContain(o.type);
    // 基音の開始時刻（ド の1オクターブ上の倍音も 1046.5 なので、いちばん遅い開始を、その音の基音とみなす）
    const rising = [523.25, 659.25, 784, 1046.5].map((f) => Math.max(...oscs.filter((o) => o.freq === f).map((o) => o.at)));
    expect(rising).toEqual([...rising].sort((a, b) => a - b));
    expect(new Set(rising).size).toBe(4);
  });

  it('Block を得る: 低い響きと、高い金属の余韻（鋭い矩形波・鋸波は使わない）', () => {
    const { oscs, swept } = play('block');
    for (const o of oscs) expect(['sine']).toContain(o.type);
    expect(oscs.some((o) => o.freq < 250)).toBe(true);
    expect(oscs.some((o) => o.freq > 1000)).toBe(true);
    expect(swept).toBe(true); // 立ち上がる空気
  });

  it('防いだ音（guard）は、Block を得る音（block）と別の音: 帯域は動かず、短く硬い', () => {
    const guard = play('guard');
    const block = play('block');
    expect(guard.swept).toBe(false);
    expect(block.swept).toBe(true);
    expect(guard.oscs.some((o) => o.freq < 150)).toBe(true); // 低いどすっ
    expect(guard.oscs.length).not.toBe(block.oscs.length);
  });
});

describe('「タップして始める」の幕のための状態（running / onStateChange）', () => {
  it('自動再生が許されないあいだは running が false。タップで resume されると true になり、購読に知らせる', () => {
    FakeContext.resumeTo = 'suspended';
    const a = new AudioManager();
    a.unlock();
    expect(a.running).toBe(false);
    const seen: boolean[] = [];
    const off = a.onStateChange(() => seen.push(a.running));
    ctxOf().setState('running'); // タップで resume されて、鳴り始めた
    expect(a.running).toBe(true);
    expect(seen).toEqual([true]);
    off();
    ctxOf().setState('suspended');
    expect(seen).toEqual([true]); // 解除後は知らせない
  });

  it('自動再生が許される環境では、unlock() のすぐあとから running', () => {
    const a = new AudioManager();
    a.unlock();
    expect(a.running).toBe(true);
  });

  it('作り直したあとの AudioContext の変化も、同じ購読に届く', () => {
    const a = new AudioManager();
    a.unlock();
    const seen: number[] = [];
    a.onStateChange(() => seen.push(FakeContext.instances.length));
    fire('click');
    ctxOf().state = 'interrupted';
    fire('click'); // 作り直す
    expect(FakeContext.instances).toHaveLength(2);
    ctxOf().setState('running');
    expect(seen.at(-1)).toBe(2);
  });
});
