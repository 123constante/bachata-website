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
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { NOT_EDITABLE_COPY } from '@/modules/organiser/shared/programmeModel';
import { readDoneState } from '@/modules/organiser/flows/doneState';
import { BULK_REFUSED_REASON, COPY_NONE, shiftRefusal } from '../changeModel';

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
    id: S, name: 'Friday Social', slug: null, format: 'recurring', category: null, lifecycle_status: 'live', default_local_start_time: '20:00',
    default_cover_image_url: null, created_at: '2026-01-01T00:00:00Z', upcoming_count: 3, cancelled_upcoming_count: 0,
    next_dates: [homeDate(D1), homeDate(D2), homeDate(D3)], latest_decision: null,
  }] }],
});
const workspace = () => ({
  series: { series: { id: S, name: 'Friday Social', format: 'recurring', lifecycle_status: 'live', version: 9, default_venue_id: 'v1', default_local_start_time: usualStart, recurrence_rule: rule, default_start_date: '2026-01-01' }, program: [] },
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
          <Route path={`${base}/:occurrenceId/day`} element={<ChangeFlow step="day" />} />
          <Route path={`${base}/:occurrenceId/lineup`} element={<Where />} />
          <Route path={`${base}/:occurrenceId/off`} element={<ChangeFlow step="off" />} />
          <Route path={`${base}/:occurrenceId/copy`} element={<ChangeFlow step="copy" />} />
          <Route path={`${base}/:occurrenceId/:field`} element={<ChangeFlow step="detail" />} />
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
    { testId: 'change-cancel', to: () => ORG_PATHS.cancelDate(S, D2) },
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

  it.each([
    { a1: false, shown: false },
    { a1: true, shown: true },
  ])('Move to another day is shown only once admin A1 is applied (A1_APPLIED=$a1)', async ({ a1, shown }) => {
    gate.a1 = a1;
    mount(ORG_PATHS.changeDate(S, D1));
    await screen.findByTestId('change-what');
    expect(!!screen.queryByTestId('change-day')).toBe(shown);
  });

  it('Move by URL before A1 is refused with a reason, never a command', async () => {
    mount(ORG_PATHS.changeDay(S, D1));
    expect((await screen.findByTestId('change-refusal')).textContent).toMatch(/not open/i);
    expect(commands()).toHaveLength(0);
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
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves by 1 h later');
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
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves by 12 h earlier');
    fireEvent.change(screen.getByTestId('change-time-input'), { target: { value: '01:00' } });
    expect(screen.getByTestId('change-time-delta').textContent).toBe('Every session moves by 5 h later');
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

  it('move together is disabled with the reason on a weekly repeat', async () => {
    mount(ORG_PATHS.changePick(S));
    fireEvent.click((await screen.findAllByTestId('change-pick-date'))[0]);
    expect(screen.getByTestId('change-pick-move').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('change-pick-move-reason').textContent).toBe(shiftRefusal(rule));
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
