// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn((..._a: unknown[]) => Promise.resolve({ error: null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => (rpc as any)(...a) } }));
vi.mock('@/lib/viewerSession', () => ({ getViewerSession: () => 'sess-1', getViewerSessionId: () => 'sess-1' }));
vi.mock('@/lib/featureFlags', () => ({ flags: { enableEventTracking: true } }));

import { captureRefCode, refCodeForTracking } from '@/lib/refCode';
import { renderHook } from '@testing-library/react';
import { useRecordEventView } from '@/modules/event-page/useRecordEventView';

beforeEach(() => { window.sessionStorage.clear(); rpc.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const SHAPES: Array<[string, string, string | null]> = [
  ['valid 10-char', '?ref=abcde12345', 'abcde12345'],
  ['uppercase is lower-cased', '?ref=ABCDE12345', 'abcde12345'],
  ['6 chars (min)', '?ref=abc123', 'abc123'],
  ['12 chars (max)', '?ref=abcdef123456', 'abcdef123456'],
  ['5 chars rejected', '?ref=abc12', null],
  ['13 chars rejected', '?ref=abcdef1234567', null],
  ['hyphen rejected', '?ref=abc-def123', null],
  ['empty rejected', '?ref=', null],
  ['repeated: first wins', '?ref=firstcode1&ref=secondcode', 'firstcode1'],
  ['absent', '?utm=x', null],
  ['no query', '', null],
];

describe('captureRefCode shapes', () => {
  it.each(SHAPES)('%s', (_n, search, expected) => {
    captureRefCode(search);
    expect(refCodeForTracking()).toBe(expected);
  });

  it('a later valid ref replaces; an invalid one leaves it unchanged', () => {
    captureRefCode('?ref=firstcode1');
    captureRefCode('?ref=bad');
    expect(refCodeForTracking()).toBe('firstcode1');
    captureRefCode('?ref=secondcode');
    expect(refCodeForTracking()).toBe('secondcode');
  });

  it('sessionStorage throwing never crashes', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => captureRefCode('?ref=abcde12345')).not.toThrow();
    expect(captureRefCode('?ref=abcde12345')).toBe('abcde12345');
    expect(refCodeForTracking()).toBeNull();
  });
});

describe('useRecordEventView args', () => {
  const base = {
    p_event_id: 'ev1', p_viewer_session_id: 'sess-1', p_source: 'public_event_page',
    p_user_agent: navigator.userAgent,
  };
  function run() {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useRecordEventView('ev1'));
    vi.advanceTimersByTime(3100);
    unmount();
  }
  // jsdom sets navigator.webdriver false; guard in case it is truthy.
  it('with a code: args include p_ref_code, source untouched', () => {
    captureRefCode('?ref=abcde12345');
    run();
    expect(rpc).toHaveBeenCalledWith('record_event_view_v1', { ...base, p_ref_code: 'abcde12345' });
  });
  it('without a code: exact arg object, no key', () => {
    run();
    expect(rpc).toHaveBeenCalledWith('record_event_view_v1', base);
    expect(Object.keys(rpc.mock.calls[0][1] as object)).not.toContain('p_ref_code');
  });
});

describe('recordEventLinkClick body', () => {
  async function click() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'k');
    vi.resetModules();
    const f = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', f);
    const ref = await import('@/lib/refCode');
    return { f, ref, mod: await import('@/lib/eventLinkClicks') };
  }
  const expectedBase = {
    p_event_id: 'ev1', p_link_type: 'ticket', p_target_url: null,
    p_session_id: 'sess-1', p_source: 'public_event_page', p_user_agent: navigator.userAgent,
  };
  it('with a code: body includes p_ref_code', async () => {
    const { f, ref, mod } = await click();
    ref.captureRefCode('?ref=abcde12345');
    mod.recordEventLinkClick({ eventId: 'ev1', linkType: 'ticket', source: 'public_event_page' });
    const body = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(body).toEqual({ ...expectedBase, p_ref_code: 'abcde12345' });
  });
  it('without a code: body identical to today (key absent)', async () => {
    const { f, mod } = await click();
    mod.recordEventLinkClick({ eventId: 'ev1', linkType: 'ticket', source: 'public_event_page' });
    const body = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(body).toEqual(expectedBase);
    expect('p_ref_code' in body).toBe(false);
  });
});
