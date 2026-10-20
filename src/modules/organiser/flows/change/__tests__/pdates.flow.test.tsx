// @vitest-environment jsdom
/**
 * P-DATES (PARITY-GAP C13 C19 C20 C22-C26 C52-C55 C58-C61): everything an
 * owner/manager may do to ONE date, reached from Change a date. Prod shapes
 * (2026-10-17, counts only): 53 of 67 live series run 2+ sessions a day (max
 * 16), 44 weekly, 11 with per-date time changes, multi-day dates refused by
 * the session editor, series with 0 / 1 / 2-9 / 10+ coming dates. Every write
 * is ONE pinned command per change; an untouched save sends nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

const rpc = vi.hoisted(() => vi.fn());
const reasonsTable = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.is = () => chain;
  chain.order = async () => ({ data: [{ key: 'weather', label: 'Weather' }, { key: 'other', label: 'Other' }], error: null });
  return chain;
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: () => reasonsTable } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const gate = vi.hoisted(() => ({ a1: false }));
vi.mock('@/modules/organiser/shared/a1Gate', () => ({ get A1_APPLIED() { return gate.a1; } }));

import ChangeFlow from '../index';
import CancelFlow from '@/modules/organiser/flows/cancel';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { NOT_EDITABLE_COPY } from '@/modules/organiser/shared/programmeModel';
import { readDoneState } from '@/modules/organiser/flows/doneState';
import { BULK_REFUSED_REASON, COPY_NONE, END_GUARD, FESTIVAL_TIME, PICK_PAST, festivalTimeNext, shiftRefusal } from '../changeModel';
import { NO_COMING, TAKE_OFF } from '@/modules/organiser/shared/copy';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const today = () => londonTodayKey();
const S = 'aaaaaaaa-0000-4000-8000-000000000001';
const D1 = 'o1111111-0000-4000-8000-000000000001';
const D2 = 'o2222222-0000-4000-8000-000000000002';
const D3 = 'o3333333-0000-4000-8000-000000000003';
const PAST = 'o0000000-0000-4000-8000-000000000000';
const DATE: () => Record<string, string> = () => ({ [D1]: addDaysToKey(today(), 3), [D2]: addDaysToKey(today(), 10), [D3]: addDaysToKey(today(), 17), [PAST]: addDaysToKey(today(), -4) });
const VERSION: Record<string, number> = { [D1]: 5, [D2]: 6, [D3]: 7, [PAST]: 2 };

type Session = { id: string; type: string; title: string; start: string; end: string };
let rule: unknown;
let fmt: string;
let festivalId: string | null;
let usualStart: string | null;
let ownStart: Record<string, string>;
let sessions: Session[];
let editable: { editable: boolean; reason: string | null };
let overrides: Record<string, Record<string, string | null>>;
let hasOverride: Record<string, boolean>;
let bulkAffected: (ids: string[]) => string[];
let cancelledNow: Set<string>;

const status = (id: string) => (cancelledNow.has(id) ? 'cancelled' : 'scheduled');
const homeDate = (id: string) => ({ occurrence_id: id, occurrence_date: DATE()[id], lifecycle_status: status(id), materialised_start_utc: `${DATE()[id]}T${ownStart[id] ?? '20:00'}:00Z`, has_own_changes: false });
const home = () => ({
  today: today(),
  organisers: [{ id: 'org1', name: 'Bachata Nights', slug: null, avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [{
    id: S, name: 'Friday Social', slug: null, format: fmt, category: null, lifecycle_status: 'live', default_local_start_time: '20:00',
    default_cover_image_url: null, created_at: '2026-01-01T00:00:00Z', upcoming_count: 3, cancelled_upcoming_count: 0,
    next_dates: [homeDate(D1), homeDate(D2), homeDate(D3)], latest_decision: null,
  }] }],
});
const workspace = () => ({
  series: { series: { id: S, name: 'Friday Social', format: fmt, festival_id: festivalId, lifecycle_status: 'live', version: 9, default_venue_id: 'v1', default_local_start_time: usualStart, recurrence_rule: rule, default_start_date: '2026-01-01' }, program: [] },
  occurrences: [PAST, D1, D2, D3].map((id) => ({ id, occurrence_date: DATE()[id], lifecycle_status: status(id), version: VERSION[id], has_override: !!hasOverride[id], materialised_start_utc: `${DATE()[id]}T${ownStart[id] ?? '20:00'}:00Z` })),
});
const dateView = (id: string) => ({
  occurrence: { id, date: DATE()[id], version: VERSION[id], lifecycle_status: 'scheduled', materialised_start_utc: `${DATE()[id]}T${ownStart[id] ?? '20:00'}:00Z` },
  event: { venue_id: 'v1', ...(overrides[id] ?? {}) },
  schedule: { local_start_time: `${ownStart[id] ?? '20:00'}:00`, local_end_time: '02:00:00' },
});
const programme = (id: string) => ({
  occurrence_id: id, series_id: S, occurrence_date: DATE()[id], version: VERSION[id], editable: editable.editable, not_editable_reason: editable.reason,
  sessions: sessions.map((s) => ({ series_item_id: s.id, type: s.type, title: s.title, start_time: s.start, end_time: s.end, level_keys: [], removed: false })),
  session_people: [],
});

beforeEach(() => {
  rpc.mockReset();
  gate.a1 = false;
  rule = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };
  fmt = 'recurring';
  festivalId = null;
  usualStart = '20:00:00';
  ownStart = {};
  sessions = [{ id: 'i1', type: 'class', title: '', start: '20:00', end: '21:00' }, { id: 'i2', type: 'party', title: 'Late Party', start: '21:00', end: '02:00' }];
  editable = { editable: true, reason: null };
  overrides = {};
  hasOverride = {};
  bulkAffected = (ids) => ids;
  cancelledNow = new Set();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspace(), error: null };
    if (fn === 'event_view_p5') return { data: dateView(String((args.p_target as { occurrence_id: string }).occurrence_id)), error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programme(String(args.p_occurrence_id)), error: null };
    if (fn === 'cancellation_reasons_v1' || fn === 'get_cancellation_reasons_v1') return { data: [], error: null };
    if (fn === 'admin_bulk_occurrence_command_p5') {
      const env = args.p_envelope as { command: { payload: { occurrence_ids: string[] } } };
      const ids = env.command.payload.occurrence_ids;
      ids.filter((id) => !bulkAffected(ids).includes(id)).forEach((id) => cancelledNow.add(id));
      return { data: { ok: true, new_version: 10, data: { affected_count: bulkAffected(ids).length, affected_ids: bulkAffected(ids) } }, error: null };
    }
    if (fn === 'series_command_p5' || fn === 'occurrence_command_p5') {
      const env = args.p_envelope as { expected_version?: number };
      return { data: { ok: true, new_version: (env.expected_version ?? 0) + 1 }, error: null };
    }
    return { data: null, error: null };
  });
});

const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5' || fn === 'occurrence_command_p5' || fn === 'admin_bulk_occurrence_command_p5');
const flush = () => new Promise((r) => setTimeout(r, 50));

function DoneProbe() {
  return <p data-testid="done-probe">{readDoneState(useLocation().state)?.message}</p>;
}
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const base = '/account/o/change/:seriesId';
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={base} element={<ChangeFlow step="date" />} />
          <Route path={`${base}/pick`} element={<ChangeFlow step="pick" />} />
          <Route path={`${base}/:occurrenceId`} element={<ChangeFlow step="what" />} />
          <Route path={`${base}/:occurrenceId/time`} element={<ChangeFlow step="time" />} />
          <Route path={`${base}/:occurrenceId/lineup`} element={<Where />} />
          <Route path={`${base}/:occurrenceId/off`} element={<ChangeFlow step="off" />} />
          <Route path={`${base}/:occurrenceId/copy`} element={<ChangeFlow step="copy" />} />
          <Route path={`${base}/:occurrenceId/:field`} element={<ChangeFlow step="detail" />} />
          <Route path="/account/o/cancel/:seriesId/:occurrenceId" element={<CancelFlow step="confirm" />} />
          <Route path="/account/o/done" element={<DoneProbe />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('P-DATES: what can change on one date (C4)', () => {
  const ROWS: { testId: string; to: () => string }[] = [
    { testId: 'change-lineup', to: () => ORG_PATHS.dateLineup(S, D2) },
  ];
  it.each(ROWS)('$testId opens its screen for ANY coming date, not just the next', async ({ testId, to }) => {
    mount(ORG_PATHS.changeDate(S, D2));
    fireEvent.click(await screen.findByTestId(testId));
    expect((await screen.findByTestId('where')).textContent).toBe(to());
  });

  it.each(['change-note', 'change-ticket', 'change-picture', 'change-copy', 'change-off', 'change-time', 'change-venue'])('%s is offered', async (id) => {
    mount(ORG_PATHS.changeDate(S, D3));
    expect(await screen.findByTestId(id)).toBeTruthy();
  });

  it.each([false, true])('there is no Move to another day row whatever the A1 gate says (A1_APPLIED=%s; owner decision 2026-10-20, C20)', async (a1) => {
    gate.a1 = a1;
    mount(ORG_PATHS.changeDate(S, D1));
    await screen.findByTestId('change-what');
    expect(screen.queryByTestId('change-day')).toBeNull();
    expect(screen.queryByText(/move to another day/i)).toBeNull();
  });

  it('Cancel this date opens the cancel screen for THAT date; Keep it and Back return to Change, not the cancel list (INT3)', async () => {
    mount(ORG_PATHS.changeDate(S, D2));
    fireEvent.click(await screen.findByTestId('change-cancel'));
    expect((await screen.findByTestId('cancel-confirm')).textContent).toContain(dayLabel(DATE()[D2]));
    fireEvent.click(screen.getByTestId('cancel-keep'));
    expect(await screen.findByTestId('change-what')).toBeTruthy();
    expect(commands()).toHaveLength(0);
  });

  it('opened from the cancel flow (no ?from), Keep it still goes back to the cancel list', async () => {
    mount(ORG_PATHS.cancelDate(S, D2));
    fireEvent.click(await screen.findByTestId('cancel-keep'));
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.cancelEvent(S));
  });

  it.each(['multi_day', 'date_cancelled', 'past_date'] as const)('a session editor refusal (%s) shows its reason on the row, never a dead button', async (reason) => {
    editable = { editable: false, reason };
    mount(ORG_PATHS.changeDate(S, D1));
    const row = await screen.findByTestId('change-lineup');
    await waitFor(() => expect(row.textContent).toContain(NOT_EDITABLE_COPY[reason]));
    expect(row.hasAttribute('disabled')).toBe(false);
  });

  it('Take this date off: disabled with a reason on a date that is not from a weekly repeat', async () => {
    rule = { mode: 'custom', dates: [] };
    mount(ORG_PATHS.changeDate(S, D1));
    const row = await screen.findByTestId('change-off');
    expect(row.hasAttribute('disabled')).toBe(true);
    expect(row.textContent).toMatch(/weekly repeat/i);
  });

  it('Take this date off sends ONE series.skip_date to the event at the series version', async () => {
    mount(ORG_PATHS.changeOff(S, D2));
    fireEvent.click(await screen.findByTestId('change-off-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    const [fn, args] = commands()[0];
    expect(fn).toBe('series_command_p5');
    expect(args.p_envelope).toMatchObject({ target_id: S, expected_version: 9, command: { kind: 'series.skip_date', payload: { occurrence_id: D2 } } });
    expect((await screen.findByTestId('done-probe')).textContent).toContain(dayLabel(DATE()[D2]));
  });
});

describe('P-DATES: Change time shows the sessions (C19, C61)', () => {
  it('one session: a start and an optional end; the end goes with the start', async () => {
    sessions = [{ id: 'i1', type: 'party', title: '', start: '20:00', end: '23:00' }];
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-end'), { target: { value: '23:30' } });
    expect(screen.queryByTestId('change-time-delta')).toBeNull();
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command).toEqual({ kind: 'occurrence.set_time', payload: { new_local_start: '20:00', new_local_end: '23:30' } });
  });

  it('class + social: lists both, previews every new time and says every session moves', async () => {
    mount(ORG_PATHS.changeTime(S, D1));
    const list = await screen.findByTestId('change-time-sessions');
    expect(within(list).getAllByTestId('change-time-session')).toHaveLength(2);
    fireEvent.change(screen.getByTestId('change-time-input'), { target: { value: '21:00' } });
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves 1 h later');
    const rows = within(list).getAllByTestId('change-time-session').map((r) => r.textContent);
    expect(rows[0]).toContain('21:00');
    expect(rows[0]).toContain('22:00');
    expect(rows[1]).toContain('22:00');
    expect(rows[1]).toContain('03:00');
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command.kind).toBe('occurrence.set_time');
  });

  it('"Change one session’s time" opens THIS date’s session editor', async () => {
    mount(ORG_PATHS.changeTime(S, D3));
    fireEvent.click(await screen.findByTestId('change-time-one'));
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.dateLineup(S, D3));
  });

  it.each([
    { own: undefined, shown: false },
    { own: '21:30', shown: true },
  ])('Back to usual time only when the date runs at its own time (own=$own)', async ({ own, shown }) => {
    if (own) ownStart[D1] = own;
    mount(ORG_PATHS.changeTime(S, D1));
    await screen.findByTestId('change-time-screen');
    expect(!!screen.queryByTestId('change-time-reset')).toBe(shown);
    if (!shown) return;
    fireEvent.click(screen.getByTestId('change-time-reset'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command).toEqual({ kind: 'occurrence.set_time', payload: { reset: true } });
  });

  it('a typed end equal to today\u2019s end is kept when the start moves (REVIEW P-DATES 1)', async () => {
    sessions = [{ id: 'i1', type: 'party', title: '', start: '20:00', end: '23:00' }];
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '21:00' } });
    fireEvent.change(screen.getByTestId('change-time-end'), { target: { value: '23:00' } });
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command.payload).toEqual({ new_local_start: '21:00', new_local_end: '23:00' });
  });

  it('a move to the morning reads as earlier, a move past midnight as later (the 08:00 rollover)', async () => {
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '08:00' } });
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves 12 h earlier');
    fireEvent.change(screen.getByTestId('change-time-input'), { target: { value: '01:00' } });
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves 5 h later');
  });

  it('an untouched Save sends nothing', async () => {
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.click(await screen.findByTestId('change-save'));
    await flush();
    expect(commands()).toHaveLength(0);
  });
});

describe('P-DATES: note / ticket link / picture for one date (C26)', () => {
  it.each([
    { field: 'note' as const, key: 'description', value: 'Bring water' },
    { field: 'ticket' as const, key: 'ticket_url', value: 'https://tickets.example.com/x' },
  ])('$field: an untouched Save sends nothing; a typed one sends ONE set_override {$key}', async ({ field, key, value }) => {
    mount(ORG_PATHS.changeDetail(S, D1, field));
    fireEvent.click(await screen.findByTestId('change-save'));
    await flush();
    expect(commands()).toHaveLength(0);
    fireEvent.change(screen.getByTestId('change-detail-input'), { target: { value } });
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope).toMatchObject({ target_id: D1, expected_version: 5, command: { kind: 'occurrence.set_override', payload: { [key]: value } } });
  });

  it('a ticket link that is not a web address stays disabled with the reason', async () => {
    mount(ORG_PATHS.changeDetail(S, D1, 'ticket'));
    fireEvent.change(await screen.findByTestId('change-detail-input'), { target: { value: 'tickets please' } });
    expect(screen.getByTestId('change-save-reason').textContent).toMatch(/https/);
  });

  it('a date with its own note can go back to the usual one (null)', async () => {
    overrides[D1] = { description_override: 'Own note' };
    mount(ORG_PATHS.changeDetail(S, D1, 'note'));
    fireEvent.click(await screen.findByTestId('change-detail-usual'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command).toEqual({ kind: 'occurrence.set_override', payload: { description: null } });
  });
});

describe('P-DATES: copy one date’s changes from another (C60)', () => {
  it('a source date with no changes of its own is disabled with the reason', async () => {
    mount(ORG_PATHS.changeCopy(S, D1));
    const rows = await screen.findAllByTestId('change-copy-source');
    rows.forEach((r) => expect(r.hasAttribute('disabled')).toBe(true));
    expect(screen.getAllByText(COPY_NONE).length).toBeGreaterThan(0);
  });

  it('lists the dates it can copy first, newest first, then the disabled ones with the reason (INT3)', async () => {
    hasOverride[PAST] = true;
    hasOverride[D3] = true;
    mount(ORG_PATHS.changeCopy(S, D1));
    const rows = await screen.findAllByTestId('change-copy-source');
    expect(rows.map((r) => [r.hasAttribute('disabled'), r.textContent?.includes(dayLabel(DATE()[D3])) ? 'D3' : r.textContent?.includes(dayLabel(DATE()[PAST])) ? 'PAST' : 'D2']))
      .toEqual([[false, 'D3'], [false, 'PAST'], [true, 'D2']]);
    expect(rows[2].textContent).toContain(COPY_NONE);
  });

  it('copies each changed key as ONE set_override, each against the version the last returned', async () => {
    hasOverride[D2] = true;
    overrides[D2] = { description_override: 'Live band', ticket_url_override: 'https://t.example.com/b' };
    mount(ORG_PATHS.changeCopy(S, D1));
    const source = (await screen.findAllByTestId('change-copy-source')).find((r) => !r.hasAttribute('disabled'));
    fireEvent.click(source!);
    fireEvent.click(await screen.findByTestId('change-copy-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(2));
    const envs = commands().map(([, a]) => a.p_envelope);
    expect(envs.map((e) => e.command.payload)).toEqual([{ description: 'Live band' }, { ticket_url: 'https://t.example.com/b' }]);
    expect(envs.map((e) => e.expected_version)).toEqual([5, 6]);
  });
});

describe('P-DATES: pick several dates (C58)', () => {
  it('Which date offers "Pick several dates" and every row a Sessions link', async () => {
    mount(ORG_PATHS.changeEvent(S));
    expect(await screen.findByTestId('change-pick')).toBeTruthy();
    const links = await screen.findAllByTestId('change-date-sessions');
    expect(links).toHaveLength(3);
    fireEvent.click(links[1]);
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.dateLineup(S, D2));
  });

  it('cancel: one call with the ticked ids at the series version; the result says N done, M not changed, and why', async () => {
    bulkAffected = (ids) => ids.slice(0, 1);
    mount(ORG_PATHS.changePick(S));
    const ticks = await screen.findAllByTestId('change-pick-date');
    expect(screen.getByTestId('change-pick-cancel').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(ticks[0]);
    fireEvent.click(ticks[2]);
    fireEvent.click(screen.getByTestId('change-pick-cancel'));
    expect((await screen.findByTestId('change-pick-confirm')).textContent).toContain('2');
    fireEvent.click(screen.getByTestId('change-pick-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    const [fn, args] = commands()[0];
    expect(fn).toBe('admin_bulk_occurrence_command_p5');
    expect(args.p_envelope).toMatchObject({ target_id: S, expected_version: 9, command: { kind: 'occurrence.bulk_cancel', payload: { occurrence_ids: [D1, D3] } } });
    expect((await screen.findByTestId('change-pick-result')).textContent).toContain('1 done, 1 not changed');
    expect(screen.getByTestId('change-pick-result').textContent).toContain(BULK_REFUSED_REASON);
    // The skipped date drops out of the refreshed list; the result still names it (REVIEW P-DATES 3).
    await waitFor(() => expect(screen.getByTestId('change-pick-result').textContent).toContain(dayLabel(DATE()[D3])));
    expect(screen.getByTestId('change-pick-result').textContent).not.toContain(D3);
  });

  it('move together is replaced by the reason on a weekly repeat (F-PAR-final S1)', async () => {
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[0]);
    expect(screen.queryByTestId('change-pick-move')).toBeNull();
    expect(screen.getByTestId('change-pick-shift-off').textContent).toBe(shiftRefusal(rule));
  });

  it('move together on listed dates sends bulk_shift with the days', async () => {
    rule = { mode: 'custom', dates: [] };
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[1]);
    fireEvent.change(screen.getByTestId('change-pick-days'), { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('change-pick-move'));
    fireEvent.click(await screen.findByTestId('change-pick-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command).toEqual({ kind: 'occurrence.bulk_shift', payload: { occurrence_ids: [D2], shift_days: 2 } });
  });
});

// ---- F-PAR (PAR-A B1/S1/S3, PAR-B S1-S3/S6/S8/N2-N4/N9): written red-first ----------------------

describe('F-PAR decision 1: Change time offers an end box only where the server ends that session', () => {
  it.each([
    { shape: 'class 20:00-21:00 + party 21:00-02:00', ss: [{ id: 'i1', type: 'class', title: '', start: '20:00', end: '21:00' }, { id: 'i2', type: 'party', title: 'Late Party', start: '21:00', end: '02:00' }], box: false },
    { shape: 'two daytime sessions', ss: [{ id: 'i1', type: 'class', title: 'Footwork', start: '14:00', end: '15:00' }, { id: 'i2', type: 'class', title: 'Turns', start: '15:00', end: '17:00' }], box: true },
    { shape: 'one session', ss: [{ id: 'i1', type: 'party', title: '', start: '20:00', end: '23:00' }], box: true },
  ])('$shape: end box $box', async ({ ss, box }) => {
    sessions = ss;
    mount(ORG_PATHS.changeTime(S, D1));
    await screen.findByTestId('change-time-screen');
    expect(!!screen.queryByTestId('change-time-end')).toBe(box);
    expect(!!screen.queryByTestId('change-time-end-guard')).toBe(!box);
    if (box) return;
    expect(screen.getByTestId('change-time-end-guard').textContent).toContain(END_GUARD);
    fireEvent.click(screen.getByTestId('change-time-end-sessions'));
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.dateLineup(S, D1));
  });

  it('class + party: a start move still sends ONE set_time with no end', async () => {
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '20:30' } });
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command.payload).toEqual({ new_local_start: '20:30', new_local_end: null });
  });
});

describe('F-PAR Change time preview and words (PAR-B S1, S2, S3, N2, N9)', () => {
  const day = [{ id: 'i1', type: 'class', title: 'Footwork', start: '14:00', end: '15:00' }, { id: 'i2', type: 'class', title: 'Turns', start: '15:00', end: '17:00' }];

  it('S1: an end before the start keeps the old end in the preview', async () => {
    sessions = day;
    ownStart[D1] = '14:00';
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '16:00' } });
    fireEvent.change(screen.getByTestId('change-time-end'), { target: { value: '16:30' } });
    const rows = within(screen.getByTestId('change-time-sessions')).getAllByTestId('change-time-session');
    expect(rows[1].textContent).not.toContain('16:30');
    expect(rows[1].textContent).toContain('19:00');
    expect(screen.getByTestId('change-save-reason').textContent).toBe('The end must be after the start');
  });

  it('S2: the delta line reads "Every session moves 1 h later"', async () => {
    mount(ORG_PATHS.changeTime(S, D1));
    fireEvent.change(await screen.findByTestId('change-time-input'), { target: { value: '21:00' } });
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves 1 h later');
  });

  it('S3: one session gets a now -> new preview, and the field says "Night starts" when the date starts before it', async () => {
    sessions = [{ id: 'i1', type: 'party', title: '', start: '21:00', end: '01:00' }];
    mount(ORG_PATHS.changeTime(S, D1));
    expect((await screen.findByTestId('change-time-start-label')).textContent).toBe('Night starts');
    fireEvent.change(screen.getByTestId('change-time-input'), { target: { value: '21:00' } });
    expect(screen.getByTestId('change-time-one-preview').textContent).toMatch(/^Now 21:00.01:00 . new 22:00.02:00$/);
  });

  it('S3: the field keeps its plain label when the date starts with its session', async () => {
    sessions = [{ id: 'i1', type: 'party', title: '', start: '20:00', end: '23:00' }];
    mount(ORG_PATHS.changeTime(S, D1));
    expect((await screen.findByTestId('change-time-start-label')).textContent).toBe('Start time');
  });

  it('N2: the reset button and its done line use one label', async () => {
    ownStart[D1] = '21:30';
    mount(ORG_PATHS.changeTime(S, D1));
    expect((await screen.findByTestId('change-time-reset')).textContent).toMatch(/^Back to the usual time/);
  });

  it('N9: the live region is mounted before any change, and the time fields keep their visible label (no aria-label)', async () => {
    sessions = [{ id: 'i1', type: 'party', title: '', start: '20:00', end: '23:00' }];
    mount(ORG_PATHS.changeTime(S, D1));
    const live = await screen.findByTestId('change-time-live');
    expect(live.getAttribute('aria-live')).toBe('polite');
    const end = screen.getByTestId('change-time-end');
    expect(end.hasAttribute('aria-label')).toBe(false);
    expect(screen.getByTestId('change-time-input').hasAttribute('aria-label')).toBe(false);
    const hint = document.getElementById(end.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toMatch(/Leave it empty/);
  });
});

describe('F-PAR Pick several (PAR-A S1, PAR-B S8, N4 / decision 5)', () => {
  it('S8: Earlier / Later plus an unsigned number of days; the command sends the signed shift', async () => {
    rule = { mode: 'custom', dates: [] };
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[1]);
    const daysBox = screen.getByTestId('change-pick-days');
    expect(daysBox.getAttribute('inputmode')).toBe('numeric');
    fireEvent.click(screen.getByTestId('change-pick-earlier'));
    fireEvent.change(daysBox, { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('change-pick-move'));
    expect((await screen.findByTestId('change-pick-confirm-screen')).textContent).toContain('2 days earlier');
    fireEvent.click(screen.getByTestId('change-pick-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command).toEqual({ kind: 'occurrence.bulk_shift', payload: { occurrence_ids: [D2], shift_days: -2 } });
  });

  it('S1: a shift that lands a ticked date before today is refused on the screen, nothing sent', async () => {
    rule = { mode: 'custom', dates: [] };
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[0]);
    fireEvent.click(screen.getByTestId('change-pick-earlier'));
    fireEvent.change(screen.getByTestId('change-pick-days'), { target: { value: '5' } });
    expect(screen.getByTestId('change-pick-move').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('change-pick-move-reason').textContent).toBe(PICK_PAST);
    fireEvent.click(screen.getByTestId('change-pick-move'));
    await flush();
    expect(commands()).toHaveLength(0);
  });

  it('S1: a whole-call refusal (a collision) shows its reason, not "Something went wrong"', async () => {
    rule = { mode: 'custom', dates: [] };
    const base = rpc.getMockImplementation();
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => (fn === 'admin_bulk_occurrence_command_p5'
      ? { data: null, error: { code: 'P0001', message: 'contract_violation: shift would collide with an existing date' } }
      : base!(fn, args)));
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[1]);
    fireEvent.change(screen.getByTestId('change-pick-days'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('change-pick-move'));
    fireEvent.click(await screen.findByTestId('change-pick-confirm'));
    const msg = await screen.findByTestId('change-error-message');
    expect(msg.textContent).not.toMatch(/Something went wrong/);
    expect(msg.textContent).toMatch(/already/);
  });

  it('N4 / decision 5: no coming dates says so and links to Add a date', async () => {
    cancelledNow = new Set([D1, D2, D3]);
    mount(ORG_PATHS.changePick(S));
    expect((await screen.findByTestId('change-pick-empty')).textContent).toBe(NO_COMING);
    fireEvent.click(screen.getByTestId('change-pick-add'));
    expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.addEvent(S));
  });
});

describe('F-PAR Copy (PAR-A S3, PAR-B N3)', () => {
  it('S3: the second set_override is refused: says which key was copied and which was not, and why', async () => {
    hasOverride[D2] = true;
    overrides[D2] = { description_override: 'Live band', ticket_url_override: 'https://t.example.com/b' };
    const base = rpc.getMockImplementation();
    let n = 0;
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'occurrence_command_p5' && ++n === 2) return { data: null, error: { code: 'P0001', message: 'invalid_payload: ticket_url must be blank or an http(s) URL' } };
      return base!(fn, args);
    });
    mount(ORG_PATHS.changeCopy(S, D1));
    fireEvent.click((await screen.findAllByTestId('change-copy-source')).find((r) => !r.hasAttribute('disabled'))!);
    fireEvent.click(await screen.findByTestId('change-copy-confirm'));
    expect((await screen.findByTestId('change-error-message')).textContent)
      .toBe('Note copied, Ticket link not copied: Enter a full link starting with https://.');
  });

  it('N3: nothing to copy reads "Nothing to copy" and points at the reason', async () => {
    hasOverride[D2] = true;
    overrides[D2] = { description_override: 'Band' };
    overrides[D1] = { description_override: 'Band' };
    mount(ORG_PATHS.changeCopy(S, D1));
    fireEvent.click((await screen.findAllByTestId('change-copy-source')).find((r) => !r.hasAttribute('disabled'))!);
    const btn = await screen.findByTestId('change-copy-confirm');
    expect(btn.textContent).toBe('Nothing to copy');
    expect(document.getElementById(btn.getAttribute('aria-describedby') ?? '')?.getAttribute('data-testid')).toBe('change-copy-same');
  });
});

// ---- F-PAR-final (REVIEW-PAR-C S1, N2, N4): written red-first --------------------------------------

describe('F-PAR-final S1: Pick several never offers a move the server refuses', () => {
  const SHAPES: { name: string; format: string; rule: unknown; shiftOff: boolean }[] = [
    { name: 'weekly', format: 'recurring', rule: { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } }, shiftOff: true },
    { name: 'monthly', format: 'recurring', rule: { mode: 'monthly', week: 1, weekday: 5, end: { kind: 'none' } }, shiftOff: true },
    { name: 'no rule', format: 'recurring', rule: null, shiftOff: false },
    { name: 'one-off', format: 'one_off', rule: null, shiftOff: false },
  ];
  it.each(SHAPES)('$name: the shift controls show only when the server can move the dates', async (shape) => {
    fmt = shape.format;
    rule = shape.rule;
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[0]);
    for (const id of ['change-pick-earlier', 'change-pick-later', 'change-pick-days', 'change-pick-move']) {
      expect(!!screen.queryByTestId(id), id).toBe(!shape.shiftOff);
    }
    const off = screen.queryByTestId('change-pick-shift-off');
    expect(off?.textContent ?? null).toBe(shape.shiftOff ? shiftRefusal(shape.rule) : null);
  });

  it('cancelling ticked dates still works on a weekly series', async () => {
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[1]);
    fireEvent.click(screen.getByTestId('change-pick-cancel'));
    fireEvent.click(await screen.findByTestId('change-pick-confirm'));
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0][1].p_envelope.command.kind).toBe('occurrence.bulk_cancel');
  });
});

describe('F-PAR-final N4: Pick several with no coming dates shows only the empty state', () => {
  it('renders NO_COMING and Add a date, and no action block', async () => {
    cancelledNow = new Set([D1, D2, D3]);
    mount(ORG_PATHS.changePick(S));
    expect((await screen.findByTestId('change-pick-empty')).textContent).toBe(NO_COMING);
    expect(screen.getByTestId('change-pick-add')).toBeTruthy();
    for (const id of ['change-pick-count', 'change-pick-cancel', 'change-pick-earlier', 'change-pick-days', 'change-pick-move', 'change-pick-shift-off']) {
      expect(screen.queryByTestId(id), id).toBeNull();
    }
  });
});

describe('F-PAR-final N2: Change time is refused on a festival before the form', () => {
  // Prod 2026-10-18: 7 live festivals, 6 coming dates (format 'festival'; 0 rows carry festival_id).
  const SHAPES: { name: string; format: string; festivalId: string | null; editable: boolean; refused: boolean }[] = [
    { name: 'festival', format: 'festival', festivalId: null, editable: true, refused: true },
    { name: 'festival multi-day', format: 'festival', festivalId: null, editable: false, refused: true },
    { name: 'linked to a festival', format: 'recurring', festivalId: 'f1', editable: true, refused: true },
    { name: 'normal', format: 'recurring', festivalId: null, editable: true, refused: false },
    { name: 'normal multi-day', format: 'recurring', festivalId: null, editable: false, refused: false },
  ];
  const setShape = (shape: (typeof SHAPES)[number]) => {
    fmt = shape.format;
    festivalId = shape.festivalId;
    if (shape.format === 'festival') rule = null;
    editable = shape.editable ? { editable: true, reason: null } : { editable: false, reason: 'multi_day' };
  };

  it.each(SHAPES)('$name: Which date says it once', async (shape) => {
    setShape(shape);
    mount(ORG_PATHS.changeEvent(S));
    await screen.findAllByTestId('change-date-row');
    await flush();
    expect(screen.queryByTestId('change-festival-time')?.textContent ?? null).toBe(shape.refused ? FESTIVAL_TIME : null);
  });

  it.each(SHAPES)('$name: Change what disables Change the time with the same words', async (shape) => {
    setShape(shape);
    mount(ORG_PATHS.changeDate(S, D2));
    const row = await screen.findByTestId('change-time');
    await flush();
    expect((row as HTMLButtonElement).disabled).toBe(shape.refused);
    expect(row.textContent?.includes(FESTIVAL_TIME)).toBe(shape.refused);
  });

  it.each(SHAPES)('$name: the Time screen refuses before the form, with a way forward', async (shape) => {
    setShape(shape);
    mount(ORG_PATHS.changeTime(S, D2));
    await waitFor(() => expect(screen.queryByTestId('change-time-screen') ?? screen.queryByTestId('change-time-festival')).toBeTruthy());
    if (!shape.refused) {
      expect(screen.getByTestId('change-time-input')).toBeTruthy();
      return;
    }
    const box = screen.getByTestId('change-time-festival');
    expect(screen.queryByTestId('change-time-input')).toBeNull();
    expect(box.textContent).toContain(FESTIVAL_TIME);
    expect(box.textContent).toContain(festivalTimeNext(shape.editable));
    const link = screen.queryByTestId('change-time-festival-sessions');
    expect(!!link).toBe(shape.editable);
    if (link) {
      fireEvent.click(link);
      expect((await screen.findByTestId('where')).textContent).toBe(ORG_PATHS.dateLineup(S, D2));
    }
    expect(commands()).toHaveLength(0);
  });
});

describe('F-PAR Take this date off (PAR-B S6): the one shared body', () => {
  it('shows TAKE_OFF.body and where to put it back', async () => {
    mount(ORG_PATHS.changeOff(S, D2));
    const screenEl = await screen.findByTestId('change-off-screen');
    expect(screenEl.textContent).toContain(TAKE_OFF.body);
    expect(screenEl.textContent).toContain(TAKE_OFF.undo);
  });
});
