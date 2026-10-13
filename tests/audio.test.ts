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
  close = vi.fn(async () => { this.state = 'closed'; });
  gains: Array<Record<string, unknown>> = [];
  createGain = () => { const n = node(); this.gains.push(n); return n; };
  createBiquadFilter = node;
  createOscillator = node;
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
  it('最初のタップ（どこでも）で AudioContext を作り、BGM を始める。タップ前は何もしない', () => {
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
