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

import ChangeFlow from '../index';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { dateLock } from '@/modules/organiser/shared/eventState';
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

const workspace = (seriesId: string) => ({
  series: { series: { id: seriesId, name: 'Friday Social', lifecycle_status: 'live', version: 9, default_venue_id: 'v1', default_start_date: '2026-01-01' }, program: [] },
  occurrences: [PAST, BEFORE, AFTER].map((id) => ({ id, occurrence_date: OCC_DATE()[id], lifecycle_status: 'scheduled', version: OCC_VERSION[id], materialised_start_utc: `${OCC_DATE()[id]}T20:00:00Z` })),
});

const dateView = (id: string) => ({
  occurrence: { id, date: OCC_DATE()[id], version: OCC_VERSION[id], lifecycle_status: 'scheduled', materialised_start_utc: `${OCC_DATE()[id]}T20:00:00Z` },
  event: { venue_id: 'v1' },
  schedule: { local_start_time: sessionStart, local_end_time: '23:30:00' },
});

beforeEach(() => {
  rpc.mockReset();
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
async function walkTo(row: 'change-time' | 'change-venue' | 'change-day') {
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
  {
    name: 'move to another day',
    row: 'change-day' as const,
    act: async () => {
      fireEvent.click(await screen.findByText(dayLabel(addDaysToKey(today(), 11))));
    },
    kind: 'occurrence.move_date',
    payload: () => ({ to_date: addDaysToKey(today(), 11) }),
    message: () => `Moved to ${dayLabel(addDaysToKey(today(), 11))}`,
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

  it('what changes: three rows, tap advances (D35)', async () => {
    mount(ORG_PATHS.changeDate(A, BEFORE));
    await screen.findByTestId('change-time');
    expect(['change-time', 'change-venue', 'change-day'].map((t) => screen.getByTestId(t).textContent)).toEqual([
      'Change the time', 'Different venue this date only', 'Move to another day',
    ]);
    fireEvent.click(screen.getByTestId('change-day'));
    expect(await screen.findByTestId('change-day-list')).toBeTruthy();
  });

  it.each(['', '/time', '/venue', '/day'])('a past date is refused with the dateLock text verbatim (%s)', async (tail) => {
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
    expect(commands()).toHaveLength(0);
  });

  it('the move list skips days already holding a date and offers the rest of the next 30', async () => {
    mount(ORG_PATHS.changeDay(A, BEFORE));
    const list = await screen.findByTestId('change-day-list');
    await waitFor(() => expect(within(list).queryByText(dayLabel(afterDate()))).toBeNull());
    expect(within(list).queryByText(dayLabel(beforeDate()))).toBeNull();
    const labels = within(list).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toHaveLength(28);
    expect(labels).toContain(dayLabel(addDaysToKey(today(), 1)));
  });

  it('a date moved across 25 October travels as a wall-clock day, never a shifted instant (R3-18)', async () => {
    const target = addDaysToKey(beforeDate(), 8); // 24 -> 31 October style: across the clock change
    mount(ORG_PATHS.changeDay(A, BEFORE));
    fireEvent.click(await screen.findByText(dayLabel(target)));
    await waitFor(() => expect(commands()).toHaveLength(1));
    const payload = (commands()[0][1] as { p_envelope: { command: { payload: Record<string, unknown> } } }).p_envelope.command.payload;
    expect(payload).toEqual({ to_date: target });
    expect(String(payload.to_date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

describe('Change a date: every control is a 44px+ target', () => {
  const TALL = /(^|\s)(min-)?h-\[(4[4-9]|[5-9]\d)px\]/;
  it.each([
    ['C2', () => ORG_PATHS.change, 'change-which-event'],
    ['C3', () => ORG_PATHS.changeEvent(A), 'change-which-date'],
    ['C4', () => ORG_PATHS.changeDate(A, BEFORE), 'change-what'],
    ['C5', () => ORG_PATHS.changeTime(A, BEFORE), 'change-time-screen'],
    ['C5b', () => ORG_PATHS.changeVenue(A, BEFORE), 'change-venue-screen'],
    ['C5c', () => ORG_PATHS.changeDay(A, BEFORE), 'change-day-list'],
  ])('%s', async (_board, path, testId) => {
    mount(path());
    const body = await screen.findByTestId(testId);
    await waitFor(() => expect(body.querySelectorAll('button, input, a').length).toBeGreaterThan(0));
    for (const el of Array.from(body.querySelectorAll('button, input, a'))) {
      expect([el.getAttribute('data-testid'), el.className]).toEqual([el.getAttribute('data-testid'), expect.stringMatching(TALL)]);
    }
  });
});
