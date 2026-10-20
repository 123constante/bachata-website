// @vitest-environment jsdom
/**
 * S2 Change a date (plan 4.5 Flows + Consistency, boards C2-C6 without Undo):
 * each path from Home sends exactly ONE command with the right kind, keys,
 * target and expected_version; an untouched Save sends nothing and says why;
 * the one-event organiser lands on "which date"; a past date is refused with
 * the eventState.ts dateLock text; the move list skips days already holding a
 * date and the moved date travels as a wall-clock day across 25 October
 * (R3-18); version_conflict renders VERSION_CONFLICT with one way to the event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
// The Move path (C5c) as it runs once admin A1 is applied; before A1 the row is hidden
// and the screen refuses (pdates.flow.test.tsx pins both sides of the gate).
vi.mock('@/modules/organiser/shared/a1Gate', () => ({ A1_APPLIED: true }));
// venueOverridePatch as shipped, unless a test makes it throw (REVIEW-S2 S1).
let patchFails = false;
vi.mock('@/modules/organiser/dates/venueOverride', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/modules/organiser/dates/venueOverride')>();
  return {
    ...real,
    venueOverridePatch: (...args: Parameters<typeof real.venueOverridePatch>) => {
      if (patchFails) throw new Error('city lookup failed');
      return real.venueOverridePatch(...args);
    },
  };
});

import ChangeFlow from '../index';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { dateLock } from '@/modules/organiser/shared/eventState';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { seriesLock } from '../changeModel';
import { VERSION_CONFLICT } from '@/modules/organiser/shared/copy';
import { readDoneState } from '@/modules/organiser/flows/doneState';

// The clock is frozen on a Tuesday five days before the clocks go back
// (25 October); every fixture date is derived from it, never typed.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const today = () => londonTodayKey();
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const PAST = 'o0000000-0000-4000-8000-000000000000';
const BEFORE = 'o1111111-0000-4000-8000-000000000001';
const AFTER = 'o2222222-0000-4000-8000-000000000002';
const pastDate = () => addDaysToKey(today(), -4);
const beforeDate = () => addDaysToKey(today(), 3); // Friday, before 25 October
const afterDate = () => addDaysToKey(today(), 10); // Friday, after 25 October
const OCC_VERSION: Record<string, number> = { [PAST]: 2, [BEFORE]: 5, [AFTER]: 6 };
const OCC_DATE = () => ({ [PAST]: pastDate(), [BEFORE]: beforeDate(), [AFTER]: afterDate() }) as Record<string, string>;

const homeDate = (id: string, date: string) => ({
  occurrence_id: id, occurrence_date: date, lifecycle_status: 'scheduled', materialised_start_utc: `${date}T20:00:00Z`, has_own_changes: false,
});
const series = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, name, slug: null, format: 'recurring', category: null, lifecycle_status: 'live', default_local_start_time: '20:00',
  default_cover_image_url: 'https://x/c.jpg', created_at: '2026-01-01T00:00:00Z', upcoming_count: 2, cancelled_upcoming_count: 0,
  next_dates: [homeDate(BEFORE, beforeDate()), homeDate(AFTER, afterDate())], latest_decision: null, ...over,
});

let seriesList: () => unknown[];
let sessionStart = '20:00:00';
let commandResult: () => { data: unknown; error: unknown };

function home() {
  return {
    today: today(),
    organisers: [{ id: 'org1', name: 'Bachata Nights', slug: null, avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: seriesList() }],
  };
}

/** More dates of the series beyond the three above (a weekly series holds up to 59 coming on prod). */
let extraDates: { id: string; date: string; status: string }[] = [];
const dateOf = (id: string) => OCC_DATE()[id] ?? extraDates.find((e) => e.id === id)?.date;

const workspace = (seriesId: string) => ({
  series: { series: { id: seriesId, name: 'Friday Social', lifecycle_status: 'live', version: 9, default_venue_id: 'v1', default_start_date: '2026-01-01' }, program: [] },
  occurrences: [
    ...[PAST, BEFORE, AFTER].map((id) => ({ id, occurrence_date: OCC_DATE()[id], lifecycle_status: 'scheduled', version: OCC_VERSION[id], materialised_start_utc: `${OCC_DATE()[id]}T20:00:00Z` })),
    ...extraDates.map((e) => ({ id: e.id, occurrence_date: e.date, lifecycle_status: e.status, version: 1, materialised_start_utc: `${e.date}T20:00:00Z` })),
  ],
});

const dateView = (id: string) => ({
  occurrence: { id, date: dateOf(id), version: OCC_VERSION[id] ?? 1, lifecycle_status: 'scheduled', materialised_start_utc: `${dateOf(id)}T20:00:00Z` },
  event: { venue_id: 'v1' },
  schedule: { local_start_time: sessionStart, local_end_time: '23:30:00' },
});

beforeEach(() => {
  rpc.mockReset();
  patchFails = false;
  extraDates = [];
  sessionStart = '20:00:00';
  seriesList = () => [
    series(A, 'Friday Social'),
    series(B, 'Sunday Class'),
    series('cccccccc-0000-4000-8000-000000000003', 'Old Draft', { lifecycle_status: 'draft' }),
    series('dddddddd-0000-4000-8000-000000000004', 'No Dates', { upcoming_count: 0, next_dates: [] }),
  ];
  commandResult = () => ({ data: { ok: true, new_version: 99 }, error: null });
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspace(String(args.p_series_id)), error: null };
    if (fn === 'event_view_p5') return { data: dateView(String((args.p_target as { occurrence_id: string }).occurrence_id)), error: null };
    if (fn === 'get_organiser_venue_options_v1') {
      return { data: [{ id: 'v1', name: 'Salsa Bar', city_name: null }, { id: 'v2', name: 'Dance Hub', city_name: null }], error: null };
    }
    if (fn === 'series_command_p5' || fn === 'occurrence_command_p5') return commandResult();
    return { data: null, error: null };
  });
});

const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5' || fn === 'occurrence_command_p5');
/** Only Date is faked, so a real timeout lets any pending send reach the rpc spy. */
const flush = () => new Promise((r) => setTimeout(r, 50));

function DoneProbe() {
  const state = readDoneState(useLocation().state);
  return <p data-testid="done-probe">{state?.message}</p>;
}
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/change" element={<ChangeFlow step="event" />} />
          <Route path="/account/o/change/:seriesId" element={<ChangeFlow step="date" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId" element={<ChangeFlow step="what" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId/time" element={<ChangeFlow step="time" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId/venue" element={<ChangeFlow step="venue" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId/day" element={<ChangeFlow step="day" />} />
          <Route path="/account/o/done" element={<DoneProbe />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Home -> Change a date -> Friday Social -> the date before 25 October -> the row. */
async function walkTo(row: 'change-time' | 'change-venue') {
  mount(ORG_PATHS.change);
  fireEvent.click(await screen.findByText('Friday Social'));
  fireEvent.click(await screen.findByText(dayLabel(beforeDate())));
  fireEvent.click(await screen.findByTestId(row));
}

const PATHS = [
  {
    name: 'time',
    row: 'change-time' as const,
    act: async () => {
      fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '21:00' } });
      fireEvent.click(screen.getByTestId('change-save'));
    },
    kind: 'occurrence.set_time',
    payload: () => ({ new_local_start: '21:00', new_local_end: null }),
    message: () => 'Moved to 21:00',
  },
  {
    name: 'venue this date only',
    row: 'change-venue' as const,
    act: async () => {
      fireEvent.click(await screen.findByText('Dance Hub'));
      fireEvent.click(screen.getByTestId('change-save'));
    },
    kind: 'occurrence.set_override',
    payload: () => ({ venue_id: 'v2', city_id: null }),
    message: () => `Different venue - ${dayLabel(beforeDate())}`,
  },
];

describe('Change a date: each path sends exactly ONE command', () => {
  it.each(PATHS)('$name', async (p) => {
    await walkTo(p.row);
    await p.act();
    await waitFor(() => expect(screen.getByTestId('done-probe').textContent).toBe(p.message()));
    expect(commands()).toHaveLength(1);
    const [fn, args] = commands()[0] as [string, { p_envelope: Record<string, unknown> }];
    // The server dispatcher refuses an occurrence.* kind on series_command_p5;
    // the target is the date and the version is the date's own (live pg_proc, 2026-10-16).
    expect(fn).toBe('occurrence_command_p5');
    expect(args.p_envelope.target_id).toBe(BEFORE);
    expect(args.p_envelope.expected_version).toBe(OCC_VERSION[BEFORE]);
    expect(typeof args.p_envelope.idempotency_key).toBe('string');
    expect(args.p_envelope.command).toEqual({ kind: p.kind, payload: p.payload() });
  });
});

describe('Change a date: steps', () => {
  it('lists only live series with a coming date; tap advances', async () => {
    mount(ORG_PATHS.change);
    await screen.findByText('Friday Social');
    expect(screen.getByText('Sunday Class')).toBeTruthy();
    expect(screen.queryByText('Old Draft')).toBeNull();
    expect(screen.queryByText('No Dates')).toBeNull();
  });

  it('the one-event organiser lands on "which date" directly (D34)', async () => {
    seriesList = () => [series(A, 'Friday Social'), series('cccccccc-0000-4000-8000-000000000003', 'Old Draft', { lifecycle_status: 'draft' })];
    mount(ORG_PATHS.change);
    expect(await screen.findByTestId('change-which-date')).toBeTruthy();
    expect(screen.getByText(dayLabel(beforeDate()))).toBeTruthy();
  });

  it('"which date" lists the coming dates with weekday, full month and time; never a past one', async () => {
    mount(ORG_PATHS.changeEvent(A));
    const list = await screen.findByTestId('change-which-date');
    await within(list).findByText(dayLabel(afterDate()));
    expect(within(list).getByText(dayLabel(beforeDate()))).toBeTruthy();
    expect(within(list).getAllByText('20:00')).toHaveLength(2);
    expect(within(list).queryByText(dayLabel(pastDate()))).toBeNull();
  });

  it('what changes: the time and venue rows, tap advances (D35); there is no move-to-another-day row (C20)', async () => {
    mount(ORG_PATHS.changeDate(A, BEFORE));
    await screen.findByTestId('change-time');
    expect(['change-time', 'change-venue'].map((t) => screen.getByTestId(t).textContent)).toEqual([
      'Change the time', 'Different venue this date only',
    ]);
    expect(screen.queryByTestId('change-day')).toBeNull();
    expect(screen.getByTestId('change-what').textContent).not.toMatch(/move/i);
    fireEvent.click(screen.getByTestId('change-venue'));
    expect(await screen.findByTestId('change-venue-screen')).toBeTruthy();
  });

  it.each(['', '/time', '/venue'])('a past date is refused with the dateLock text verbatim (%s)', async (tail) => {
    mount(`${ORG_PATHS.changeDate(A, PAST)}${tail}`);
    const refusal = await screen.findByTestId('change-refusal');
    expect(refusal.textContent).toContain(dateLock('live', pastDate(), today()) as string);
    expect(screen.queryByTestId('change-save')).toBeNull();
  });

  it('an untouched Save sends NO command and says why', async () => {
    mount(ORG_PATHS.changeTime(A, BEFORE));
    const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('20:00'));
    const save = screen.getByTestId('change-save');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('change-save-reason').textContent).toBeTruthy();
    fireEvent.click(save);
    // Typing the same time back is still untouched.
    fireEvent.change(input, { target: { value: '20:00' } });
    fireEvent.click(save);
    // The send is async (useOwnerCommand's mutationFn runs on a later tick):
    // let it land before asserting it never happened (REVIEW-S2 B1).
    await flush();
    expect(commands()).toHaveLength(0);
  });

  it('the time screen and the date list read the same start (one fact, one mapping)', async () => {
    sessionStart = '22:00:00'; // event_view's session-derived start differs from the date's own
    mount(ORG_PATHS.changeEvent(A));
    const list = await screen.findByTestId('change-which-date');
    expect(within(list).getAllByText('20:00').length).toBeGreaterThan(0);
    cleanup();
    mount(ORG_PATHS.changeTime(A, BEFORE));
    const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
    expect(input.value).toBe('20:00');
  });

  it('the venue Save stays disabled until a DIFFERENT venue is picked', async () => {
    mount(ORG_PATHS.changeVenue(A, BEFORE));
    fireEvent.click(await screen.findByText('Salsa Bar'));
    const save = screen.getByTestId('change-save');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('change-save-reason').textContent).toBeTruthy();
    fireEvent.click(save);
    await flush();
    expect(commands()).toHaveLength(0);
  });

  it('version_conflict renders the R3-7 copy with one button to the event', async () => {
    commandResult = () => ({ data: null, error: { message: 'version_conflict: expected 5, got 6', code: 'P0001' } });
    mount(ORG_PATHS.changeTime(A, BEFORE));
    const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('20:00'));
    fireEvent.change(input, { target: { value: '21:30' } });
    fireEvent.click(screen.getByTestId('change-save'));
    const conflict = await screen.findByTestId('change-conflict');
    expect(conflict.textContent).toContain(VERSION_CONFLICT);
    const buttons = within(conflict).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.event(A));
    expect(commands()).toHaveLength(1);
  });
});

describe('Change a date: a failed Save', () => {
  it('a retry after a non-conflict refusal reuses the SAME idempotency key (REVIEW-S2 B2)', async () => {
    let calls = 0;
    commandResult = () => (++calls === 1 ? { data: null, error: { message: 'network' } } : { data: { ok: true, new_version: 99 }, error: null });
    mount(ORG_PATHS.changeTime(A, BEFORE));
    const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('20:00'));
    fireEvent.change(input, { target: { value: '21:00' } });
    fireEvent.click(screen.getByTestId('change-save'));
    await screen.findByTestId('change-error-message');
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(screen.getByTestId('done-probe').textContent).toBe('Moved to 21:00'));
    expect(commands()).toHaveLength(2);
    const key = (i: number) => (commands()[i][1] as { p_envelope: { idempotency_key: unknown } }).p_envelope.idempotency_key;
    expect(typeof key(0)).toBe('string');
    expect(key(1)).toBe(key(0));
  });

  it('a venue Save that throws before the send shows the message and Save comes back (REVIEW-S2 S1)', async () => {
    patchFails = true;
    mount(ORG_PATHS.changeVenue(A, BEFORE));
    fireEvent.click(await screen.findByText('Dance Hub'));
    fireEvent.click(screen.getByTestId('change-save'));
    const message = await screen.findByTestId('change-error-message');
    expect(message.textContent).toBe(commandErrorMessage(new Error('city lookup failed')));
    const save = screen.getByTestId('change-save') as HTMLButtonElement;
    expect(save.getAttribute('aria-disabled')).toBeNull();
    expect(save.disabled).toBe(false);
    expect(commands()).toHaveLength(0);
    patchFails = false;
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByTestId('done-probe').textContent).toBe(`Different venue - ${dayLabel(beforeDate())}`));
    expect(commands()).toHaveLength(1);
  });
});

describe('Change a date: a long series on "which date" (14 shown, then "N more")', () => {
  const CANCELLED = 'o9999999-0000-4000-8000-000000000009';
  /** `coming` scheduled dates in all (BEFORE and AFTER are two), weekly after AFTER, plus one cancelled. */
  function longSeries(coming: number) {
    extraDates = Array.from({ length: coming - 2 }, (_, i) => ({
      id: `o3${String(i).padStart(7, '0')}-0000-4000-8000-000000000003`, date: addDaysToKey(afterDate(), 7 * (i + 1)), status: 'scheduled',
    }));
    extraDates.push({ id: CANCELLED, date: addDaysToKey(afterDate(), 3), status: 'cancelled' });
    return extraDates.filter((e) => e.status === 'scheduled').map((e) => e.date);
  }

  it.each([
    [14, 0],
    [15, 1],
    [59, 45],
  ])('%i coming dates: 14 rows, then a "%i more" row that expands to every one', async (coming, more) => {
    const dates = longSeries(coming);
    const last = dates[dates.length - 1];
    mount(ORG_PATHS.changeEvent(A));
    const list = await screen.findByTestId('change-which-date');
    await waitFor(() => expect(within(list).getAllByTestId('change-date-row')).toHaveLength(14));
    if (more === 0) {
      expect(within(list).getByText(dayLabel(last))).toBeTruthy();
      expect(within(list).queryByTestId('change-more-dates')).toBeNull();
      return;
    }
    expect(within(list).queryByText(dayLabel(last))).toBeNull();
    const row = within(list).getByTestId('change-more-dates');
    expect(row.textContent).toBe(`${more} more`);
    expect(row.className).toMatch(/(^|\s)(min-)?h-\[(4[4-9]|[5-9]\d)px\]/);
    fireEvent.click(row);
    expect(within(list).getAllByTestId('change-date-row')).toHaveLength(coming);
    expect(within(list).queryByTestId('change-more-dates')).toBeNull();
    // Still never a past or a cancelled date after expanding.
    expect(within(list).queryByText(dayLabel(pastDate()))).toBeNull();
    expect(within(list).queryByText(dayLabel(addDaysToKey(afterDate(), 3)))).toBeNull();
    // The 15th date (and the last) is reachable.
    fireEvent.click(within(list).getByText(dayLabel(last)));
    expect(await screen.findByTestId('change-time')).toBeTruthy();
  });

  it('a cancelled date reached by URL after expanding is still refused', async () => {
    longSeries(15);
    mount(ORG_PATHS.changeTime(A, CANCELLED));
    expect(await screen.findByTestId('change-refusal')).toBeTruthy();
    expect(screen.queryByTestId('change-save')).toBeNull();
  });
});

describe('Change a date: a paused or ended event reached by URL (REVIEW-S2 N2)', () => {
  it.each(['paused', 'ended'])('%s: "which date" refuses with the lock text and one way Home', async (status) => {
    seriesList = () => [series(A, 'Friday Social', { lifecycle_status: status }), series(B, 'Sunday Class')];
    mount(ORG_PATHS.changeEvent(A));
    const refusal = await screen.findByTestId('change-refusal');
    expect(refusal.textContent).toContain(seriesLock(status) as string);
    expect(screen.queryByText('No coming dates')).toBeNull();
    const buttons = within(refusal).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home);
  });
});

describe('Change a date: every control is a 44px+ target', () => {
  const TALL = /(^|\s)(min-)?h-\[(4[4-9]|[5-9]\d)px\]/;
  it.each([
    ['C2', () => ORG_PATHS.change, 'change-which-event'],
    ['C3', () => ORG_PATHS.changeEvent(A), 'change-which-date'],
    ['C4', () => ORG_PATHS.changeDate(A, BEFORE), 'change-what'],
    ['C5', () => ORG_PATHS.changeTime(A, BEFORE), 'change-time-screen'],
    ['C5b', () => ORG_PATHS.changeVenue(A, BEFORE), 'change-venue-screen'],
  ])('%s', async (_board, path, testId) => {
    mount(path());
    const body = await screen.findByTestId(testId);
    await waitFor(() => expect(body.querySelectorAll('button, input, a').length).toBeGreaterThan(0));
    for (const el of Array.from(body.querySelectorAll('button, input, a'))) {
      expect([el.getAttribute('data-testid'), el.className]).toEqual([el.getAttribute('data-testid'), expect.stringMatching(TALL)]);
    }
  });
});
