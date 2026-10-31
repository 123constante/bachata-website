// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { addDaysToKey } from '@/lib/londonDate';
import { parseEventWorkspace } from '../../../events/eventModel';
import { allDatesOf, olderDatesNote, type DateFilter } from '../../data/dates';
import { fetchOlderDates, readOlderPage, withOlder } from '../../data/olderDates';
import { REASONS } from './cancelFixtures';
import { TODAY, occ, wsRaw, program, item } from './wsFixtures';

/*
 * FIXLIST F-27 (DATES-100). admin_event_workspace_p5 is stood in for by an emulator of its live
 * body (prod, read 2026-10-31): dates newest first, p_before strictly older, p_limit default 100
 * (max 200), meta.has_more / next_before (the page's oldest date) / total / counts (upcoming and
 * past exclude cancelled). Shapes: 0, 1, 57 future, exactly 100, 101, 132 (prod's largest).
 */
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
import { AllDatesScreen } from '../AllDatesScreen';

type Raw = Record<string, unknown>;
const PARTY = program([item('pty', 'party', null, '21:00', '02:00')]);

/** `future` weekly dates from TODAY+2 and `past` weekly dates before TODAY; every 10th past date cancelled. */
function seriesDates(future: number, past: number): Raw[] {
  const out: Raw[] = [];
  for (let i = 0; i < future; i++) out.push(occ(addDaysToKey(TODAY, 2 + i * 7)));
  for (let i = 0; i < past; i++) out.push(occ(addDaysToKey(TODAY, -5 - i * 7), i % 10 === 9 ? 'cancelled' : 'scheduled'));
  return out;
}

/** The live RPC body's paging and summary, over `all`. */
function serve(all: Raw[], before?: string | null, limit?: number | null): Raw {
  const desc = [...all].sort((a, b) => String(b.occurrence_date).localeCompare(String(a.occurrence_date)));
  const older = desc.filter((d) => !before || String(d.occurrence_date) < before);
  const page = older.slice(0, limit ?? 100);
  const hasMore = older.length > page.length;
  const live = (d: Raw) => d.lifecycle_status !== 'cancelled';
  return wsRaw({}, PARTY, page, {
    has_more: hasMore,
    total: all.length,
    next_before: hasMore ? page[page.length - 1].occurrence_date : null,
    counts: {
      upcoming: all.filter((d) => live(d) && String(d.occurrence_date) >= TODAY).length,
      past: all.filter((d) => live(d) && String(d.occurrence_date) < TODAY).length,
      cancelled: all.filter((d) => !live(d)).length,
    },
  });
}

const SHAPES: Array<[string, number, number]> = [
  ['0 dates', 0, 0], ['1 date', 1, 0], ['57 future', 57, 0], ['exactly 100', 57, 43], ['101', 57, 44], ['132 (prod largest)', 57, 75],
];
const FILTERS: DateFilter[] = ['coming', 'past', 'cancelled', 'breaks'];

describe('F-27 All dates counts x shapes: the server total, never the loaded slice', () => {
  it.each(SHAPES)('%s', async (_n, future, past) => {
    const all = seriesDates(future, past);
    const first = parseEventWorkspace(serve(all));
    const read = (id: string, before: string) => Promise.resolve(serve(all, before, 200)).then((d) => {
      rpc.mockResolvedValueOnce({ data: d, error: null });
      return readOlderPage(id, before);
    });
    const loaded = first.hasMore ? withOlder(first, await fetchOlderDates('ser-1', first.nextBefore as string, read)) : first;
    expect(loaded.dates).toHaveLength(all.length);
    expect(loaded.hasMore).toBe(false);
    const truth = allDatesOf(loaded, TODAY, 'coming');
    const partial = allDatesOf(first, TODAY, 'coming');
    for (const f of FILTERS) expect([f, partial.counts[f]]).toEqual([f, truth.counts[f]]);
    expect(truth.counts.past).toBe(past);
    expect(truth.counts.cancelled).toBe(Math.floor(past / 10));
    // the newest page alone must not shrink the counts (the bug: 100 of 132 read as Past 43)
    expect(partial.atLeast).toEqual(all.length > 100 ? ['own'] : []);
    expect(olderDatesNote(first, 'Load older dates')).toBe(all.length > 100
      ? `Showing the newest 100 of ${all.length} dates. Tap "Load older dates" to see the other ${all.length - 100}.`
      : null);
  });

  it('pages at the server limit: p_before is the previous page\'s oldest date, p_limit 200', async () => {
    const all = seriesDates(57, 600);
    const asked: Array<[string, number]> = [];
    rpc.mockImplementation(async (_name: string, a: Raw) => {
      asked.push([a.p_before as string, a.p_limit as number]);
      return { data: serve(all, a.p_before as string, a.p_limit as number), error: null };
    });
    const first = parseEventWorkspace(serve(all));
    const older = await fetchOlderDates('ser-1', first.nextBefore as string);
    expect(older.complete).toBe(true);
    expect(withOlder(first, older).dates).toHaveLength(657);
    expect(asked.map((x) => x[1])).toEqual([200, 200, 200]);
    expect(asked[0][0]).toBe(first.nextBefore);
  });
});

describe('F-27 All dates screen: says more exist, and what to tap', () => {
  let all: Raw[];
  let failOlder = false;
  beforeEach(() => {
    failOlder = false;
    rpc.mockReset();
    rpc.mockImplementation(async (name: string, a: Raw) => {
      if (name !== 'admin_event_workspace_p5') return { data: null, error: null };
      if (a.p_before && failOlder) return { data: null, error: { message: 'network' } };
      return { data: serve(all, a.p_before as string | undefined, a.p_limit as number | undefined), error: null };
    });
  });
  afterEach(cleanup);

  const show = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1/dates']}>
        <Routes><Route path="/account/p3/events/:seriesId/dates" element={<AllDatesScreen />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const count = (f: string) => screen.getByTestId(`p3-filter-${f}`).querySelector('.p3-num')?.textContent;

  it('132 dates: server counts before loading, every date after one tap', async () => {
    all = seriesDates(57, 75);
    show();
    await screen.findByTestId('p3-all-dates-screen');
    expect(screen.getByTestId('p3-partial').textContent).toBe('Showing the newest 100 of 132 dates. Tap "Load older dates" to see the other 32.');
    expect(count('past')).toBe('75');
    expect(count('cancelled')).toBe('7');
    fireEvent.click(screen.getByTestId('p3-filter-past'));
    expect(screen.getAllByTestId('p3-date-row')).toHaveLength(43);
    fireEvent.click(screen.getByTestId('p3-load-older'));
    await waitFor(() => expect(screen.getAllByTestId('p3-date-row')).toHaveLength(75));
    expect(count('past')).toBe('75');
    expect(count('cancelled')).toBe('7');
    expect(screen.queryByTestId('p3-partial')).toBeNull();
    expect(screen.queryByTestId('p3-load-older')).toBeNull();
  });

  it('a failed older read says what to do, and Try again loads them', async () => {
    all = seriesDates(57, 44);
    failOlder = true;
    show();
    fireEvent.click(await screen.findByTestId('p3-load-older'));
    expect((await screen.findByTestId('p3-older-error')).textContent).toMatch(/Check your connection, then try again/);
    // F1: the note must not name a button that is not on screen
    expect(screen.queryByTestId('p3-load-older')).toBeNull();
    expect(screen.getByTestId('p3-partial').textContent).not.toContain('Load older dates');
    failOlder = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByTestId('p3-older-error')).toBeNull());
    expect(screen.queryByTestId('p3-load-older')).toBeNull();
  });

  it.each([[0, 0], [1, 0], [57, 43]])('%i future + %i past: no note, no Load older dates', async (f, p) => {
    all = seriesDates(f, p);
    show();
    await screen.findByTestId('p3-all-dates-screen');
    expect(screen.queryByTestId('p3-partial')).toBeNull();
    expect(screen.queryByTestId('p3-load-older')).toBeNull();
  });
});
