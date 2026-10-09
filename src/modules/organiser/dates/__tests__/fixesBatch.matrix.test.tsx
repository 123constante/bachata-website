// @vitest-environment jsdom
/**
 * Organiser fixes batch (2026-10-08), rendered through the real readers:
 *  G7  a per-date venue sends its city with it (and clears it with the venue);
 *  5   the people picker shows the name the line-up will show after save;
 *  9   a cancel reason of "Other" (or none) reads just "Cancelled";
 *  11  the session sheet / rows / save bar on the date page;
 *  12  one session summary (times, then levels by the Levels rule) on BOTH the
 *      date page and the event page's next-date ScheduleCard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WorkspaceDate } from '@/modules/organiser/shared/seriesModel';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';
import { ScheduleCard } from '../../events/EditorRows';

const DATE = '2026-10-15';
const TODAY = '2026-10-08';
const S1 = '11111111-1111-4111-8111-111111111111';
const JOHN = '00000001-0000-4000-8000-000000000000';
const EVA = '00000002-0000-4000-8000-000000000000';
const CITY_YORK = '99999999-9999-4999-8999-999999999999';

type Session = Record<string, unknown>;
let programme: { sessions: Session[]; editable: boolean; reason: string | null };
let occ: { status: string; reason: string | null; override: string | null };
let searchRows: Record<string, unknown>[];
let profileRows: Record<string, unknown>[];

const calls = (fn: string) => rpc.mock.calls.filter(([f]) => f === fn);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  from.mockReset();
  programme = {
    sessions: [{ series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false }],
    editable: true,
    reason: null,
  };
  occ = { status: 'scheduled', reason: null, override: null };
  searchRows = [];
  profileRows = [];
  from.mockImplementation((table: string) => {
    if (table === 'cities') {
      return { select: () => ({ eq: (_c: string, id: string) => ({ single: async () => ({ data: { id, name: 'York', slug: 'york' }, error: null }) }) }) };
    }
    if (table === 'dancer_profiles') {
      return { select: () => ({ in: async (_c: string, ids: string[]) => ({ data: profileRows.filter((r) => ids.includes(r.id as string)), error: null }) }) };
    }
    return { select: () => ({ is: () => ({ order: async () => ({ data: [{ key: 'illness', label: 'Illness' }, { key: 'other', label: 'Other' }], error: null }) }) }) };
  });
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_get_occurrence_programme_v1') {
      return { data: { occurrence_id: 'o1', series_id: 's1', occurrence_date: DATE, version: 7, editable: programme.editable, not_editable_reason: programme.reason, sessions: programme.sessions, session_people: [] }, error: null };
    }
    if (fn === 'event_view_p5') {
      return { data: { occurrence: { id: 'o1', date: DATE, version: 1, lifecycle_status: occ.status }, event: { venue_id: occ.override ?? 'v1', venue_id_override: occ.override, cancellation_reason_label: occ.reason }, schedule: {} }, error: null };
    }
    if (fn === 'admin_event_workspace_p5') {
      return { data: { series: { series: { id: 's1', name: 'Thursday Party', lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [4] } }, program: [] }, occurrences: [] }, error: null };
    }
    if (fn === 'get_organiser_venue_options_v1') return { data: [{ id: 'v1', name: 'Salsa Club', city_name: 'Leeds' }, { id: 'v2', name: 'Studio 2', city_name: 'York' }], error: null };
    if (fn === 'resolve_city_id') return { data: args?.p_city === 'York' ? CITY_YORK : null, error: null };
    if (fn === 'organiser_search_people_v1') return { data: searchRows, error: null };
    if (fn === 'occurrence_command_p5') return { data: { ok: true, new_version: 2 }, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mountDate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/events/s1/dates/o1']}>
        <Routes>
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function readyDate() {
  mountDate();
  await screen.findByTestId('date-header');
  await waitFor(() => expect(screen.getByTestId('date-span').textContent).toContain('Thursday Party'));
}

function mountSchedule() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const next = { id: 'o1', occurrence_date: DATE, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null } as WorkspaceDate;
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ScheduleCard seriesId="s1" next={next} today={TODAY} upcoming={1} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---- 12: one session summary on both screens ------------------------------------

const TYPES = ['class', 'masterclass', 'party', 'performance'] as const;
const LEVELS: [string, string[]][] = [['no levels', []], ['a level', ['intermediate']]];
const SUMMARY_CASES = TYPES.flatMap((type) => LEVELS.map(([n, levels]) => [type, n, levels] as const));

describe.each(SUMMARY_CASES)('12: a %s session with %s', (type, _n, levels) => {
  const want = `22:00\u201302:00${levels.length && (type === 'class' || type === 'masterclass') ? ' \u00b7 Intermediate' : ''}`;
  beforeEach(() => {
    programme.sessions = [{ series_item_id: S1, type, title: 'Night', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: levels, removed: false }];
  });

  it('the date page reads the shared summary', async () => {
    await readyDate();
    const row = (await screen.findAllByTestId('session-row'))[0];
    expect(within(row).getByTestId('session-row-meta').textContent).toBe(want);
  });

  it('the event page ScheduleCard reads the same summary', async () => {
    mountSchedule();
    const row = await screen.findByTestId('org-schedule-session');
    expect(within(row).getByTestId('org-schedule-session-summary').textContent).toBe(want);
  });
});

// ---- 11c: the type shown once --------------------------------------------------

describe.each([
  ['title equals the type', 'Party', false, 'Party', 'Party'],
  ['title equals the type in another case', 'party', false, 'Party', 'Party'],
  ['blank title', '', false, 'Party', 'Party'],
  ['own title', 'Late Social', true, 'Late Social', 'Party: Late Social'],
] as const)('11c: %s', (_n, title, chip, name, scheduleLabel) => {
  beforeEach(() => {
    programme.sessions = [{ series_item_id: S1, type: 'party', title, start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: false }];
  });
  it('the date page row shows the type once', async () => {
    await readyDate();
    const row = (await screen.findAllByTestId('session-row'))[0];
    expect(within(row).getByTestId('session-row-name').textContent).toBe(name);
    expect(!!within(row).queryByTestId('session-row-type')).toBe(chip);
  });
  it('the ScheduleCard label shows the type once', async () => {
    mountSchedule();
    const row = await screen.findByTestId('org-schedule-session');
    expect(within(row).getByTestId('org-schedule-session-label').textContent).toBe(scheduleLabel);
  });
});

// ---- 11a / 11b: the New-session sheet -----------------------------------------

describe('11a/b: a new session', () => {
  it('shows no errors until something changes; offers no "Remove from this date"', async () => {
    await readyDate();
    await screen.findAllByTestId('session-row');
    fireEvent.click(screen.getByTestId('date-add-session'));
    await screen.findByTestId('date-session-view');
    expect(screen.getByTestId('date-session-view').textContent).not.toMatch(/Give this session a name|Enter a start time/);
    expect(screen.queryByTestId('session-row-problem')).toBeNull();
    expect(screen.queryByTestId('session-remove')).toBeNull();
    expect(screen.getByTestId('session-discard')).toBeTruthy();
    fireEvent.change(screen.getByTestId('session-name'), { target: { value: 'Bootcamp' } });
    expect(screen.getByTestId('session-times-error').textContent).toMatch(/Enter a start time/);
  });

  it('shows the errors after a Save attempt', async () => {
    await readyDate();
    await screen.findAllByTestId('session-row');
    fireEvent.click(screen.getByTestId('date-add-session'));
    fireEvent.click(await screen.findByTestId('date-sheet-done'));
    await waitFor(() => expect(screen.queryByTestId('date-sheet')).toBeNull());
    expect(screen.queryByTestId('session-row-problem')).toBeNull();
    fireEvent.click(screen.getByTestId('date-preview-bar-action'));
    expect(await screen.findByTestId('session-row-problem')).toBeTruthy();
  });

  it('a stored session still offers "Remove from this date"', async () => {
    await readyDate();
    fireEvent.click(within((await screen.findAllByTestId('session-row'))[0]).getByTestId('session-row-open'));
    expect((await screen.findByTestId('session-remove')).textContent).toBe('Remove from this date');
  });
});

// ---- 11d: the save bar -----------------------------------------------------------

describe('11d: the date page save bar reads like the event page', () => {
  it('says Saved while nothing changed, Save changes once something did', async () => {
    await readyDate();
    await screen.findAllByTestId('session-row');
    const action = screen.getByTestId('date-preview-bar-action') as HTMLButtonElement;
    expect(action.textContent).toContain('Saved');
    expect(action.disabled).toBe(true);
    fireEvent.click(within(screen.getAllByTestId('session-row')[0]).getByTestId('session-row-open'));
    fireEvent.change(await screen.findByTestId('session-name'), { target: { value: 'Basics 2' } });
    expect((screen.getByTestId('date-preview-bar-action') as HTMLButtonElement).textContent).toContain('Save changes');
  });

  it('a locked (past) date shows no save bar', async () => {
    vi.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    programme.editable = false;
    programme.reason = 'past_date';
    await readyDate();
    await screen.findByTestId('date-locked-note');
    expect(screen.queryByTestId('date-preview-bar-action')).toBeNull();
  });
});

// ---- 9: "Other" reads just Cancelled ---------------------------------------------

describe.each([
  ['Other', 'Cancelled'],
  ['other', 'Cancelled'],
  ['  ', 'Cancelled'],
  [null, 'Cancelled'],
  ['Illness', 'Cancelled \u00b7 Illness'],
] as const)('9: cancel reason %j', (reason, want) => {
  it(`reads "${want}" on the note and the preview`, async () => {
    occ = { status: 'cancelled', reason, override: null };
    programme.editable = false;
    programme.reason = 'date_cancelled';
    await readyDate();
    const note = await screen.findByTestId('date-cancelled-note');
    expect(note.textContent).toBe(`${want}. Dancers see this.`);
  });
});

// ---- G7: the venue override carries its city ------------------------------------

describe('G7: a per-date venue sends its city', () => {
  const envelope = () => calls('occurrence_command_p5')[0][1].p_envelope;

  it('picking another venue sends venue_id with the city resolved from that venue', async () => {
    await readyDate();
    await waitFor(() => expect(screen.getByTestId('date-venue-value').textContent).toBe('Salsa Club'));
    fireEvent.click(screen.getByTestId('date-venue'));
    fireEvent.click((await screen.findAllByTestId('venue-option')).find((b) => b.textContent?.includes('Studio 2'))!);
    fireEvent.click(screen.getByTestId('date-preview-bar-action'));
    await waitFor(() => expect(calls('occurrence_command_p5')).toHaveLength(1));
    expect(envelope().command).toEqual({ kind: 'occurrence.set_override', payload: { venue_id: 'v2', city_id: CITY_YORK } });
  });

  it('going back to the usual venue clears the city too', async () => {
    occ.override = 'v2';
    await readyDate();
    await waitFor(() => expect(screen.getByTestId('date-venue-value').textContent).toBe('Studio 2'));
    fireEvent.click(screen.getByTestId('date-venue'));
    fireEvent.click((await screen.findAllByTestId('venue-option')).find((b) => b.textContent?.includes('Salsa Club'))!);
    fireEvent.click(screen.getByTestId('date-preview-bar-action'));
    await waitFor(() => expect(calls('occurrence_command_p5')).toHaveLength(1));
    expect(envelope().command).toEqual({ kind: 'occurrence.set_override', payload: { venue_id: null, city_id: null } });
  });
});

// ---- 5: the picker shows the line-up name -----------------------------------------

describe('5: the people picker', () => {
  it('shows the name the line-up will show, the full name and a consistent subtitle; the pick saves that name', async () => {
    searchRows = [
      { id: JOHN, display_name: 'John Otaran', city_name: 'London', country_code: 'GB' },
      { id: EVA, display_name: 'Eva Sol' },
    ];
    profileRows = [
      { id: JOHN, display_name: 'Dj O', first_name: 'John', surname: 'Otaran' },
      { id: EVA, display_name: null, first_name: 'Eva', surname: 'Sol' },
    ];
    await readyDate();
    fireEvent.click(within((await screen.findAllByTestId('session-row'))[0]).getByTestId('session-row-open'));
    fireEvent.click(await screen.findByTestId('session-add-person'));
    fireEvent.change(await screen.findByTestId('people-search'), { target: { value: 'jo' } });
    await waitFor(() => expect(screen.getAllByTestId('people-result')).toHaveLength(2));
    await waitFor(() => expect(screen.getAllByTestId('people-result')[0].textContent).toContain('Dj O'));
    const [john, eva] = screen.getAllByTestId('people-result');
    expect(john.textContent).toContain('Teacher \u00b7 John Otaran \u00b7 London, GB');
    expect(eva.textContent).toContain('Eva Sol');
    expect(eva.textContent).toContain('Teacher');
    fireEvent.click(within(john).getByText('Dj O'));
    const people = await screen.findAllByTestId('session-person');
    expect(people.map((p) => p.textContent).join('|')).toContain('Dj O');
  });
});
