// @vitest-environment jsdom
/**
 * S5 (plan 4.4 S5 row, boards C33 / C36 / C37 / C42-C45): My events, one event
 * (dates first, D23), its details, pause / resume / end / repeats / put back.
 * Every action sends exactly ONE command of the pinned kind with the series id
 * and expected_version, then lands on Done (D29, no Undo: D49/D61). The clock
 * is frozen on Tuesday 20 October 2026 and the dates straddle 25 October.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import EventsPage from '../index';
import OneEvent from '../OneEvent';
import Details from '../Details';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { seriesChip } from '@/modules/organiser/jobs/homeJobs';
import { VERSION_CONFLICT, WARN_END } from '@/modules/organiser/shared/copy';
import { FLYER_LABEL } from '@/modules/organiser/shared/flyerLabel';
import { putBackPath, RESTORE_CAP_NOTE } from '@/modules/organiser/flows/cancel/cancelModel';
import { eventStepPath, detailEditPath, COURSE_STOP_REASON } from '@/modules/organiser/flows/event/eventSteps';
import {
  A, AFTER, B, BEFORE, FROZEN, GONE, PAUSED, answer, commandsOf, comingRun, day, defaultWorld, flush, home, mount, series, today, tooSmall, type World,
} from '@/modules/organiser/flows/add/__tests__/fixtures';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';

const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };

let world: World;
let wsOver: Record<string, Record<string, unknown>>;
let hasMore: Record<string, boolean>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  wsOver = {};
  hasMore = {};
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== 'admin_event_workspace_p5') return base(fn, args);
    const id = String(args.p_series_id);
    const s = world.series.find((x) => x.id === id);
    return {
      data: {
        series: {
          series: {
            id, name: s?.name ?? '', format: s?.format ?? 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
            default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_ticket_url: null,
            default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
            recurrence_rule: WEEKLY_FRIDAY, removed_dates: [], ...(wsOver[id] ?? {}),
          },
          program: [],
        },
        occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: hasMore[id] ?? false },
      },
      error: null,
    };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/events" element={<EventsPage />} />
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;
const send = async (testId = 'event-step-send') => {
  const btn = await screen.findByTestId(testId);
  await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(false));
  fireEvent.click(btn);
  await flush();
};

describe('C33 My events', () => {
  it('lists every listed series with the SAME chip Home reads (one mapping, consumer side)', async () => {
    const { container } = mount(ORG_PATHS.events, routes);
    const rows = await screen.findAllByTestId('org-event-row');
    expect(rows).toHaveLength(world.series.length);
    for (const s of world.series) {
      const row = rows.find((r) => r.getAttribute('data-series-id') === s.id) as HTMLElement;
      expect(row.getAttribute('href')).toBe(ORG_PATHS.event(s.id));
      expect(within(row).getByTestId('org-event-chip').textContent).toBe(seriesChip(s as unknown as HomeSeriesFull, today()).label);
    }
    expect(tooSmall(container)).toEqual([]);
  });

  it('a live event with no coming date reads "Nothing coming up" under Past (W3 d31)', async () => {
    world.occs[B] = [];
    world.series[1] = series(B, 'Sunday Class', []);
    mount(ORG_PATHS.events, routes);
    fireEvent.click(await screen.findByTestId('org-events-past-toggle'));
    const row = (await screen.findAllByTestId('org-event-row')).find((r) => r.getAttribute('data-series-id') === B) as HTMLElement;
    expect(within(row).getByTestId('org-event-chip').textContent).toBe('Nothing coming up');
  });

  it('C33b: no events -> "No events yet" with the one action New event', async () => {
    world.series = [];
    mount(ORG_PATHS.events, routes);
    const empty = await screen.findByTestId('org-events-empty');
    expect(empty.textContent).toContain('No events yet');
    expect(within(empty).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(empty).getByTestId('org-events-new'));
    expect(where()).toBe(ORG_PATHS.newWhat);
  });
});

describe('C36 one event: dates first (D23)', () => {
  it('leads with the month and the coming dates; the title opens Details; no Undo bar', async () => {
    const { container } = mount(ORG_PATHS.event(A), routes);
    const dates = await screen.findAllByTestId('org-coming-date');
    expect(dates.map((d) => d.textContent)).toEqual([expect.stringContaining('Friday 23 October'), expect.stringContaining('Friday 30 October')]);
    expect(dates[0].getAttribute('href')).toBe(ORG_PATHS.changeDate(A, BEFORE));
    expect(dates[1].getAttribute('href')).toBe(ORG_PATHS.changeDate(A, AFTER));
    expect(screen.getByTestId('org-month')).toBeTruthy();
    expect(screen.queryByText(/undo/i)).toBeNull();
    await waitFor(() => expect(tooSmall(container)).toEqual([]));
    fireEvent.click(screen.getByTestId('org-event-title'));
    expect(where()).toBe(ORG_PATHS.eventDetails(A));
  });

  it('"N more" reads the workspace past the three Home dates', async () => {
    world.occs[A] = comingRun(10);
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(ORG_PATHS.event(A), routes);
    await waitFor(() => expect(screen.getByTestId('org-coming-more').textContent).toBe('7 more'));
  });

  it('"100+" when the workspace read is at its 100-date cap (R3-20)', async () => {
    world.occs[A] = comingRun(100);
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    hasMore[A] = true;
    mount(ORG_PATHS.event(A), routes);
    await waitFor(() => expect(screen.getByTestId('org-coming-more').textContent).toBe('100+'));
  });

  it('C45: a cancelled coming date shows with Put it back -> ONE uncancel screen (D46)', async () => {
    mount(ORG_PATHS.event(A), routes);
    const row = await screen.findByTestId('org-cancelled-date');
    expect(row.textContent).toContain('Friday 6 November');
    expect(within(row).getByTestId('org-put-back').getAttribute('href')).toBe(putBackPath(A, GONE));
  });

  it('C45 at the cap: Put it back is disabled with the reason', async () => {
    world.occs[A] = [...comingRun(30), { id: GONE, date: day(40), status: 'cancelled', version: 7 }];
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(ORG_PATHS.event(A), routes);
    const row = await screen.findByTestId('org-cancelled-date');
    const put = within(row).getByTestId('org-put-back');
    expect(put.getAttribute('aria-disabled')).toBe('true');
    expect(put.getAttribute('href')).toBeNull();
    expect(within(row).getByTestId('org-put-back-reason').textContent).toBe(RESTORE_CAP_NOTE);
  });
});

type Case = { name: string; id: string; step: Parameters<typeof eventStepPath>[1]; pick?: string; kind: string; payload: Record<string, unknown>; done: RegExp };
const CASES: Case[] = [
  { name: 'pause', id: A, step: 'pause', kind: 'series.set_lifecycle', payload: { to: 'paused' }, done: /^Paused/ },
  { name: 'resume', id: PAUSED, step: 'resume', kind: 'series.set_lifecycle', payload: { to: 'live' }, done: /^Live/ },
  { name: 'end', id: A, step: 'end', kind: 'series.end_run', payload: {}, done: /^Ended/ },
  { name: 'change the day', id: A, step: 'day', pick: 'event-day-6', kind: 'series.set_recurrence', payload: { ...WEEKLY_FRIDAY, weekdays: [6] }, done: /Saturday/ },
  { name: 'stop repeating', id: A, step: 'stop', kind: 'series.stop_repeating', payload: { keep_occurrence_ids: [BEFORE, AFTER] }, done: /^Stops repeating/ },
];

describe('C42-C44: each action sends exactly ONE command, then Done', () => {
  it.each(CASES)('$name', async ({ id, step, pick, kind, payload, done }) => {
    const { container } = mount(ORG_PATHS.event(id), routes);
    const row = await screen.findByTestId(`org-event-${step}`);
    expect(row.getAttribute('href')).toBe(eventStepPath(id, step));
    fireEvent.click(row);
    await screen.findByTestId('event-step');
    await waitFor(() => expect(tooSmall(container)).toEqual([]));
    if (pick) fireEvent.click(await screen.findByTestId(pick));
    await send();
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(1);
    expect(sent[0].fn).toBe('series_command_p5');
    expect(sent[0].env.target_id).toBe(id);
    expect(sent[0].env.expected_version).toBe(world.seriesVersion);
    expect(sent[0].env.command).toEqual({ kind, payload });
    await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
    expect(screen.getByTestId('org-done-message').textContent).toMatch(done);
    expect(screen.queryByText(/undo/i)).toBeNull();
  });

  it('End (C42c) says what the server does and carries WARN_END', async () => {
    mount(eventStepPath(A, 'end'), routes);
    expect((await screen.findByTestId('event-end-line')).textContent).toBe('2 coming dates come off. Past dates stay.');
    expect(screen.getByTestId('event-end-warning').textContent).toBe(WARN_END);
  });

  it('End with a date tonight asks first and sends today_session', async () => {
    world.occs[A] = [{ id: 'tonight', date: today(), status: 'scheduled', version: 1 }, ...world.occs[A]];
    mount(eventStepPath(A, 'end'), routes);
    const btn = await screen.findByTestId('event-step-send');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn);
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
    fireEvent.click(screen.getByTestId('event-end-tonight-off'));
    await send();
    expect(commandsOf(rpc).map((c) => c.env.command)).toEqual([{ kind: 'series.end_run', payload: { today_session: 'not_running' } }]);
  });

  it('a course cannot stop repeating: the row is disabled with the reason (R3-1)', async () => {
    world.series[0] = series(A, 'Salsa Course', world.occs[A], { format: 'course' });
    mount(ORG_PATHS.event(A), routes);
    const row = await screen.findByTestId('org-event-stop');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.getAttribute('href')).toBeNull();
    expect(screen.getByTestId('org-event-stop-reason').textContent).toBe(COURSE_STOP_REASON);
    expect(COURSE_STOP_REASON).toBe('A course keeps its weeks');
  });

  it('version_conflict -> the R3-7 Done variant, nothing else', async () => {
    world.command = () => ({ data: null, error: { message: 'version_conflict: expected 9, found 10' } });
    mount(eventStepPath(A, 'pause'), routes);
    await send();
    expect((await screen.findByTestId('event-conflict')).textContent).toContain(VERSION_CONFLICT);
  });
});

type Field = { field: Parameters<typeof detailEditPath>[1]; value: string; key: string; sent: unknown };
const FIELDS: Field[] = [
  { field: 'name', value: 'Friday Social Club', key: 'name', sent: 'Friday Social Club' },
  // 'music' is chips since SW1: events/__tests__/sw1.parity.test.tsx
  { field: 'tickets', value: 'https://tickets.example.com/x', key: 'default_ticket_url', sent: 'https://tickets.example.com/x' },
  { field: 'about', value: 'Open social, all levels.', key: 'default_description', sent: 'Open social, all levels.' },
];

describe('C37 details: tap-to-edit rows, ONE series.upsert each', () => {
  it('lists the rows, the cover link and the existing line-up row (EditorRows ScheduleCard)', async () => {
    const { container } = mount(ORG_PATHS.eventDetails(A), routes);
    for (const f of ['name', 'venue', 'music', 'tickets', 'about']) {
      expect(await screen.findByTestId(`org-detail-${f}`)).toBeTruthy();
    }
    // S-FEEDBACK 1: the owner's four rows are not on the event page.
    // ER-C8 rule 1: no Time row either (time comes from the sessions).
    for (const f of ['time', 'ends', 'level', 'instagram', 'prices']) expect(screen.queryByTestId(`org-detail-${f}`)).toBeNull();
    const card = screen.getByTestId('org-detail-rows').textContent ?? '';
    for (const word of ['Time', 'Ends', 'Level', 'Instagram', 'Prices']) expect(card).not.toContain(word);
    expect(screen.getByTestId('org-detail-cover').getAttribute('href')).toBe(ORG_PATHS.cover(A));
    expect(screen.getByTestId('org-detail-cover').textContent).toContain(FLYER_LABEL);
    expect(await screen.findByTestId('org-schedule')).toBeTruthy();
    await waitFor(() => expect(tooSmall(container)).toEqual([]));
  });

  it.each(FIELDS)('$field', async ({ field, value, key, sent }) => {
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId(`org-detail-${field}`));
    expect(where()).toBe(detailEditPath(A, field));
    const input = await screen.findByTestId('org-detail-input');
    fireEvent.change(input, { target: { value } });
    await send('org-detail-save');
    const cmds = commandsOf(rpc);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].env.command.kind).toBe('series.upsert');
    expect(cmds[0].env.expected_version).toBe(world.seriesVersion);
    expect(cmds[0].env.command.payload[key]).toEqual(sent);
    expect(Object.keys(cmds[0].env.command.payload).sort()).toEqual([...new Set(['name', key])].sort());
    await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
  });

  it('an untouched Save is disabled and sends nothing', async () => {
    mount(detailEditPath(A, 'about'), routes);
    const save = await screen.findByTestId('org-detail-save');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(save);
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });
});

describe('world sanity', () => {
  it('the fixture world straddles 25 October', () => {
    expect(home(world).today).toBe('2026-10-20');
    expect(world.occs[A].some((o) => o.date < '2026-10-25')).toBe(true);
    expect(world.occs[A].some((o) => o.date > '2026-10-25')).toBe(true);
  });
});
