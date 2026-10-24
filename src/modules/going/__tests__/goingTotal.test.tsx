// @vitest-environment jsdom
/**
 * The organiser's Stats total (get_my_organiser_going_total_v1): parse x copy x
 * hook x component, table-driven over the reply shapes. The prod shape today is
 * {0,0,0} for every organiser (all going rows are on past nights).
 */
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  on: true,
  rpc: vi.fn(),
  user: { id: 'u1' } as null | { id: string; is_anonymous?: boolean },
  authLoading: false,
}));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: h.authLoading }),
}));

import {
  GOING_COPY,
  GOING_RPC,
  GoingTotalStat,
  goingKeys,
  invalidateGoing,
  organiserGoingStateFor,
  organiserTotalText,
  parseMyOrganiserGoingTotal,
  useMyOrganiserGoingTotal,
  type MyOrganiserGoingTotal,
  type OrganiserGoingView,
} from '@/modules/going';

const T = (going_total: number, nights: number, events: number): MyOrganiserGoingTotal => ({ going_total, nights, events });
const ZERO = T(0, 0, 0);

/** Every reply shape: [name, raw reply, parsed]. */
const SHAPES: [string, unknown, MyOrganiserGoingTotal][] = [
  ['7 across 4 nights, 3 events', { going_total: 7, nights: 4, events: 3 }, T(7, 4, 3)],
  ['zero (prod today)', { going_total: 0, nights: 0, events: 0 }, ZERO],
  ['one of each', { going_total: 1, nights: 1, events: 1 }, T(1, 1, 1)],
  ['3 taps on 1 night', { going_total: 3, nights: 1, events: 1 }, T(3, 1, 1)],
  ['huge', { going_total: 123456, nights: 999, events: 500 }, T(123456, 999, 500)],
  ['null', null, ZERO],
  ['string', '{"going_total":7}', ZERO],
  ['array', [7, 4, 3], ZERO],
  ['fields as strings', { going_total: '7', nights: '4', events: '3' }, ZERO],
  ['negatives', { going_total: -7, nights: -4, events: -1 }, ZERO],
  ['floats', { going_total: 7.5, nights: 4.2, events: 1 }, T(0, 0, 1)],
  ['NaN / Infinity', { going_total: NaN, nights: Infinity, events: -Infinity }, ZERO],
  ['missing fields', { nights: 2 }, T(0, 2, 0)],
  ['empty object', {}, ZERO],
];

const READY: OrganiserGoingView = organiserGoingStateFor({ enabled: true, signedIn: true, status: 'success' });

let qc: QueryClient;
const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

beforeEach(() => {
  h.on = true;
  h.user = { id: 'u1' };
  h.authLoading = false;
  h.rpc.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
});
afterEach(() => {
  cleanup();
  qc.clear();
});

describe('parseMyOrganiserGoingTotal x every shape', () => {
  it.each(SHAPES)('%s', (_n, raw, want) => {
    expect(() => parseMyOrganiserGoingTotal(raw)).not.toThrow();
    expect(parseMyOrganiserGoingTotal(raw)).toEqual(want);
  });
});

/** Verbs the zero hint may lead with: it must say what the organiser can DO. */
const ACTION_VERBS = ['share', 'post', 'send', 'tap', 'add'];

describe('organiserTotalText x every shape', () => {
  it.each(SHAPES)('%s', (_n, raw) => {
    const total = parseMyOrganiserGoingTotal(raw);
    const t = organiserTotalText(total);
    const all = [t.text, t.label, t.hint ?? ''].join(' ');
    expect(all.toLowerCase()).not.toContain('people');
    expect(all.toLowerCase()).not.toContain('cancel');
    if (total.going_total === 0) {
      expect(t.text).toBe('No one going yet');
      expect(t.figure).toBeNull();
      expect(all).not.toMatch(/\d+\s*nights?/);
      expect(all).not.toMatch(/\d/);
      expect(t.hint && t.hint.length).toBeTruthy();
      expect(ACTION_VERBS.some((v) => t.hint!.toLowerCase().split(/\W+/).includes(v))).toBe(true);
    } else {
      expect(t.figure).toBe(total.going_total.toLocaleString('en-GB'));
      expect(t.hint).toBeNull();
      expect(t.text).toBe(`${t.figure} ${t.label}`);
    }
  });
  it.each([
    [T(7, 4, 3), '7 going across 4 nights'],
    [T(1, 1, 1), '1 going across 1 night'],
    [T(3, 1, 1), '3 going across 1 night'],
    [T(123456, 999, 500), '123,456 going across 999 nights'],
    [T(2, 2, 1), '2 going across 2 nights'],
    // An inconsistent reply (taps but no night) still names one night, never "0 nights".
    [T(5, 0, 0), '5 going across 1 night'],
  ])('%o -> %s', (total, want) => {
    expect(organiserTotalText(total).text).toBe(want);
  });
  it('the copy source carries no raw non-ASCII punctuation', () => {
    for (const f of ['goingCopy.ts', 'GoingTotalStat.tsx', 'useMyOrganiserGoingTotal.ts', 'goingRpc.ts']) {
      const src = readFileSync(`src/modules/going/${f}`, 'utf8');
      expect(src, f).not.toMatch(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u00b7]/);
    }
  });
});

const callsOf = (fn: string) => h.rpc.mock.calls.filter(([n]) => n === fn);

describe('useMyOrganiserGoingTotal', () => {
  it('switch off: state off, no RPC', async () => {
    h.on = false;
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    expect(result.current.view.state).toBe('off');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['signed out', null],
    ['anonymous', { id: 'a1', is_anonymous: true }],
  ])('%s: not_signed_in without a request', async (_n, user) => {
    h.user = user;
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    expect(result.current.view.state).toBe('not_signed_in');
    expect(result.current.total).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('auth still resolving: loading, no request', async () => {
    h.user = null;
    h.authLoading = true;
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    expect(result.current.view.state).toBe('loading');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(SHAPES)('signed in, reply %s: exactly ONE call with no args, parsed total', async (_n, raw, want) => {
    h.rpc.mockResolvedValue({ data: raw, error: null });
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    expect(result.current.total).toEqual(want);
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(callsOf(GOING_RPC.myTotal)).toEqual([['get_my_organiser_going_total_v1', undefined]]);
  });
  it('not_signed_in refusal: not retried, signed-out state', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_signed_in' } });
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('not_signed_in'));
    await new Promise((r) => setTimeout(r, 30));
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });
  it('network failure: retried once, then error + Try again', async () => {
    h.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('error'));
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(result.current.view.action).toEqual({ kind: 'retry', label: GOING_COPY.retry });
    h.rpc.mockResolvedValue({ data: { going_total: 2, nights: 1, events: 1 }, error: null });
    result.current.retry();
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    expect(result.current.total).toEqual(T(2, 1, 1));
  });
  it('a failed RE-read keeps the numbers (refreshFailed)', async () => {
    h.rpc.mockResolvedValue({ data: { going_total: 7, nights: 4, events: 3 }, error: null });
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    h.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    result.current.retry();
    await waitFor(() => expect(result.current.refreshFailed).toBe(true));
    expect(result.current.view.state).toBe('ready');
    expect(result.current.total).toEqual(T(7, 4, 3));
  });
  it('a REFUSAL on a re-read is not kept: the numbers go, the signed-out state shows', async () => {
    h.rpc.mockResolvedValue({ data: { going_total: 7, nights: 4, events: 3 }, error: null });
    const { result } = renderHook(() => useMyOrganiserGoingTotal(), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    h.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'not_signed_in' } });
    result.current.retry();
    await waitFor(() => expect(result.current.view.state).toBe('not_signed_in'));
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.total).toBeNull();
  });
  it('a going tap anywhere (invalidateGoing) marks the total stale', async () => {
    qc.setQueryData(goingKeys.organiserTotal('u1'), T(1, 1, 1));
    await invalidateGoing(qc, 'occ-1');
    expect(qc.getQueryState(goingKeys.organiserTotal('u1'))?.isInvalidated).toBe(true);
  });
});

const VIEWS: [string, OrganiserGoingView][] = [
  ['off', organiserGoingStateFor({ enabled: false, signedIn: true, status: 'success' })],
  ['loading', organiserGoingStateFor({ enabled: true, signedIn: true, status: 'pending' })],
  ['not_signed_in', organiserGoingStateFor({ enabled: true, signedIn: false, status: 'pending' })],
  ['error', organiserGoingStateFor({ enabled: true, signedIn: true, status: 'error', error: 'network' })],
];

describe('GoingTotalStat x every state', () => {
  it.each(SHAPES)('ready x %s', (_n, raw) => {
    const total = parseMyOrganiserGoingTotal(raw);
    const retry = vi.fn();
    render(<GoingTotalStat view={READY} total={total} retry={retry} fetching={false} refreshFailed={false} />);
    const t = organiserTotalText(total);
    const card = screen.getByTestId('going-total-stat');
    expect(card.dataset.state).toBe('ready');
    // Every word on screen is readable (nothing aria-hidden): the card reads as the sentence.
    expect(card.querySelector('[aria-hidden]')).toBeNull();
    expect(card.textContent?.replace(/\s+/g, ' ')).toContain(t.figure === null ? t.label : `${t.figure}${t.label}`);
    expect(card.textContent).not.toMatch(/people/i);
    if (total.going_total === 0) {
      expect(screen.getByTestId('going-total-figure').textContent).toBe('No one going yet');
      expect(screen.getByTestId('going-total-hint').textContent).toBe(GOING_COPY.orgTotalNoneHint);
      expect(card.textContent).not.toMatch(/\d/);
    } else {
      expect(screen.getByTestId('going-total-figure').textContent).toBe(total.going_total.toLocaleString('en-GB'));
      expect(screen.getByTestId('going-total-label').textContent).toBe(t.label);
      expect(screen.queryByTestId('going-total-hint')).toBeNull();
    }
    // A ready total offers no control, and an untouched render sends nothing.
    expect(screen.queryByRole('button')).toBeNull();
    expect(retry).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each(VIEWS)('%s', (name, view) => {
    const retry = vi.fn();
    const onSignIn = vi.fn();
    const { container } = render(<GoingTotalStat view={view} total={null} retry={retry} fetching={false} refreshFailed={false} onSignIn={onSignIn} />);
    if (name === 'off') {
      expect(container.innerHTML).toBe('');
      return;
    }
    expect(screen.getByTestId('going-total-stat').dataset.state).toBe(name);
    expect(screen.getByTestId('going-load-state').textContent).toContain(view.words);
    const btn = screen.queryByTestId('going-load-action');
    if (name === 'loading') {
      expect(btn).toBeNull();
    } else {
      expect(btn?.textContent).toBe(name === 'error' ? 'Try again' : GOING_COPY.orgSignIn);
      expect((btn as HTMLElement).style.minHeight).toBe('44px');
      expect(retry).not.toHaveBeenCalled();
      expect(onSignIn).not.toHaveBeenCalled();
      fireEvent.click(btn as HTMLElement);
      expect(name === 'error' ? retry : onSignIn).toHaveBeenCalledTimes(1);
    }
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('signed out with no onSignIn: the words alone, no dead button', () => {
    render(<GoingTotalStat view={VIEWS[2][1]} total={null} retry={vi.fn()} fetching={false} refreshFailed={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(GOING_COPY.orgNotSignedIn)).toBeTruthy();
  });
  it.each(SHAPES.slice(0, 2))('a failed re-read x %s: total stays, out-of-date note + Try again', (_n, raw) => {
    const retry = vi.fn();
    const total = parseMyOrganiserGoingTotal(raw);
    render(<GoingTotalStat view={READY} total={total} retry={retry} fetching={false} refreshFailed />);
    expect(screen.getByTestId('going-total-figure').textContent).toBeTruthy();
    expect(screen.getByTestId('going-total-stale').textContent).toContain(GOING_COPY.orgTotalStale);
    const btn = screen.getByTestId('going-total-retry');
    expect(btn.style.minHeight).toBe('44px');
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it('a retry in flight disables Try again', () => {
    render(<GoingTotalStat view={VIEWS[3][1]} total={null} retry={vi.fn()} fetching refreshFailed={false} />);
    expect((screen.getByTestId('going-load-action') as HTMLButtonElement).disabled).toBe(true);
  });
});
