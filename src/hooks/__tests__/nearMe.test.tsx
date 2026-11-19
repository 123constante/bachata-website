// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: { ...m.flags, nearMe: true } };
});

import { FIX_KEY, FIX_TTL_MS, formatNearMiles, isRoughFix, readFix } from '@/lib/geo/nearMeFix';
import { useGeolocation } from '@/hooks/useGeolocation';
import { GeolocationProvider } from '@/hooks/GeolocationProvider';
import { denialCopy } from '@/lib/geo/denialCopy';

const wrapper = ({ children }: { children: ReactNode }) => <GeolocationProvider>{children}</GeolocationProvider>;

let getCurrent: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.localStorage.clear();
  getCurrent = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: getCurrent }, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
    configurable: true,
  });
});
afterEach(() => vi.useRealTimers());

describe('nearMe fix store', () => {
  it('keeps a fix under 30 minutes and drops one over it', () => {
    const now = 1_000_000_000;
    window.localStorage.setItem(FIX_KEY, JSON.stringify({ lat: 51.5, lng: -0.1, accuracy: 20, ts: now - FIX_TTL_MS + 1000 }));
    expect(readFix(now)?.lat).toBe(51.5);
    window.localStorage.setItem(FIX_KEY, JSON.stringify({ lat: 51.5, lng: -0.1, accuracy: 20, ts: now - FIX_TTL_MS - 1000 }));
    expect(readFix(now)).toBeNull();
    expect(window.localStorage.getItem(FIX_KEY)).toBeNull();
  });
  it('formats distances with a tilde, always', () => {
    expect(formatNearMiles(2.04)).toBe('~2.0 mi');
    expect(formatNearMiles(14.6)).toBe('~15 mi');
  });
  it('flags only fixes rougher than 5 km', () => {
    expect(isRoughFix(4999)).toBe(false);
    expect(isRoughFix(5001)).toBe(true);
    expect(isRoughFix(null)).toBe(false);
  });
});

describe('GeolocationProvider', () => {
  it('never asks for location on mount, even with a stored fix', async () => {
    window.localStorage.setItem(FIX_KEY, JSON.stringify({ lat: 51.5, lng: -0.1, accuracy: 20, ts: Date.now() }));
    const { result } = renderHook(() => useGeolocation(), { wrapper });
    await act(async () => {});
    expect(getCurrent).not.toHaveBeenCalled();
    expect(result.current.status).toBe('granted'); // restored because permission is already granted
  });
  it('does not restore a fix when permission is not granted', async () => {
    (navigator.permissions.query as ReturnType<typeof vi.fn>).mockResolvedValue({ state: 'prompt', addEventListener: vi.fn() });
    window.localStorage.setItem(FIX_KEY, JSON.stringify({ lat: 51.5, lng: -0.1, accuracy: 20, ts: Date.now() }));
    const { result } = renderHook(() => useGeolocation(), { wrapper });
    await act(async () => {});
    expect(result.current.status).toBe('idle');
    expect(result.current.coords).toBeNull();
  });
  it('asks only on request() and stores accuracy', async () => {
    getCurrent.mockImplementation((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 51.5, longitude: -0.1, accuracy: 9000 } }),
    );
    const { result } = renderHook(() => useGeolocation(), { wrapper });
    await act(async () => {});
    expect(getCurrent).not.toHaveBeenCalled();
    act(() => result.current.request());
    expect(getCurrent).toHaveBeenCalledTimes(1);
    expect(result.current.accuracy).toBe(9000);
    expect(readFix()?.accuracy).toBe(9000);
  });
  it('treats a Chrome dismissed prompt as "dismissed", not a refusal', async () => {
    getCurrent.mockImplementation((_ok: unknown, err: (e: unknown) => void) =>
      err({ code: 1, message: 'User denied Geolocation: Permission dismissed' }),
    );
    const { result } = renderHook(() => useGeolocation(), { wrapper });
    act(() => result.current.request());
    expect(result.current.reason).toBe('dismissed');
    expect(denialCopy('dismissed', false)).toMatch(/^Not now/);
  });
  it('ignores a second tap while loading', async () => {
    getCurrent.mockImplementation(() => undefined);
    const { result } = renderHook(() => useGeolocation(), { wrapper });
    act(() => result.current.request());
    act(() => result.current.request());
    expect(getCurrent).toHaveBeenCalledTimes(1);
  });
  it('splits denial copy for the installed app', () => {
    expect(denialCopy('denied', false, true)).toMatch(/this app/);
    expect(denialCopy('denied', false, false)).toMatch(/browser/);
  });
});
