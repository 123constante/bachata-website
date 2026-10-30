// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { histItem, histItems, histPage, ws } from './wsFixtures';
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { WHO_OF, historyDays, historyRowOf, isHistoryRefusal, parseHistory, parseHistoryItem, whoWord } from '../../data/history';
import { L } from '../../model';
import { P3_PATHS } from '../../shell/paths';

/*
 * W3b-1 consistency matrix: the History screen x every prod shape the brief's survey found
 * (0 rows, 1 row, a short list, a list over one page, over 100 rows on three pages) plus an
 * RPC error, a refusal and a malformed row; and the row words x who x date x fields.
 */

type Rpc = { data: unknown; error: { message: string; code?: string } | null };
const rpc = vi.hoisted(() => ({ calls: [] as Array<{ fn: string; args: Record<string, unknown> }>, reply: (_a: Record<string, unknown>): Rpc => ({ data: null, error: null }) }));
const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (fn: string, args: Record<string, unknown>) => { rpc.calls.push({ fn, args }); return rpc.reply(args); } },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async () => 1,
  useSendOnce: () => async () => 1,
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { HistoryScreen } from '../HistoryScreen';
import { EventPage } from '../EventPage';

/** Serves `all` (newest first) in RPC pages: p_limit rows strictly before p_before. */
const serve = (all: Array<Record<string, unknown>>) => (a: Record<string, unknown>): Rpc => {
  const rest = a.p_before ? all.filter((x) => Date.parse(x.at as string) < Date.parse(a.p_before as string)) : all;
  const page = rest.slice(0, a.p_limit as number);
  return { data: histPage(page, rest.length > page.length), error: null };
};

/** The middle dot the sub line joins with, written as an escape (no raw Unicode in source). */
const DOT = ' \u00b7 ';
let lastQc: QueryClient;

function show(path = P3_PATHS.eventHistory('ser-1')) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lastQc = qc;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/p3/events/:seriesId/history" element={<HistoryScreen />} />
          <Route path="/account/p3/events/:seriesId" element={<EventPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.calls = [];
  wsQ.value = { isPending: false, isError: false, data: ws('weekly'), error: null, refetch: vi.fn() };
});
afterEach(cleanup);

describe('History screen x shape', () => {
  const SHAPES: Array<[string, number, number]> = [
    // [name, rows on the server, RPC pages it takes to show them all]
    ['empty', 0, 1],
    ['one row', 1, 1],
    ['short', 3, 1],
    ['twelve', 12, 1],
    ['over one page', 60, 2],
    ['over 100', 120, 3],
  ];
  it.each(SHAPES)('%s: every row once, newest first, Load more only while there is more', async (_n, n, pages) => {
    const all = histItems(n);
    rpc.reply = serve(all);
    show();
    if (n === 0) {
      const empty = await screen.findByTestId('p3-history-empty');
      expect(empty.textContent).toContain(L.historyEmptyTitle);
      expect(empty.textContent).toContain(L.historyEmptyBody);
      // the empty state's way out is on screen and goes to the event
      fireEvent.click(within(empty).getByRole('link', { name: L.historyBack }));
      expect(await screen.findByTestId('p3-event')).toBeTruthy();
      return;
    }
    await screen.findAllByTestId('p3-history-row');
    for (let p = 1; p < pages; p++) {
      fireEvent.click(screen.getByTestId('p3-history-more'));
      await waitFor(() => expect(screen.getAllByTestId('p3-history-row')).toHaveLength(Math.min(n, (p + 1) * 50)));
    }
    await waitFor(() => expect(screen.getAllByTestId('p3-history-row')).toHaveLength(n));
    expect(screen.queryByTestId('p3-history-more')).toBeNull();
    expect(rpc.calls.length).toBe(pages);
    expect(rpc.calls.every((c) => c.fn === 'organiser_series_history_v1' && c.args.p_series_id === 'ser-1')).toBe(true);
    // page 2+ ask strictly before the last row already shown
    rpc.calls.slice(1).forEach((c, i) => expect(c.args.p_before).toBe(all[(i + 1) * 50 - 1].at));
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('a page that says more shows the button; it is a button, never a scroll trigger', async () => {
    rpc.reply = serve(histItems(51));
    show();
    const more = await screen.findByTestId('p3-history-more');
    expect(more.tagName).toBe('BUTTON');
    expect(more.textContent).toBe(L.historyMore);
    expect(screen.getAllByTestId('p3-history-row')).toHaveLength(50);
  });

  it('RPC error: says so, Try again re-reads', async () => {
    rpc.reply = () => ({ data: null, error: { message: 'fetch failed' } });
    show();
    const err = await screen.findByTestId('p3-history-error');
    expect(err.textContent).toContain(L.historyError);
    rpc.reply = serve(histItems(1));
    fireEvent.click(within(err).getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('p3-history-row')).toHaveLength(1);
  });

  it('a failed older page keeps the rows shown and says so', async () => {
    const all = histItems(60);
    rpc.reply = serve(all);
    show();
    await screen.findAllByTestId('p3-history-row');
    rpc.reply = () => ({ data: null, error: { message: 'fetch failed' } });
    fireEvent.click(screen.getByTestId('p3-history-more'));
    expect((await screen.findByTestId('p3-history-more-error')).textContent).toBe(L.historyMoreError);
    expect(screen.getAllByTestId('p3-history-row')).toHaveLength(50);
    expect(screen.getByTestId('p3-history-more')).toBeTruthy();
  });

  it('a failed background re-read keeps the rows already shown (fix 1, finding 5)', async () => {
    rpc.reply = serve(histItems(3));
    show();
    expect(await screen.findAllByTestId('p3-history-row')).toHaveLength(3);
    rpc.reply = () => ({ data: null, error: { message: 'fetch failed' } });
    await act(() => lastQc.refetchQueries());
    // the re-read really failed (the query is in error with its old pages still held)
    await waitFor(() => expect(lastQc.getQueryCache().find({ queryKey: ['p3-history'], exact: false })?.state.status).toBe('error'));
    expect(rpc.calls).toHaveLength(2);
    expect(screen.queryByTestId('p3-history-error')).toBeNull();
    expect(screen.getAllByTestId('p3-history-row')).toHaveLength(3);
  });

  it('page 1 says more but every row on it is malformed: Show older changes is still offered (fix 1, finding 3)', async () => {
    const older = histItems(2, '2026-10-20T10:00:00Z');
    rpc.reply = (a) => (a.p_before
      ? { data: histPage(older, false), error: null }
      : { data: { series_id: 'ser-1', items: ['junk', { label: '' }], has_more: true, next_before: '2026-10-21T10:00:00Z' }, error: null });
    show();
    const more = await screen.findByTestId('p3-history-more');
    expect(screen.queryByTestId('p3-history-empty')).toBeNull();
    fireEvent.click(more);
    expect(await screen.findAllByTestId('p3-history-row')).toHaveLength(2);
    expect(rpc.calls[1].args.p_before).toBe('2026-10-21T10:00:00Z');
    expect(screen.queryByTestId('p3-history-more')).toBeNull();
  });

  it('signed out (not_signed_in) is not "not yours": it reads as an error with Try again, as the shared rule says (fix 1, finding 2)', async () => {
    rpc.reply = () => ({ data: null, error: { message: 'not_signed_in', code: '42501' } });
    show();
    expect(await screen.findByTestId('p3-history-error')).toBeTruthy();
    expect(screen.queryByTestId('p3-event-notyours')).toBeNull();
  });

  it.each([
    ['not_a_member', '42501'],
    ['permission_denied', undefined],
  ])('refusal %s: the same copy as every other P3 event screen', async (message, code) => {
    rpc.reply = () => ({ data: null, error: { message, code } });
    show();
    const card = await screen.findByTestId('p3-event-notyours');
    // the workspace gate's own refusal renders the identical card
    cleanup();
    wsQ.value = { isPending: false, isError: true, data: undefined, error: { message: 'permission_denied' }, refetch: vi.fn() };
    show();
    expect((await screen.findByTestId('p3-event-notyours')).textContent).toBe(card.textContent);
  });

  it('a malformed row is dropped, the rest still show', async () => {
    rpc.reply = () => ({ data: histPage([histItem('2026-10-25T10:00:00Z'), { at: '2026-10-25T09:00:00Z', who: 'you' }, 'junk', null, histItem('not a time')]), error: null });
    show();
    expect(await screen.findAllByTestId('p3-history-row')).toHaveLength(1);
  });

  // review 1202 S2 (M12): every row on the event page that opens a pushed screen, by its real href
  it.each([
    ['p3-open-prices', P3_PATHS.eventPrices('ser-1')],
    ['p3-open-history', P3_PATHS.eventHistory('ser-1')],
    ['p3-open-organisers', P3_PATHS.eventOrganisers('ser-1')],
  ])('the event page row %s links to its screen', async (testId, href) => {
    rpc.reply = serve(histItems(1));
    show(P3_PATHS.event('ser-1'));
    expect((await screen.findByTestId(testId)).getAttribute('href')).toBe(href);
  });

  it('the event page links to History', async () => {
    rpc.reply = serve(histItems(1));
    show(P3_PATHS.event('ser-1'));
    const link = await screen.findByTestId('p3-open-history');
    expect(link.getAttribute('href')).toBe(P3_PATHS.eventHistory('ser-1'));
    fireEvent.click(link);
    expect(await screen.findByTestId('p3-history')).toBeTruthy();
  });
});

describe('History row words x who x date x fields', () => {
  const WHO: Array<[unknown, string]> = [
    ['you', 'You'],
    ['a co-host', 'A co-host'],
    ['the Bachata team', 'The Bachata team'],
    ['somebody new', 'Someone'],
    // inherited Object properties are not who words (fix 1, finding 1)
    ['constructor', 'Someone'],
    ['toString', 'Someone'],
    ['__proto__', 'Someone'],
    [undefined, 'Someone'],
  ];
  const DATES: Array<[unknown, string | null]> = [[null, null], ['2026-03-06', 'for Friday 6 March'], ['06/03/2026', null]];
  const FIELDS: Array<[unknown, string | null]> = [[[], null], [['Name', 'Price'], 'Changed: Name, Price'], [[1, '', 'Name'], 'Changed: Name'], [undefined, null]];
  for (const [who, whoW] of WHO)
    for (const [date, dateW] of DATES)
      for (const [fields, fieldsW] of FIELDS)
        it(`${String(who)} x ${String(date)} x ${JSON.stringify(fields)}`, () => {
          // 18:05 UTC on 25 Oct 2026 is 18:05 in London (BST ended 01:00 UTC that day)
          const x = parseHistoryItem({ at: '2026-10-25T18:05:00Z', kind: 'series.add_date', label: 'Added a date', who, date, fields })!;
          const r = historyRowOf(x);
          expect(r.sub).toBe([whoW, '18:05', dateW].filter(Boolean).join(DOT));
          expect(r.changed).toBe(fieldsW);
        });

  it('one shared mapping: every RPC who word has its screen word', () => {
    expect(Object.keys(WHO_OF).sort()).toEqual(['a co-host', 'the Bachata team', 'you']);
    for (const w of Object.values(WHO_OF)) expect(whoWord(w)).toBe(L.historyWho[w]);
  });
});

describe('History refusal: one mapping, built on the shared isAccessRefusal (fix 1, finding 2)', () => {
  it.each<[string, unknown, boolean]>([
    ['RPC not_a_member', { code: '42501', message: 'not_a_member' }, true],
    ['workspace permission_denied', { code: 'P0001', message: 'permission_denied' }, true],
    ['RPC not_signed_in (signed out)', { code: '42501', message: 'not_signed_in' }, false],
    ['workspace signed out', { code: 'P0001', message: 'permission_denied: authentication_required' }, false],
    ['a bare 42501 with another message', { code: '42501', message: 'permission denied for table x' }, false],
    ['network', { message: 'fetch failed' }, false],
    ['nothing', null, false],
  ])('%s', (_n, e, want) => expect(isHistoryRefusal(e)).toBe(want));
});

describe('History source hygiene (fix 1, finding 4)', () => {
  it.each(['../../data/history.ts', '../HistoryScreen.tsx', './history.matrix.test.tsx'])('%s has no raw non-ASCII', (rel) => {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    expect([...src].filter((c) => c.charCodeAt(0) > 0x7f)).toEqual([]);
  });
});

describe('History grouping (London days)', () => {
  it('groups by London day, newest first; 23:30 UTC in BST is the next London day', () => {
    const days = historyDays(
      [
        parseHistoryItem(histItem('2026-10-24T22:30:00Z', { label: 'A' }))!, // 23:30 BST, Sat 24
        parseHistoryItem(histItem('2026-10-24T23:30:00Z', { label: 'B' }))!, // 00:30 BST, Sun 25
        parseHistoryItem(histItem('2026-10-25T18:00:00Z', { label: 'C' }))!,
        parseHistoryItem(histItem('2025-12-31T12:00:00Z', { label: 'D' }))!,
      ],
      '2026-10-25',
    );
    expect(days.map((d) => [d.title, d.rows.map((r) => r.label).join('')])).toEqual([
      ['Sunday 25 October', 'CB'],
      ['Saturday 24 October', 'A'],
      ['Wednesday 31 December 2025', 'D'],
    ]);
  });

  it('BST start: 23:00 UTC on 29 March 2026 is already 30 March in London (fix 1, finding 7)', () => {
    const days = historyDays(
      [
        parseHistoryItem(histItem('2026-03-29T22:59:00Z', { label: 'A' }))!, // 23:59 BST, Sun 29
        parseHistoryItem(histItem('2026-03-29T23:00:00Z', { label: 'B' }))!, // 00:00 BST, Mon 30
        parseHistoryItem(histItem('2026-03-29T00:30:00Z', { label: 'C' }))!, // 00:30 GMT, Sun 29 (before the 01:00 UTC change)
      ],
      '2026-10-25',
    );
    expect(days.map((d) => [d.title, d.rows.map((r) => r.label).join('')])).toEqual([
      ['Monday 30 March', 'B'],
      ['Sunday 29 March', 'AC'],
    ]);
  });

  it('parser: empty, has_more without a cursor, and dropped rows', () => {
    expect(parseHistory({ series_id: 's', items: [], has_more: false, next_before: null })).toEqual({ items: [], hasMore: false, nextBefore: null, dropped: 0 });
    expect(parseHistory(null)).toEqual({ items: [], hasMore: false, nextBefore: null, dropped: 0 });
    expect(parseHistory({ items: [histItem('2026-10-25T10:00:00Z')], has_more: true, next_before: null }).hasMore).toBe(false);
    expect(parseHistory({ items: [histItem('2026-10-25T10:00:00Z'), { label: '' }, 3], has_more: false }).dropped).toBe(2);
  });
});

describe('History x real prod payloads (walk test user, read 28 Oct 2026)', () => {
  // organiser_series_history_v1 as the RPC answered for WALK weekly-cancelled-date and WALK course (page 1 of limit 2)
  const CANCELLED = { series_id: '599f42c5-f27b-5c19-be1c-bbb52f329d3c', has_more: false, next_before: null, items: [
    { at: '2026-10-27T11:36:11.359259+00:00', who: 'you', date: '2026-11-10', kind: 'series.skip_date', label: 'Skipped a date', fields: ['Dates'] },
    { at: '2026-10-27T11:36:11.234575+00:00', who: 'you', date: '2026-11-03', kind: 'occurrence.cancel', label: 'Cancelled a date', fields: ['Cancellation reason', 'Status'] },
    { at: '2026-10-27T11:36:11.092453+00:00', who: 'you', date: null, kind: 'series.set_recurrence', label: 'Changed how it repeats', fields: ['Dates'] },
    { at: '2026-10-27T11:36:10.94939+00:00', who: 'you', date: null, kind: 'series.upsert', label: 'Created the event', fields: [] },
  ] };
  const COURSE_P1 = { series_id: 'ee8f8090-ade5-55ec-9e53-7dbf7dfd06b6', has_more: true, next_before: '2026-10-27T11:36:10.719792+00:00', items: [
    { at: '2026-10-27T11:36:10.84337+00:00', who: 'you', date: null, kind: 'series.set_program', label: 'Changed the line-up', fields: ['Line-up', 'Times'] },
    { at: '2026-10-27T11:36:10.719792+00:00', who: 'you', date: null, kind: 'series.upsert', label: 'Changed the details', fields: ['Dates', 'Event type'] },
  ] };

  it('microsecond times parse, keep server order, and group as one London day', () => {
    const p = parseHistory(CANCELLED);
    expect(p.dropped).toBe(0);
    const days = historyDays(p.items, '2026-10-28');
    expect(days.map((d) => d.title)).toEqual(['Tuesday 27 October']);
    expect(days[0].rows.map((r) => [r.label, r.sub, r.changed])).toEqual([
      ['Skipped a date', 'You \u00b7 11:36 \u00b7 for Tuesday 10 November', 'Changed: Dates'],
      ['Cancelled a date', 'You \u00b7 11:36 \u00b7 for Tuesday 3 November', 'Changed: Cancellation reason, Status'],
      ['Changed how it repeats', 'You \u00b7 11:36', 'Changed: Dates'],
      ['Created the event', 'You \u00b7 11:36', null],
    ]);
  });

  it('the next-page cursor goes back to the server unchanged (microseconds kept)', async () => {
    rpc.reply = (a) => ({ data: a.p_before ? { ...CANCELLED, items: [] } : COURSE_P1, error: null });
    show();
    fireEvent.click(await screen.findByTestId('p3-history-more'));
    await waitFor(() => expect(rpc.calls).toHaveLength(2));
    expect(rpc.calls[1].args.p_before).toBe('2026-10-27T11:36:10.719792+00:00');
  });
});
