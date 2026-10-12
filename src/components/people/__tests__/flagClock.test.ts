// @vitest-environment jsdom
/**
 * The shared animation clock (flagClock.ts): ONE requestAnimationFrame loop for every
 * flag, only flags on screen are drawn, nothing runs while the tab is hidden, and
 * prefers-reduced-motion means no loop at all (each flag drawn once, still).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STILL_T } from '../flagWave';

type IOCb = (entries: { target: Element; isIntersecting: boolean }[]) => void;
let ioCb: IOCb;
let rafQueue: FrameRequestCallback[];
let rafCalls: number;
let reduced: boolean;
let mqListeners: (() => void)[];

async function freshClock() {
  vi.resetModules();
  return import('../flagClock');
}

const tick = (t: number) => {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((cb) => cb(t));
};
const show = (els: Element[], on = true) => ioCb(els.map((target) => ({ target, isIntersecting: on })));
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  rafQueue = [];
  rafCalls = 0;
  reduced = false;
  mqListeners = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCalls++;
    rafQueue.push(cb);
    return rafCalls;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafQueue = [];
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IOCb) {
        ioCb = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.matchMedia = ((q: string) => ({
    get matches() {
      return q.includes('reduce') && reduced;
    },
    addEventListener: (_: string, fn: () => void) => mqListeners.push(fn),
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  setHidden(false);
});

afterEach(() => vi.unstubAllGlobals());

describe('flagClock', () => {
  it('100 flags share ONE loop, and only the visible ones are drawn', async () => {
    const { registerFlag, getFlagClockStats } = await freshClock();
    const els = Array.from({ length: 100 }, () => document.createElement('canvas'));
    const draws = els.map(() => vi.fn());
    els.forEach((el, i) => registerFlag(el, draws[i]));
    expect(rafCalls).toBe(0); // nothing visible yet: no loop
    show(els.slice(0, 12));
    expect(rafQueue).toHaveLength(1);
    tick(16);
    tick(32);
    expect(rafQueue).toHaveLength(1); // still one pending frame, not one per flag
    expect(draws.slice(0, 12).every((d) => d.mock.calls.length === 2)).toBe(true);
    expect(draws.slice(12).every((d) => d.mock.calls.length === 0)).toBe(true);
    expect(getFlagClockStats().flagsLastFrame).toBe(12);
  });

  it('stops while the tab is hidden and resumes on return', async () => {
    const { registerFlag, getFlagClockStats } = await freshClock();
    const el = document.createElement('canvas');
    const draw = vi.fn();
    registerFlag(el, draw);
    show([el]);
    tick(16);
    setHidden(true);
    expect(getFlagClockStats().running).toBe(false);
    tick(32);
    expect(draw).toHaveBeenCalledTimes(1);
    setHidden(false);
    // (earlier tests' module instances also hear the event; this instance runs one loop)
    expect(getFlagClockStats().running).toBe(true);
    tick(48);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('stops when every flag scrolls off screen, and on unregister', async () => {
    const { registerFlag } = await freshClock();
    const el = document.createElement('canvas');
    const unregister = registerFlag(el, vi.fn());
    show([el]);
    show([el], false);
    expect(rafQueue).toHaveLength(0);
    show([el]);
    expect(rafQueue).toHaveLength(1);
    unregister();
    expect(rafQueue).toHaveLength(0);
  });

  it('reduced motion: no loop at all, each flag drawn once at the still frame', async () => {
    reduced = true;
    const { registerFlag, drawNow } = await freshClock();
    const el = document.createElement('canvas');
    const draw = vi.fn();
    registerFlag(el, draw);
    show([el]);
    expect(rafCalls).toBe(0);
    expect(draw).toHaveBeenCalledWith(STILL_T);
    drawNow(el);
    expect(draw).toHaveBeenLastCalledWith(STILL_T);
    expect(rafCalls).toBe(0);
  });

  it('turning reduced motion on mid-animation stops the loop and freezes the flags', async () => {
    const { registerFlag } = await freshClock();
    const el = document.createElement('canvas');
    const draw = vi.fn();
    registerFlag(el, draw);
    show([el]);
    tick(16);
    reduced = true;
    mqListeners.forEach((fn) => fn());
    expect(rafQueue).toHaveLength(0);
    expect(draw).toHaveBeenLastCalledWith(STILL_T);
  });
});
