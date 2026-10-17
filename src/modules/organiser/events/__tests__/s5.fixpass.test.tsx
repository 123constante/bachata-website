// @vitest-environment jsdom
/**
 * S5 fix pass (REVIEW-S5 SHOULD-1..3, NOTE-2, NOTE-4, NOTE-5). The same frozen
 * Tuesday 20 October 2026 world as s5.events; the venue list and the city
 * lookup are stubbed so the venue row can write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const VENUE = { id: 'venue-2', name: 'The Loft', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null };
vi.mock('@/modules/organiser/shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/publicVenues')>()),
  useVenueOptions: () => ({ data: [VENUE], isError: false, isFetching: false, refetch: async () => undefined }),
}));
vi.mock('@/modules/organiser/shared/createCity', () => ({ resolveCreateCityId: async () => 'city-london' }));

import OneEvent from '../OneEvent';
import Details from '../Details';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { endedOnLabel, eventLock } from '@/modules/organiser/shared/eventState';
import { eventStepPath, detailEditPath, FULL_READ_STOP_REASON } from '@/modules/organiser/flows/event/eventSteps';
import { detailCommand, detailValue, parseEventWorkspace, type TextDetail } from '../eventModel';
import {
  A, PAUSED, answer, commandsOf, comingRun, day, defaultWorld, flush, mount, series, today, type World,
} from '@/modules/organiser/flows/add/__tests__/fixtures';

const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };

let world: World;
let wsOver: Record<string, Record<string, unknown>>;
let hasMore: Record<string, boolean>;

const wsRaw = (id: string) => {
  const s = world.series.find((x) => x.id === id);
  return {
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
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  rpc.mockReset();
  world = defaultWorld();
  wsOver = {};
  hasMore = {};
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
    fn === 'admin_event_workspace_p5' ? { data: wsRaw(String(args.p_series_id)), error: null } : base(fn, args));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;

describe('SHOULD-1: a full 100-date read cannot build the stop keep list', () => {
  const full = () => {
    world.occs[A] = comingRun(100);
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    hasMore[A] = true;
  };

  it('the Stop repeating row is disabled with the reason', async () => {
    full();
    mount(ORG_PATHS.event(A), routes);
    await waitFor(() => expect(screen.getByTestId('org-event-stop').getAttribute('aria-disabled')).toBe('true'));
    expect(screen.getByTestId('org-event-stop').getAttribute('href')).toBeNull();
    expect(screen.getByTestId('org-event-stop-reason').textContent).toBe(FULL_READ_STOP_REASON);
  });

  it('a direct ?do=stop shows the reason, no button, and sends nothing', async () => {
    full();
    mount(eventStepPath(A, 'stop'), routes);
    expect((await screen.findByTestId('event-step-refused')).textContent).toBe(FULL_READ_STOP_REASON);
    expect(screen.queryByTestId('event-step-send')).toBeNull();
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('the End line carries no number', async () => {
    full();
    mount(eventStepPath(A, 'end'), routes);
    const line = (await screen.findByTestId('event-end-line')).textContent ?? '';
    expect(line).not.toMatch(/\d/);
    expect(line).toBe('Every coming date comes off. Past dates stay.');
  });

  it('a read that is not full still counts: stop enabled, End numbered', async () => {
    world.occs[A] = comingRun(40);
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(eventStepPath(A, 'end'), routes);
    expect((await screen.findByTestId('event-end-line')).textContent).toBe('40 coming dates come off. Past dates stay.');
  });
});

type StatusShape = { name: string; status: string; occs: () => World['occs'][string]; endedOn?: string; lock: boolean; endedLine: string | null; none: RegExp };
const SHAPES: StatusShape[] = [
  { name: 'ended', status: 'ended', occs: () => [{ id: 'p1', date: day(-30), status: 'scheduled', version: 1 }], endedOn: '2026-09-05', lock: true, endedLine: 'Ended on Saturday 5 September', none: /^No coming dates$/ },
  { name: 'ended, cancelled-only', status: 'ended', occs: () => [{ id: 'c1', date: day(-12), status: 'cancelled', version: 1 }], endedOn: '2026-10-01', lock: true, endedLine: 'Ended on Thursday 1 October', none: /^No coming dates$/ },
  { name: 'archived', status: 'archived', occs: () => [], lock: true, endedLine: null, none: /^No coming dates$/ },
  { name: 'paused, 0 coming dates', status: 'paused', occs: () => [], lock: false, endedLine: null, none: /Resume it to add dates/ },
  { name: 'live, 0 coming dates', status: 'live', occs: () => [], lock: false, endedLine: null, none: /Add a date/ },
];

describe('SHOULD-2: the one-event screen says why and what to do, per status shape', () => {
  it.each(SHAPES)('$name', async ({ status, occs, endedOn, lock, endedLine, none }) => {
    world.occs[PAUSED] = occs();
    world.series[3] = series(PAUSED, 'Night', world.occs[PAUSED], { lifecycle_status: status });
    wsOver[PAUSED] = { lifecycle_status: status, ...(endedOn ? { ended_on: endedOn } : {}) };
    mount(ORG_PATHS.event(PAUSED), routes);
    const card = await screen.findByTestId('org-coming-none');
    await waitFor(() => expect(screen.queryByTestId('org-event-loading')).toBeNull());
    expect(card.textContent).toMatch(none);
    if (lock) expect(screen.getByTestId('org-event-lock').textContent).toBe(eventLock(status));
    else expect(screen.queryByTestId('org-event-lock')).toBeNull();
    if (endedLine) {
      expect(endedOnLabel(status, endedOn, today())).toBe(endedLine);
      expect(screen.getByTestId('org-event-ended-on').textContent).toBe(endedLine);
    } else expect(screen.queryByTestId('org-event-ended-on')).toBeNull();
    if (status === 'paused') expect(screen.getByTestId('org-event-resume').getAttribute('href')).toBe(eventStepPath(PAUSED, 'resume'));
    if (status === 'live') expect(screen.getByTestId('org-coming-add')).toBeTruthy();
    else expect(screen.queryByTestId('org-coming-add')).toBeNull();
  });

  it('Details shows the same lock and ended lines as the one-event screen', async () => {
    world.occs[PAUSED] = [];
    world.series[3] = series(PAUSED, 'Night', [], { lifecycle_status: 'ended' });
    wsOver[PAUSED] = { lifecycle_status: 'ended', ended_on: '2026-09-05' };
    mount(ORG_PATHS.eventDetails(PAUSED), routes);
    expect((await screen.findByTestId('org-detail-lock')).textContent).toBe(eventLock('ended'));
    expect(screen.getByTestId('org-detail-ended-on').textContent).toBe('Ended on Saturday 5 September');
  });
});

describe('SHOULD-3: the venue row writes on sheet close', () => {
  it('another venue -> ONE series.upsert {name, default_venue_id, default_city_id} with expected_version', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId('org-detail-venue'));
    fireEvent.click(await screen.findByTestId('org-venue-search-open'));
    fireEvent.click(await screen.findByTestId('org-venue-result'));
    fireEvent.click(await screen.findByTestId('org-sheet-done'));
    await flush();
    await waitFor(() => expect(commandsOf(rpc)).toHaveLength(1));
    const [sent] = commandsOf(rpc);
    expect(sent.env.expected_version).toBe(world.seriesVersion);
    expect(sent.env.command).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', default_venue_id: VENUE.id, default_city_id: 'city-london' } });
    await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
  });

  it('opened and closed untouched -> nothing sent', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId('org-detail-venue'));
    fireEvent.click(await screen.findByTestId('org-sheet-done'));
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('the same venue picked again -> nothing sent', async () => {
    wsOver[A] = { default_venue_id: VENUE.id };
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId('org-detail-venue'));
    fireEvent.click(await screen.findByTestId('org-venue-search-open'));
    fireEvent.click(await screen.findByTestId('org-venue-result'));
    fireEvent.click(await screen.findByTestId('org-sheet-done'));
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });
});

describe('NOTE-2: detailCommand is null for an unchanged value, on its own', () => {
  const FIELDS: TextDetail[] = ['name', 'time', 'level', 'music', 'tickets', 'instagram', 'about'];
  it.each(FIELDS)('%s', (field) => {
    world = defaultWorld();
    wsOver = { [A]: { default_level: 'All levels', default_ticket_url: 'https://t.example.com/x', instagram_url: 'https://www.instagram.com/x', default_music_styles: ['Bachata', 'Kizomba'] } };
    hasMore = {};
    const ws = parseEventWorkspace(wsRaw(A));
    expect(detailCommand(ws, field, detailValue(ws, field))).toBeNull();
    expect(detailCommand(ws, field, ` ${detailValue(ws, field)} `)).toBeNull();
  });
});

describe('NOTE-4: Change the day, untouched', () => {
  it('the current day is picked, the button is off with "Pick another day", and a click sends nothing', async () => {
    mount(eventStepPath(A, 'day'), routes);
    const btn = await screen.findByTestId('event-step-send');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Pick another day')).toBeTruthy();
    fireEvent.click(btn);
    fireEvent.click(screen.getByTestId('event-day-5'));
    fireEvent.click(btn);
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });
});

describe('NOTE-5: a locked Details screen keeps the Cover row read-only', () => {
  it('ended -> the Cover row is not a link', async () => {
    world.series[0] = series(A, 'Friday Social', world.occs[A], { lifecycle_status: 'ended' });
    wsOver[A] = { lifecycle_status: 'ended' };
    mount(ORG_PATHS.eventDetails(A), routes);
    const cover = await screen.findByTestId('org-detail-cover');
    await screen.findByTestId('org-detail-lock');
    expect(cover.getAttribute('href')).toBeNull();
    expect(cover.closest('a')).toBeNull();
  });

  it('live -> the Cover row links to the cover screen', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    expect((await screen.findByTestId('org-detail-cover')).getAttribute('href')).toBe(ORG_PATHS.cover(A));
  });
});

it('detail edit paths stay as pinned', () => {
  expect(detailEditPath(A, 'about')).toBe(`${ORG_PATHS.eventDetails(A)}?edit=about`);
});
