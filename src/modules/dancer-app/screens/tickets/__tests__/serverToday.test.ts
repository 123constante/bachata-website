import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerTodayForTests, serverTodayKey, todayKeyFromDateHeader } from '../serverToday';

describe('todayKeyFromDateHeader', () => {
  it.each([
    ['Wed, 18 Nov 2026 12:00:00 GMT', '2026-11-18'],
    ['Wed, 18 Nov 2026 23:30:00 GMT', '2026-11-18'], // London winter = UTC
    ['Sat, 20 Jun 2026 23:30:00 GMT', '2026-06-21'], // BST: already tomorrow in London
  ])('%s -> %s', (h, k) => expect(todayKeyFromDateHeader(h)).toBe(k));
  it.each([[null], [undefined], [''], ['not a date']])('%s -> null', (h) => expect(todayKeyFromDateHeader(h as string | null)).toBeNull());
});

describe('serverTodayKey (R2-N1)', () => {
  beforeEach(() => { resetServerTodayForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2020-01-01T12:00:00Z')); }); // a wrong phone clock
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('uses the server Date header, not the device clock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers: new Headers({ date: 'Wed, 18 Nov 2026 19:00:00 GMT' }) }));
    expect(await serverTodayKey()).toBe('2026-11-18');
  });
  it('is read once per load', async () => {
    const f = vi.fn().mockResolvedValue({ headers: new Headers({ date: 'Wed, 18 Nov 2026 19:00:00 GMT' }) });
    vi.stubGlobal('fetch', f);
    await serverTodayKey(); await serverTodayKey();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('falls back to the device clock when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await serverTodayKey()).toBe('2020-01-01');
  });
  it('falls back to the device clock when there is no usable header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers: new Headers() }));
    expect(await serverTodayKey()).toBe('2020-01-01');
  });
});
