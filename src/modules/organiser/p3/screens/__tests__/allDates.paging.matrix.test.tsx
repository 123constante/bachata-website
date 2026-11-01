// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { addDaysToKey } from '@/lib/londonDate';
import { TODAY, item, occ, program, wsRaw } from './wsFixtures';

/*
 * F-27 (DATES-100): All dates reaches EVERY date and its counts are the whole series.
 * The server is a fake of admin_event_workspace_p5's paging exactly as read from pg_proc
 * on prod (1 Nov 2026): dates newest first, p_before = strictly before, p_limit 1..200
 * (NULL = 100), meta.has_more / meta.next_before (the oldest date of the page) / meta.total.
 * Shapes from the prod survey (counts only): 300 series with 0 dates, 367 with 1, 90 with
 * 2..99, 0 with 100, 1 with 132 (52 coming, 7 cancelled), 0 over 200; 250 and 450 cover a
 * second and a third page.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { AllDatesScreen } from '../AllDatesScreen';
import { OLDER_COPY, countWord, loadOlderDates, withOlderDates } from '../../data/dates';
import { parseEventWorkspace } from '../../../events/eventModel';

afterEach(() => { cleanup(); rpc.mockReset(); });

const PROG = program([item('pty', 'party', 'Social', '21:00', '01:00')]);

/** n weekly dates, `coming` of them today or later (the 132 series: 52 coming), every 19th cancelled. */
function series(n: number) {
  const coming = n === 132 ? 52 : Math.ceil(n * 0.4);
  const first = addDaysToKey(TODAY, -7 * (n - coming));
  return Array.from({ length: n }, (_, i) => {
    const d = addDaysToKey(first, i * 7);
    return { date: d, status: i % 19 === 18 ? 'cancelled' : 'scheduled' };
  });
}

type Args = { p_series_id: string; p_before?: string | null; p_limit?: number | null };

function serve(all: Array<{ date: string; status: string }>, fail: { older?: number } = {}) {
  const calls: Args[] = [];
  rpc.mockImplementation(async (name: string, args: Args) => {
    if (name !== 'admin_event_workspace_p5') return { data: null, error: null };
    calls.push(args);
    if (args.p_before && fail.older && fail.older-- > 0) return { data: null, error: { message: 'network', code: '' } };
    const limit = args.p_limit ?? 100;
    if (limit < 1 || limit > 200) throw new Error(`p_limit ${limit} is refused by the server`);
    const rows = all.filter((d) => !args.p_before || d.date < args.p_before).sort((a, b) => b.date.localeCompare(a.date));
    const page = rows.slice(0, limit);
    const more = rows.length > limit;
    return {
      data: wsRaw({}, PROG, page.map((d) => occ(d.date, d.status)), { has_more: more, total: all.length, next_before: more ? page[page.length - 1].date : null }),
      error: null,
    };
  });
  return calls;
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1/dates']}>
        <Routes><Route path="/account/p3/events/:seriesId/dates" element={<AllDatesScreen />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const count = (k: string) => within(screen.getByTestId(`p3-filter-${k}`)).getByText(/\d/).textContent;
const rows = () => screen.queryAllByTestId('p3-date-row').length;

const NS = [0, 1, 99, 100, 101, 132, 250, 450];

describe('F-27: All dates holds every date, and the counts are the whole series', () => {
  it.each(NS)('%i dates: Coming + Past = All, each list shows every one of its dates, nothing dropped', async (n) => {
    const all = series(n);
    const calls = serve(all);
    const truth = { coming: all.filter((d) => d.date >= TODAY).length, past: all.filter((d) => d.date < TODAY).length };
    show();
    await screen.findByTestId('p3-all-dates-screen');
    await waitFor(() => expect(screen.queryByTestId('p3-older-loading')).toBeNull());

    expect(count('coming')).toBe(String(truth.coming));
    expect(count('past')).toBe(String(truth.past));
    expect(truth.coming + truth.past).toBe(n);
    expect(count('cancelled')).toBe(String(all.filter((d) => d.status === 'cancelled').length));
    expect(screen.queryByTestId('p3-partial')).toBeNull();

    expect(rows()).toBe(truth.coming);
    fireEvent.click(screen.getByTestId('p3-filter-past'));
    expect(rows()).toBe(truth.past);

    // the read pages, never asks for more than the server allows, and stops when there is no more
    const older = calls.filter((c) => c.p_before);
    expect(older.every((c) => c.p_limit === 200)).toBe(true);
    expect(older).toHaveLength(n <= 100 ? 0 : Math.ceil((n - 100) / 200));
  });

  it('0 dates: each empty list says what the person can do', async () => {
    serve([]);
    show();
    await screen.findByTestId('p3-all-dates-screen');
    expect(screen.getByTestId('p3-dates-empty').textContent).toMatch(/Add a date|add/i);
    fireEvent.click(screen.getByTestId('p3-filter-past'));
    expect(screen.getByTestId('p3-dates-empty').textContent).toMatch(/once they have happened/);
  });

  it('132 dates: while the older dates load, Past says so instead of a count that is too low', async () => {
    const all = series(132);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const calls = serve(all);
    const real = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name: string, args: Args) => { if (args.p_before) await gate; return real(name, args); });
    show();
    await screen.findByTestId('p3-older-loading');
    expect(count('coming')).toBe('52');
    expect(count('past')).toBe('48+');
    release();
    await waitFor(() => expect(count('past')).toBe('80'));
    expect(calls.length).toBeGreaterThan(0);
  });

  it('132 dates: an older page that fails says so, keeps "N+", and Try again reaches every date', async () => {
    serve(series(132), { older: 1 });
    show();
    await screen.findByTestId('p3-older-failed');
    expect(screen.getByTestId('p3-older-failed').textContent).toContain(OLDER_COPY.failed);
    expect(count('past')).toBe('48+');
    fireEvent.click(screen.getByTestId('p3-older-retry'));
    await waitFor(() => expect(count('past')).toBe('80'));
    expect(screen.queryByTestId('p3-older-failed')).toBeNull();
  });
});

describe('F-27: the loader stops, and says partial, when it cannot reach every date', () => {
  const page = (all: Array<{ date: string; status: string }>, before: string, limit: number) => {
    const rows = all.filter((d) => d.date < before).sort((a, b) => b.date.localeCompare(a.date));
    const p = rows.slice(0, limit);
    const more = rows.length > limit;
    const ws = parseEventWorkspace(wsRaw({}, PROG, p.map((d) => occ(d.date, d.status)), { has_more: more }));
    return { dates: ws.dates, hasMore: more, nextBefore: more ? p[p.length - 1].date : null };
  };

  it('the page cap: 450 dates with one older page allowed -> partial, and every count but a whole Coming is "N+"', async () => {
    const all = series(450);
    const first = parseEventWorkspace(wsRaw({}, PROG, all.slice(-100).map((d) => occ(d.date, d.status)), { has_more: true, total: 450 }));
    const older = await loadOlderDates(async (b, l) => page(all, b, l), first.dates[first.dates.length - 1].occurrence_date, 1);
    expect(older).toMatchObject({ hasMore: true });
    expect(older.dates).toHaveLength(200);
    const ws = withOlderDates(first, older);
    expect(ws.dates).toHaveLength(300);
    expect(countWord(ws, TODAY, 'coming', 180)).toBe('180');
    expect(countWord(ws, TODAY, 'past', 120)).toBe('120+');
    expect(countWord(ws, TODAY, 'cancelled', 15)).toBe('15+');
  });

  it('a page that does not move back in time stops the loop (one call, partial)', async () => {
    const stuck = vi.fn(async () => ({ dates: [], hasMore: true, nextBefore: '2026-10-01' }));
    expect(await loadOlderDates(stuck, '2026-10-01')).toEqual({ dates: [], hasMore: true });
    expect(stuck).toHaveBeenCalledTimes(1);
  });

  it('a date in both reads counts once', () => {
    const a = parseEventWorkspace(wsRaw({}, PROG, [occ('2026-10-30'), occ('2026-10-23')], { has_more: true }));
    expect(withOlderDates(a, { dates: [a.dates[1]], hasMore: false }).dates).toHaveLength(2);
  });
});
