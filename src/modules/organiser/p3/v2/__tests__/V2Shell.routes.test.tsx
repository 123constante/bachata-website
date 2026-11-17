// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
 * Organiser shell V2: flag OFF = the P3 shell exactly as before (same frame, same four tabs);
 * flag ON = the slim top bar (Back to Bachata Calendar + event switcher) and the four V2 tabs,
 * and the switcher's choice defaults to the next event and survives a refresh (URL + this visit).
 */
const h = vi.hoisted(() => ({
  f: { organiserShellV2: false, organiserP3: true, organiserDash: true, organiserSelfServe: true } as Record<string, boolean>,
  rows: [] as unknown[],
  home: { isPending: false, isError: false, data: { today: '2026-11-17', organisers: [] }, refetch: () => undefined } as Record<string, unknown>,
}));
vi.mock('@/lib/featureFlags', async (orig) => ({ ...(await orig<object>()), flags: new Proxy({}, { get: (_t, k) => h.f[k as string] ?? false }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('../../data/useP3Data', async (orig) => ({ ...(await orig<object>()), useP3Home: () => h.home }));
vi.mock('../../data/home', async (orig) => ({ ...(await orig<object>()), rowsOf: () => h.rows }));
vi.mock('../../screens/PageScope', async (orig) => ({
  ...(await orig<object>()),
  usePageScope: () => ({ loading: false, noPage: false, pageId: 'org1', selected: { id: 'org1', name: 'Page', role: 'owner', series: [] }, organisers: [], choose: () => undefined, home: h.home, seriesIds: new Set() }),
}));

import P3Routes, { shellV2On } from '../../shell/P3Routes';
import { P3_BASE } from '../../shell/paths';
import { EVENT_STORE_KEY } from '../eventChoice';
import { BACK_TO, BACK_WORD } from '../V2Shell';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}
function at(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const row = (id: string, name: string, next: string) => ({
  id, name, lifecycle: 'live', next: { date: next }, event: { dates: [] }, status: { past: false, key: 'ok', label: 'Live' }, upcoming: 0, sub: '',
});

beforeEach(() => { h.rows = []; window.sessionStorage.clear(); });
afterEach(() => { cleanup(); h.f.organiserShellV2 = false; h.f.organiserGuestListLive = false; h.f.organiserRaffleLive = false; });

describe('shellV2On: needs all three flags', () => {
  it.each([
    [true, true, true, true], [false, true, true, false], [true, false, true, false], [true, true, false, false],
  ])('V2=%s P3=%s Dash=%s -> %s', (organiserShellV2, organiserP3, organiserDash, want) => {
    expect(shellV2On({ organiserShellV2, organiserP3, organiserDash })).toBe(want);
  });
});

describe('flag OFF: the P3 shell exactly as before', () => {
  it.each([`${P3_BASE}/events`, `${P3_BASE}/stats`])('%s', (path) => {
    const { container } = at(path);
    expect(screen.getByTestId('p3-shell')).toBeTruthy();
    expect(screen.queryByTestId('v2-shell')).toBeNull();
    expect(screen.queryByTestId('v2-back')).toBeNull();
    expect([...container.querySelectorAll('.p3-tab')].map((t) => t.getAttribute('data-tab'))).toEqual(['home', 'events', 'stats', 'you']);
  });
  it('the V2 tab URLs do not exist: they fall back to Home', () => {
    at(`${P3_BASE}/tickets`);
    expect(screen.getByTestId('where').textContent).not.toContain('/tickets');
    expect(screen.queryByTestId('v2-tickets-empty')).toBeNull();
  });
});

describe('flag ON: the V2 shell', () => {
  beforeEach(() => { h.f.organiserShellV2 = true; });
  it('slim top bar: a labelled 44px link to the public landing page, then the four tabs', () => {
    h.rows = [row('a', 'Alpha', '2026-11-30')];
    const { container } = at(`${P3_BASE}/tickets`);
    expect(screen.queryByTestId('p3-shell')).toBeNull();
    const back = screen.getByTestId('v2-back');
    expect(back.textContent).toBe(BACK_WORD);
    expect(back.getAttribute('href')).toBe(BACK_TO);
    expect([...container.querySelectorAll('.p3-tab')].map((t) => t.getAttribute('data-tab'))).toEqual(['events', 'tickets', 'guests', 'raffle']);
    expect(container.querySelector('.p3-tab[aria-current="page"]')?.getAttribute('data-tab')).toBe('tickets');
  });
  it('the bare area URL opens Events, query kept', () => {
    at(`${P3_BASE}?o=org1`);
    expect(screen.getByTestId('where').textContent).toBe(`${P3_BASE}/events?o=org1`);
  });
  it('the switcher defaults to the next event', () => {
    h.rows = [row('a', 'Alpha', '2026-11-30'), row('b', 'Beta', '2026-11-20')];
    at(`${P3_BASE}/tickets`);
    expect((screen.getByTestId('v2-event-switch') as HTMLSelectElement).value).toBe('b');
  });
  it('a pick goes in the URL and this visit, and a refresh keeps it; tabs carry it', () => {
    h.rows = [row('a', 'Alpha', '2026-11-30'), row('b', 'Beta', '2026-11-20')];
    const first = at(`${P3_BASE}/tickets`);
    fireEvent.change(screen.getByTestId('v2-event-switch'), { target: { value: 'a' } });
    expect(screen.getByTestId('where').textContent).toBe(`${P3_BASE}/tickets?e=a`);
    expect(window.sessionStorage.getItem(EVENT_STORE_KEY)).toBe('a');
    expect(first.container.querySelector('.p3-tab[data-tab="raffle"]')?.getAttribute('href')).toBe(`${P3_BASE}/raffle?e=a`);
    cleanup();
    // refresh with the URL
    at(`${P3_BASE}/tickets?e=a`);
    expect((screen.getByTestId('v2-event-switch') as HTMLSelectElement).value).toBe('a');
    cleanup();
    // a bare tab URL in the same visit
    at(`${P3_BASE}/guests`);
    expect((screen.getByTestId('v2-event-switch') as HTMLSelectElement).value).toBe('a');
  });
  const dated = (id: string, name: string, dates: string[]) => ({
    ...row(id, name, dates[0]), event: { dates: dates.map((date) => ({ date, status: 'scheduled' })) }, upcoming: dates.length, nextTime: '8pm', nextStart: null, place: '',
  });
  it.each<[string, 'organiserGuestListLive' | 'organiserRaffleLive', boolean, string[], string, number]>([
    ['guests', 'organiserGuestListLive', false, [], 'v2-guests-soon', 0],
    ['guests', 'organiserGuestListLive', false, ['2026-11-20', '2026-11-27'], 'v2-guests-soon', 0],
    ['guests', 'organiserGuestListLive', true, [], 'v2-guests-nonights', 0],
    ['guests', 'organiserGuestListLive', true, ['2026-11-20'], 'v2-guests-tab', 1],
    ['guests', 'organiserGuestListLive', true, ['2026-11-20', '2026-11-27', '2026-12-04'], 'v2-guests-tab', 3],
    ['raffle', 'organiserRaffleLive', false, [], 'v2-raffle-soon', 0],
    ['raffle', 'organiserRaffleLive', false, ['2026-11-20', '2026-11-27'], 'v2-raffle-soon', 0],
    ['raffle', 'organiserRaffleLive', true, [], 'v2-raffle-nonights', 0],
  ])('%s %s=%s with %j dates -> %s (%i night headings)', (tab, flag, on, dates, testId, headings) => {
    h.f[flag] = on;
    h.rows = [dates.length ? dated('a', 'Alpha', dates) : { ...row('a', 'Alpha', '2026-01-01'), event: { dates: [] } }];
    at(`${P3_BASE}/${tab}`);
    const box = screen.getByTestId(testId);
    expect(box.querySelectorAll('h2').length).toBe(headings);
    // Coming soon is ONE card, never one per night; and no copy sends the person to add dates
    if (!on) {
      expect(box.textContent).toMatch(/coming soon/i);
      expect(box.textContent).not.toMatch(/Add dates/);
    }
  });
  it.each(['tickets', 'guests', 'raffle'])('%s with no events: one sentence and a next step', (tab) => {
    at(`${P3_BASE}/${tab}`);
    const card = screen.getByTestId(`v2-${tab}-empty`);
    expect(card.querySelectorAll('p').length).toBe(1);
    expect(card.querySelector('a')?.textContent).toBe('Add an event');
  });
  it.each(['tickets', 'guests', 'raffle'])('%s loading and error: one sentence and a button', (tab) => {
    h.home = { ...h.home, isPending: true };
    at(`${P3_BASE}/${tab}`);
    expect(screen.getByTestId(`v2-${tab}-loading`).querySelector('a')?.getAttribute('href')).toBe(BACK_TO);
    cleanup();
    h.home = { ...h.home, isPending: false, isError: true };
    at(`${P3_BASE}/${tab}`);
    expect(screen.getByTestId(`v2-${tab}-error`).querySelector('button')?.textContent).toBe('Try again');
    h.home = { ...h.home, isError: false };
  });
});
