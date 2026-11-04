// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ScannerDeps } from '../camera';
import type { CameraPermission } from '../model';
import { detectBrowser } from '../model';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../data', async (orig) => {
  const real = await orig<typeof import('../data')>();
  return {
    ...real,
    fetchDoorList: vi.fn(async () => ({ result: 'ok', truncated: false, inCount: 0, totalCount: 2, loadedAt: Date.parse('2026-10-29T21:30:00Z'), rows: [] })),
    checkInTicket: vi.fn(), checkInByCode: vi.fn(), checkInById: vi.fn(),
  };
});
import { Door } from '../DoorScreen';

const UA = {
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
  inapp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0',
} as const;

type Cam = 'available' | 'none' | 'failed';
function mk(perm: CameraPermission | null, cam: Cam, denyUntilTap = false) {
  let allowed = !denyUntilTap;
  const getStream = vi.fn(async () => {
    if (cam === 'none') throw Object.assign(new Error('x'), { name: 'NotFoundError' });
    if (cam === 'failed') throw Object.assign(new Error('x'), { name: 'AbortError' });
    if (!allowed) throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
    return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
  });
  const deps: ScannerDeps = { getStream, makeDetector: async () => async () => null, every: 5, ...(perm ? { permission: async () => perm } : {}) };
  return { deps, getStream, allow: () => { allowed = true; } };
}
function show(deps: ScannerDeps, shortCodes: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><Door seriesId="s1" deps={deps} shortCodes={shortCodes} /></MemoryRouter></QueryClientProvider>);
}
const has = (id: string) => !!screen.queryByTestId(id);
const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
beforeEach(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
afterEach(cleanup);

describe('detectBrowser', () => {
  it.each([['chrome', 'chrome'], ['ios', 'ios'], ['inapp', 'inapp']] as const)('%s', (k, want) => expect(detectBrowser(UA[k])).toBe(want));
});

// permission state x browser x camera x short-code flag
const PERMS: Array<CameraPermission | null> = ['granted', 'prompt', null, 'denied'];
const BROWSERS = ['chrome', 'ios', 'inapp'] as const;
const CAMS: Cam[] = ['available', 'none', 'failed'];
const cases = PERMS.flatMap((p) => BROWSERS.flatMap((b) => CAMS.flatMap((c) => [true, false].map((f) => [p, b, c, f] as const))));

describe('door camera help matrix', () => {
  it.each(cases)('perm=%s browser=%s camera=%s shortCode=%s', async (perm, b, cam, flag) => {
    setUA(UA[b]);
    const m = mk(perm ?? 'unknown', cam);
    show(m.deps, flag);
    const asks = perm === 'prompt' || perm === null;
    if (perm === 'denied') {
      await waitFor(() => expect(has('door-cam-steps')).toBe(true));
      expect(m.getStream).not.toHaveBeenCalled();
      expect(has('door-cam-retry')).toBe(true);
      expect(has('door-cam-start')).toBe(false);
      expect(screen.getByTestId('door-cam-steps').textContent).toMatch(b === 'ios' ? /Website Settings/ : b === 'chrome' ? /padlock/ : /browser settings/);
    } else if (asks) {
      await waitFor(() => expect(has('door-cam-start')).toBe(true));
      expect(m.getStream).not.toHaveBeenCalled(); // never asks on load
      expect(has('door-cam-steps')).toBe(false);
      fireEvent.click(screen.getByTestId('door-cam-start'));
      await waitFor(() => expect(m.getStream).toHaveBeenCalledTimes(1));
    } else {
      await waitFor(() => expect(m.getStream).toHaveBeenCalled());
      expect(has('door-cam-start')).toBe(false);
    }
    // the code box is always there on the Scan tab; none/failed open the list, which then has the box too
    await waitFor(() => expect(has('door-codebox')).toBe(true));
    if (cam === 'available' && perm !== 'denied') await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe(asks ? 'on' : 'on'));
    // no text points at a missing control
    const text = document.body.textContent ?? '';
    if (/Try the camera again/.test(text)) expect(has('door-cam-retry')).toBe(true);
    if (/tap Start camera/i.test(text)) expect(has('door-cam-start')).toBe(true);
  });
});

describe('after a Don’t allow', () => {
  it('shows the steps, Try again re-asks once, a second no says Still blocked, a yes starts the camera', async () => {
    setUA(UA.chrome);
    const m = mk('prompt', 'available', true);
    show(m.deps, false);
    fireEvent.click(await screen.findByTestId('door-cam-start'));
    await waitFor(() => expect(has('door-cam-steps')).toBe(true));
    expect(screen.queryByText(/Still blocked/)).toBeNull();
    expect(has('door-codebox')).toBe(true);
    fireEvent.click(screen.getByTestId('door-cam-retry'));
    await waitFor(() => expect(screen.getByText(/Still blocked/)).toBeTruthy());
    expect(m.getStream).toHaveBeenCalledTimes(2);
    m.allow();
    fireEvent.click(screen.getByTestId('door-cam-retry'));
    await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe('on'));
  });
  it('Open tonight’s list is a real control that opens the list', async () => {
    setUA(UA.chrome);
    show(mk('denied', 'available').deps, false);
    fireEvent.click(await screen.findByTestId('door-cam-openlist'));
    expect(screen.getByTestId('door-tab-list').getAttribute('aria-current')).toBe('page');
  });
  it('a permission change in settings starts the camera without a tap', async () => {
    setUA(UA.chrome);
    const m = mk('denied', 'available');
    let fire: (p: CameraPermission) => void = () => {};
    m.deps.watchPermission = (cb) => { fire = cb; return () => {}; };
    let perm: CameraPermission = 'denied';
    m.deps.permission = async () => perm;
    show(m.deps, false);
    await screen.findByTestId('door-cam-steps');
    perm = 'granted'; fire('granted');
    await waitFor(() => expect(screen.getByTestId('door-camera').getAttribute('data-cam')).toBe('on'));
  });
});
