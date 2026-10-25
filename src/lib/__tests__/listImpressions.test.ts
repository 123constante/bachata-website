// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: vi.fn() }));
vi.mock('@/lib/viewerSession', () => ({ getViewerSession: vi.fn(() => 'sess-1') }));
vi.mock('@/lib/featureFlags', () => ({ flags: { listImpressions: true, enableEventTracking: true } }));

import { getViewerSession } from '@/lib/viewerSession';
import { flags } from '@/lib/featureFlags';
import {
  createImpressionController,
  IDLE_FLUSH_MS,
  MAX_IDS_PER_CALL,
  VISIBLE_MS,
} from '@/lib/listImpressions';

type IOCb = (entries: Partial<IntersectionObserverEntry>[]) => void;
let cb: IOCb;
class FakeIO {
  constructor(c: IOCb) { cb = c; }
  observe() {}
  unobserve() {}
  disconnect() {}
}
const see = (el: Element, ratio: number) =>
  cb([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }]);

const mk = () => document.createElement('div');

describe('listImpressions controller', () => {
  const send = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    send.mockReset();
    (flags as { listImpressions: boolean }).listImpressions = true;
    (flags as { enableEventTracking: boolean }).enableEventTracking = true;
    vi.mocked(getViewerSession).mockReturnValue('sess-1');
    vi.stubGlobal('IntersectionObserver', FakeIO);
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const setup = () => {
    const c = createImpressionController('home', send);
    c.start();
    return c;
  };

  it('counts a card visible >= 50% for 1 s, then flushes once on dispose', () => {
    const c = setup();
    const a = mk(); const b = mk();
    c.track('a')(a); c.track('b')(b);
    see(a, 0.5); see(b, 1);
    vi.advanceTimersByTime(VISIBLE_MS);
    expect(send).not.toHaveBeenCalled();
    c.dispose();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('home', ['a', 'b'], 'sess-1');
  });

  it('does not count under 50% or when it leaves before 1 s', () => {
    const c = setup();
    const a = mk(); const b = mk();
    c.track('a')(a); c.track('b')(b);
    see(a, 0.49);
    see(b, 1);
    vi.advanceTimersByTime(VISIBLE_MS - 100);
    see(b, 0);
    vi.advanceTimersByTime(5000);
    c.dispose();
    expect(send).not.toHaveBeenCalled();
  });

  it('de-dupes (surface, id) per mount', () => {
    const c = setup();
    const a = mk();
    c.track('a')(a);
    see(a, 1); vi.advanceTimersByTime(VISIBLE_MS);
    see(a, 0); see(a, 1); vi.advanceTimersByTime(VISIBLE_MS);
    c.flush();
    c.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual(['a']);
  });

  it('chunks at 60 ids per call', () => {
    const c = setup();
    for (let i = 0; i < 130; i++) {
      const el = mk();
      c.track(`id${i}`)(el);
      see(el, 1);
    }
    vi.advanceTimersByTime(VISIBLE_MS);
    c.flush();
    expect(send.mock.calls.map((x) => x[1].length)).toEqual([MAX_IDS_PER_CALL, MAX_IDS_PER_CALL, 10]);
  });

  it('flushes when the page is hidden', () => {
    const c = setup();
    const a = mk();
    c.track('a')(a); see(a, 1); vi.advanceTimersByTime(VISIBLE_MS);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(send).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('flushes on pagehide and on the 5 s idle debounce', () => {
    const c = setup();
    const a = mk(); const b = mk();
    c.track('a')(a); c.track('b')(b);
    see(a, 1); vi.advanceTimersByTime(VISIBLE_MS);
    window.dispatchEvent(new Event('pagehide'));
    expect(send).toHaveBeenCalledTimes(1);
    see(b, 1); vi.advanceTimersByTime(VISIBLE_MS);
    vi.advanceTimersByTime(IDLE_FLUSH_MS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toEqual(['b']);
    c.dispose();
  });

  it.each([
    ['webdriver', () => Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })],
    ['no viewer session', () => vi.mocked(getViewerSession).mockReturnValue('' as never)],
    ['listImpressions flag off', () => { (flags as { listImpressions: boolean }).listImpressions = false; }],
    ['enableEventTracking off', () => { (flags as { enableEventTracking: boolean }).enableEventTracking = false; }],
  ])('makes zero calls: %s', (_n, arrange) => {
    arrange();
    const c = setup();
    const a = mk();
    c.track('a')(a);
    if (cb) see(a, 1);
    vi.advanceTimersByTime(VISIBLE_MS + IDLE_FLUSH_MS);
    c.dispose();
    expect(send).not.toHaveBeenCalled();
  });
});
