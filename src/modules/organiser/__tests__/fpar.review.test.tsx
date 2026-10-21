// @vitest-environment jsdom
/**
 * F-PAR review fixes (PAR-A S2/N1, PAR-B B1/S4/S5/S6/S7/S9/N5-N9): each item is
 * pinned table-driven where it is a mapping, and rendered where it is a screen.
 * The clock is frozen on Tuesday 20 October 2026 (flows/add fixtures).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import OneEvent from '../events/OneEvent';
import Details from '../events/Details';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { NO_COMING, PUT_IT_BACK } from '@/modules/organiser/shared/copy';
import { parseEventWorkspace } from '@/modules/organiser/events/eventModel';
import * as life from '@/modules/organiser/events/lifecycleModel';
import * as steps from '@/modules/organiser/flows/event/eventSteps';
import { eventStepPath } from '@/modules/organiser/flows/event/eventSteps';
import { rawWorkspace, TODAY } from '@/modules/organiser/events/__tests__/fixtures';
import { A, DRAFT, FROZEN, answer, comingRun, day, defaultWorld, flush, mount, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };

let world: World;
let wsOver: Record<string, Record<string, unknown>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  wsOver = {};
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
            id, name: s?.name ?? '', slug: null, format: s?.format ?? 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
            default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_city_id: null, default_ticket_url: null,
            default_cover_image_url: s?.lifecycle_status === 'draft' ? null : 'https://x/c.jpg', default_duration: null, passes: [],
            default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
            gallery: [], video_urls: [], recurrence_rule: WEEKLY_FRIDAY, removed_dates: [], ...(wsOver[id] ?? {}),
          },
          program: [],
        },
        occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: false },
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
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);

// ---- 1. PAR-B B1 + S7: every Go live reason names what to do -------------------------------

const VENUE = { default_venue_id: 'v1' };
const COVER = { default_cover_image_url: 'https://x/c.jpg' };
const NO_DATE = { default_start_date: '2026-01-01' };
const COMING = [{ id: 'o1', occurrence_date: '2026-10-16', lifecycle_status: 'scheduled', version: 1 }];
const draftWs = (over: Record<string, unknown>, occs: unknown[]) =>
  parseEventWorkspace(rawWorkspace({ lifecycle_status: 'draft', default_venue_id: null, default_cover_image_url: null, ...over }, occs));

type GoCase = [string, Record<string, unknown>, unknown[], boolean, string | null, boolean, boolean];
const GO_CASES: GoCase[] = [
  ['venue missing, a1 off', { ...COVER }, COMING, false, 'Needs the next platform update. Before then, add a venue in Details.', true, false],
  ['date missing, a1 off', { ...VENUE, ...COVER, ...NO_DATE }, [], false, 'Needs the next platform update. Before then, add a date from today on with Add a date.', false, true],
  ['cover missing, a1 off', { ...VENUE }, COMING, false, 'Needs the next platform update. Before then, add a flyer in Details.', true, false],
  ['venue, cover and date missing, a1 off', { ...NO_DATE }, [], false,
    'Needs the next platform update. Before then, add a venue and a flyer in Details, and add a date from today on with Add a date.', true, true],
  ['nothing missing, a1 off', { ...VENUE, ...COVER }, COMING, false, 'Your event is ready. Go live switches on here after the next platform update.', false, false],
  ['venue missing, a1 on', { ...COVER }, COMING, true, 'To go live, add a venue in Details.', true, false],
  ['date missing, a1 on', { ...VENUE, ...COVER, ...NO_DATE }, [], true, 'To go live, add a date from today on with Add a date.', false, true],
  ['cover missing, a1 on', { ...VENUE }, COMING, true, 'To go live, add a flyer in Details.', true, false],
  ['nothing missing, a1 on', { ...VENUE, ...COVER }, COMING, true, null, false, false],
];

describe('1. Go live reasons (PAR-B B1, S7)', () => {
  it('GO_LIVE_READY is the one ready sentence', () => {
    expect((life as Record<string, unknown>).GO_LIVE_READY).toBe('Your event is ready. Go live switches on here after the next platform update.');
  });
  it.each(GO_CASES)('%s: the reason names what to do, and the card offers the way there', (_n, over, occs, a1, reason, toDetails, toAddDate) => {
    const ws = draftWs(over, occs);
    expect(life.goLiveReason(ws, TODAY, a1)).toBe(reason);
    const row = life.lifecycleRows(ws, TODAY, a1).goLive as Record<string, unknown>;
    expect(!!row.toDetails).toBe(toDetails);
    expect(!!row.toAddDate).toBe(toAddDate);
    // A date is never said to be "in Details".
    if (reason) expect(reason).not.toMatch(/date[^.]*in Details/);
  });

  it('a draft with no coming date links to Add a date; Open Details only while a Details item is missing', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    expect((await screen.findByTestId('org-life-add-date')).getAttribute('href')).toBe(ORG_PATHS.addEvent(DRAFT));
    expect(screen.getByTestId('org-life-details')).toBeTruthy();
    cleanup();
    wsOver[DRAFT] = { ...VENUE, ...COVER };
    mount(ORG_PATHS.event(DRAFT), routes);
    expect((await screen.findByTestId('org-life-add-date')).getAttribute('href')).toBe(ORG_PATHS.addEvent(DRAFT));
    expect(screen.queryByTestId('org-life-details')).toBeNull();
  });
});

// ---- 2. PAR-A S2: the stop line counts only the dates the server deletes ---------------------

const wd = (id: string, date: string, own = false) => ({
  id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: own,
  session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
});
const RUN = [wd('d1', '2026-10-23'), wd('d2', '2026-10-30'), wd('d3', '2026-11-06'), wd('d4', '2026-11-13')];

describe('2. Stop repeating line (PAR-A S2)', () => {
  type StopCase = [string, ReturnType<typeof wd>[], string, string];
  const CASES: StopCase[] = [
    ['no curated date after the cut', RUN, 'd2', '2 dates stay. 2 after them come off. No new dates after them.'],
    ['some curated after the cut', [RUN[0], RUN[1], wd('d3', '2026-11-06', true), RUN[3]], 'd2',
      '2 dates stay. 1 after them comes off. 1 with its own changes stays. No new dates after them.'],
    ['all curated after the cut', [RUN[0], wd('d2', '2026-10-30', true), wd('d3', '2026-11-06', true), wd('d4', '2026-11-13', true)], 'd1',
      '1 date stays. 3 with their own changes stay. No new dates after it.'],
    ['cut at the last date', RUN, 'd4', '4 dates stay. No new dates after them.'],
  ];
  it.each(CASES)('%s', (_n, coming, last, line) => {
    const stop = (steps as Record<string, unknown>).stopLine as (c: unknown[], l: string | null) => { line: string; keep: { id: string }[] };
    const out = stop(coming, last);
    expect(out.line).toBe(line);
    expect(out.keep.map((d) => d.id)).toEqual(coming.slice(0, coming.findIndex((d) => d.id === last) + 1).map((d) => d.id));
  });
});

// ---- 3. PAR-B S4: Stop repeating with no coming date ----------------------------------------

describe('3. Stop repeating with 0 coming dates (PAR-B S4, decision 5)', () => {
  it('eventActions: stop is off with NO_COMING when nothing is coming; on otherwise', () => {
    const s = { lifecycle_status: 'live', format: 'recurring', recurrence_rule: WEEKLY_FRIDAY };
    const actions = steps.eventActions as (s: unknown, full?: boolean, coming?: number) => ReturnType<typeof steps.eventActions>;
    expect(actions(s, false, 0).stop).toEqual({ reason: NO_COMING });
    expect(actions(s, false, 3).stop).toEqual({ reason: null });
  });

  it('One event shows the row off with NO_COMING and an Add a date link', async () => {
    world.occs[A] = [];
    mount(ORG_PATHS.event(A), routes);
    const row = await screen.findByTestId('org-event-stop');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('org-event-stop-reason').textContent).toBe(NO_COMING);
    expect(screen.getByTestId('org-event-stop-add-date').getAttribute('href')).toBe(ORG_PATHS.addEvent(A));
  });

  it('?do=stop with nothing coming is refused with NO_COMING and an Add a date link', async () => {
    world.occs[A] = [];
    mount(eventStepPath(A, 'stop'), routes);
    expect((await screen.findByTestId('event-step-refused')).textContent).toBe(NO_COMING);
    expect(screen.getByTestId('event-step-add-date').getAttribute('href')).toBe(ORG_PATHS.addEvent(A));
    expect(screen.queryByTestId('event-step-send')).toBeNull();
  });
});

// ---- 4. PAR-B N5: a ?do= that does not apply says why -----------------------------------------

describe('4. A step that does not apply says why (PAR-B N5)', () => {
  it('?do=weekly on a weekly event: "It already repeats weekly."', async () => {
    mount(eventStepPath(A, 'weekly'), routes);
    expect((await screen.findByTestId('event-step-refused')).textContent).toBe('It already repeats weekly.');
  });
  it('?do=stop on a one-off: "It does not repeat."', async () => {
    wsOver[A] = { format: 'one_off', recurrence_rule: null };
    mount(eventStepPath(A, 'stop'), routes);
    expect((await screen.findByTestId('event-step-refused')).textContent).toBe('It does not repeat.');
  });
});

// ---- 5. PAR-B N6: the event name on its own line ---------------------------------------------

describe('5. Step heading (PAR-B N6)', () => {
  it('the event name renders in its own element, the heading is the action', async () => {
    mount(eventStepPath(A, 'stop'), routes);
    const name = await screen.findByTestId('event-step-name');
    expect(name.textContent).toBe('Friday Social');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Stop repeating');
  });
});

// ---- 6. PAR-B N7: "1 week" ------------------------------------------------------------------

describe('6. Make it weekly counts (PAR-B N7)', () => {
  it('a one-week choice says "1 week", never "1 weeks"', async () => {
    wsOver[A] = { recurrence_rule: null };
    // 29 coming dates on other days leave room for exactly one more.
    // day(1) is a Wednesday: keep every other weekday, so the new Wednesday rule has room for one.
    world.occs[A] = comingRun(45).filter((_o, i) => i % 7 !== 0).slice(0, 29);
    mount(eventStepPath(A, 'weekly'), routes);
    fireEvent.click(await screen.findByTestId('event-day-3'));
    const ends = await screen.findAllByTestId('event-weekly-until');
    const texts = ends.map((e) => e.textContent ?? '');
    expect(texts.some((t) => /^1 week,/.test(t))).toBe(true);
    expect(texts.filter((t) => /^1 weeks/.test(t))).toEqual([]);
  });
});

// ---- 12. PAR-B N9: off rows are focusable and described; Discard is destructive ------------

function renderDone(seriesId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: ORG_PATHS.done, state: { title: 'Saved', message: 'Saved', seriesId } }]}>
        <Routes><Route path={ORG_PATHS.done} element={<Done />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const describedBy = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby') ?? '');

describe('12. Focusable off rows and a destructive Discard (PAR-B N9)', () => {
  it('Go live (off) is focusable and described by its reason', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    const go = await screen.findByTestId('org-life-golive');
    expect(go.getAttribute('tabindex')).toBe('0');
    expect(describedBy(go)).toBe(screen.getByTestId('org-life-golive-reason'));
  });
  it('Done: See it live (off) is focusable and described by its reason', async () => {
    renderDone(DRAFT);
    const see = await screen.findByTestId('org-done-live');
    expect(see.getAttribute('tabindex')).toBe('0');
    expect(describedBy(see)).toBe(screen.getByTestId('org-done-live-reason'));
  });
  it('the Discard confirm is styled destructive', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-discard'));
    expect((await screen.findByTestId('org-life-discard-confirm')).className).toContain('bg-[var(--danger)]');
  });
});
