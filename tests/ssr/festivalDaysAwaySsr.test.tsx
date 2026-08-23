// @vitest-environment node
/**
 * SSR gate for the festival hero's days-away label.
 *
 * THE CLAIM UNDER TEST: on /festival/:id the timing cue ("In 3 days", "Tomorrow",
 * "Today", "Happening now") ships in the SERVER-rendered HTML. It used to be
 * gated on `mounted`, so it could only ever appear after hydration -- crawlers
 * and no-JS readers saw an empty box, and the label is the one piece of the hero
 * that answers "is this soon?".
 *
 * WHY THE CONTROL MATTERS. Asserting only that the label appears would pass just
 * as well if something else in the tree rendered that text, or if the gate were
 * removed outright (which would reintroduce the React #418 midnight mismatch on
 * the /event/<slug> mount, where no key is passed). So every positive case is
 * paired with the SAME render minus `serverTodayKey`, asserting the label is
 * ABSENT. The pair proves the prop is what causes the label -- and that dropping
 * the prop still leaves the mount gate intact.
 *
 * Rendered in PLAIN NODE (not jsdom) through the real provider stack, mirroring
 * tests/ssr/eventPageSsr.test.tsx: jsdom would define window and mask exactly the
 * server-vs-client divergence this file is about. Fetch is stubbed to throw --
 * every query is pre-seeded, so any network call means the fixture is wrong
 * rather than the assertion being lenient.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router';

const EVENT_UUID = '00000000-0000-4000-8000-0000000000f1';
const SLUG = 'test-festival';

// Deliberately NOT Europe/London. The festival page runs on the EVENT's calendar,
// so a London-pinned assumption anywhere in this path has to show up as a wrong
// label here rather than passing by coincidence on the developer's machine.
const TZ = 'Africa/Tunis';

// The festival runs 4-6 Sept. Every expected label below is derived from these
// two keys plus the pinned "today", never hard-coded to a real date -- so the
// suite does not rot the moment it is run on a different day.
const LOCAL_START = '2026-09-04';
const LOCAL_END = '2026-09-06';

const DAYS_AWAY_CLASS = 'hero-days-away';

// The schedule's visible "today" marker, asserted as RENDERED MARKUP rather than
// as the bare class name. The component inlines its stylesheet into the document,
// so the string `tl-day-today` is in the HTML of every festival page whether or
// not a badge rendered -- a `toContain('tl-day-today')` would be green against a
// completely broken gate. The `<span ...>` form only exists if the element did.
const TODAY_BADGE = '<span class="tl-day-today">Today</span>';

// The mobile day-tab carries no text, only a class, so the marker is the class
// LIST on a rendered button. Anchored to `class="day-tab` so the stylesheet's own
// `.day-tab` / `.tl-day` rules cannot satisfy it either.
const TODAY_TAB = /class="day-tab[^"]*\btoday\b[^"]*"/;

// One session on each of the festival's three days. `days` now comes from the
// SPAN (local_start..local_end) via festivalGridDays, not from the schedule --
// but the timeline block is still gated on having both days AND hours, and
// `hours` is session-derived, so a badge cannot render without this.
//
// NOTE this fixture cannot see the span/schedule distinction: its three session
// days are exactly the three span days, so span-derived and session-derived
// columns are identical here and these cases pass against either
// implementation.
//
// The session-less span day IS now covered, by 'badges a session-less span day
// but still opens day 1' in the default-day describe at the foot of this file,
// which filters this fixture down to two of the three days. An out-of-span
// session and an undated session remain queued, not covered.
const SCHEDULE = [LOCAL_START, '2026-09-05', LOCAL_END].map((day, i) => ({
  id: `sess-${i}`,
  day,
  title: `Session ${i}`,
  start_time: '20:00:00',
  type: 'class',
}));

let realFetch: typeof globalThis.fetch;

beforeAll(() => {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://stub-project.supabase.co');
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'stub-publishable-key');
  }
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('SSR gate: every query must be pre-seeded; no fetch during renderToString');
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
});

/**
 * Seed the four queries FestivalDetail mounts. Built through the REAL
 * parseFestivalDetail rather than a hand-written object literal: the parser is
 * what the loader and the client hook both run, so if the payload shape changes
 * under us this fixture changes with it instead of silently describing a shape
 * that no longer exists.
 */
async function seedClient(schedule: unknown[] = []): Promise<QueryClient> {
  const { createQueryClient } = await import('@/App');
  const { parseFestivalDetail, festivalDetailQueryKey } = await import(
    '@/modules/event-page/useFestivalDetailQuery'
  );
  const { festivalEventQueryKey } = await import('@/modules/event-page/festivalEventQuery');

  const client = createQueryClient();

  // useEntitySlugOrId: for `events` the id comes ONLY from this query (the raw
  // uuid is deliberately never re-injected), so without this the page renders
  // "Festival not found" and every other assertion here would be vacuous.
  client.setQueryData(['entity-resolve', 'events', 'id', EVENT_UUID], {
    id: EVENT_UUID,
    slug: SLUG,
  });

  client.setQueryData(festivalEventQueryKey(EVENT_UUID), {
    id: EVENT_UUID,
    name: 'Test Festival',
    city: 'Tunis',
    date: null,
    start_time: null,
    poster_url: null,
    description: null,
    ticket_url: null,
    faq: null,
    meta_data: null,
  });

  // Non-cancelled AND present: heroDayStatus stays silent until cancellation is
  // KNOWN, so an absent snapshot would suppress the label for a reason that has
  // nothing to do with SSR and make a red here mean the wrong thing.
  client.setQueryData(['festival-snapshot', EVENT_UUID], {
    occurrence_effective: { is_cancelled: false, cancellation_reason_label: null },
  });

  client.setQueryData(
    festivalDetailQueryKey(EVENT_UUID),
    parseFestivalDetail({
      event_id: EVENT_UUID,
      identity: { name: 'Test Festival' },
      dates: { local_start: LOCAL_START, local_end: LOCAL_END, timezone: TZ },
      schedule,
      passes: [],
    }),
  );

  return client;
}

/** Server-render /festival/:id, optionally with the loader's pinned day key. */
async function renderFestival(serverTodayKey?: string, schedule: unknown[] = []): Promise<string> {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');
  const client = await seedClient(schedule);

  return renderToString(
    <AppProviders client={client}>
      <StaticRouter location={`/festival/${EVENT_UUID}`}>
        <Routes>
          <Route
            path="/festival/:id"
            element={<FestivalDetail serverTodayKey={serverTodayKey} />}
          />
        </Routes>
      </StaticRouter>
    </AppProviders>,
  );
}

/**
 * The positive/negative pair, run for one pinned day.
 *
 * `expected` must appear in the server HTML WITH the key and must NOT appear
 * without it. The second half is the part that makes this a gate rather than a
 * smoke test.
 */
async function expectLabelOnlyWithServerKey(pinnedToday: string, expected: string) {
  const withKey = await renderFestival(pinnedToday);
  const withoutKey = await renderFestival(undefined);

  // Non-vacuity: prove we actually rendered the hero and not a skeleton or the
  // "Festival not found" branch. Without this, both assertions below pass
  // trivially on a page that rendered neither.
  expect(withKey).toContain(DAYS_AWAY_CLASS);
  expect(withKey).not.toContain('Festival not found');
  expect(withoutKey).toContain(DAYS_AWAY_CLASS);
  expect(withoutKey).not.toContain('Festival not found');

  expect(withKey).toContain(expected);
  expect(withoutKey).not.toContain(expected);
}

// renderToString of the full festival hero through the real provider stack is
// the slow part; the 5s default put this at the mercy of parallel load, exactly
// as documented on the sibling eventPageSsr spec.
describe('SSR: festival hero days-away label', { timeout: 20_000 }, () => {
  it('renders "In 3 days" server-side when the loader pins the day, and not without it', async () => {
    // 2026-09-01 -> 2026-09-04 is 3 whole calendar days.
    await expectLabelOnlyWithServerKey('2026-09-01', 'In 3 days');
  });

  it('renders the "Tomorrow" singular server-side (not "In 1 day")', async () => {
    await expectLabelOnlyWithServerKey('2026-09-03', 'Tomorrow');
    // The singular the site deliberately does NOT use -- CalendarListView says
    // "Tomorrow", so the festival hero must not say both.
    const html = await renderFestival('2026-09-03');
    expect(html).not.toContain('In 1 day');
  });

  it('renders "Today" server-side on the opening day', async () => {
    await expectLabelOnlyWithServerKey(LOCAL_START, 'Today');
  });

  it('renders "Happening now" server-side mid-run', async () => {
    await expectLabelOnlyWithServerKey('2026-09-05', 'Happening now');
  });

  it('leaves the schedule badges alone when there is no schedule', async () => {
    // The hero cases above seed an EMPTY schedule, so the whole timeline block
    // is unrendered. Stated as a case rather than assumed: it is what makes the
    // badge suite below a genuinely separate fixture instead of an accident.
    const html = await renderFestival(LOCAL_START);
    expect(html).toContain(DAYS_AWAY_CLASS);
    expect(html).not.toContain(TODAY_BADGE);
  });

  it('makes no timing claim once the festival is over', async () => {
    // Past the end: the label is absent by design, so the WITH-key render must
    // look like the without-key one. Guards against a change that makes the
    // pinned key render something unconditionally.
    const html = await renderFestival('2026-10-01');
    expect(html).toContain(DAYS_AWAY_CLASS);
    expect(html).not.toContain('Happening now');
    expect(html).not.toContain('Today');
    expect(html).not.toMatch(/In \d+ days/);
  });
});

/**
 * The other two sites the same pin unblocks. The hero label was the visible one,
 * but the schedule's day tabs and timeline header carry the SAME clock-derived
 * "is this day today" question, and were gated on `mounted` for the same reason.
 * They now share one predicate with the hero -- these cases are what stops the
 * three drifting apart again.
 */
describe('SSR: festival schedule today badges', { timeout: 20_000 }, () => {
  it('renders both today markers server-side when the loader pins the day', async () => {
    const withKey = await renderFestival('2026-09-05', SCHEDULE);
    const withoutKey = await renderFestival(undefined, SCHEDULE);

    // Non-vacuity: the timeline actually rendered in BOTH, so the difference
    // below is the gate and not one render silently falling back to a skeleton.
    expect(withKey).toContain('day-mobile-tabs');
    expect(withoutKey).toContain('day-mobile-tabs');
    expect(withKey).not.toContain('Festival not found');

    // The timeline header's visible badge, and the mobile tab's class.
    expect(withKey).toContain(TODAY_BADGE);
    expect(withKey).toMatch(TODAY_TAB);
    expect(withoutKey).not.toContain(TODAY_BADGE);
    expect(withoutKey).not.toMatch(TODAY_TAB);
  });

  it('badges only the pinned day, not every day', async () => {
    // Three days are rendered; exactly one may claim to be today. A gate that
    // degraded to `true` would badge all three and still pass the case above.
    const html = await renderFestival('2026-09-05', SCHEDULE);
    expect(html.split(TODAY_BADGE).length - 1).toBe(1);
  });

  it('badges nothing when the pinned day falls outside the festival', async () => {
    // The pin is not itself the trigger -- the day has to match. Without this a
    // change that badged the first tab unconditionally would look correct.
    const html = await renderFestival('2026-10-01', SCHEDULE);
    expect(html).toContain('day-mobile-tabs');
    expect(html).not.toContain(TODAY_BADGE);
    expect(html).not.toMatch(TODAY_TAB);
  });
});

/**
 * THE DAY THE DOCUMENT BADGES IS THE DAY IT OPENS.
 *
 * Both answers come from the SAME pinned key but by different code: the badge
 * is a display (`canRenderClockDerived`, un-gated once a key is pinned), the
 * open tab is a picked index that used to wait for `mounted`. They were free to
 * disagree, and on a mid-run festival they always did -- the server-rendered
 * document badged day 3 and opened day 1, and the tab jumped after hydration.
 *
 * These cases assert the AGREEMENT rather than either half. That distinction is
 * the whole point: every case in the badge suite above passes with the
 * disagreement in place, so none of them could be the gate for this.
 */
describe('SSR: festival schedule default day tab', { timeout: 20_000 }, () => {
  // The grid's columns, derived from the SPAN -- the input festivalGridDays
  // actually reads -- and not from the session list.
  //
  // Deriving these from SCHEDULE was wrong, and wrong in the direction that
  // makes assertions pass against the wrong column. festivalGridDays builds
  // `[...spanDays, ...orphanDays].sort(byDateKey)`, so a session dated OUTSIDE
  // the span is sorted IN, not appended: add one dated 2026-09-01 and every
  // span column shifts by one while `SCHEDULE.map(s => s.day).indexOf(...)`
  // does not move. The two lists coincide here only because this fixture's
  // session days are exactly its span days -- the very coincidence the file
  // header calls out at the top.
  const SPAN_DAYS = (() => {
    const out: string[] = [];
    const last = Date.parse(`${LOCAL_END}T00:00:00Z`);
    for (let t = Date.parse(`${LOCAL_START}T00:00:00Z`); t <= last; t += 86_400_000) {
      out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
  })();

  // ...and the coincidence is now ASSERTED rather than assumed, so the day a
  // fixture gains an out-of-span session this reds here, where the cause is
  // obvious, instead of silently shifting an expected index somewhere below.
  it('has no out-of-span sessions, so span days ARE the grid columns', () => {
    expect(SCHEDULE.every((s) => SPAN_DAYS.includes(s.day))).toBe(true);
  });

  // One button carrying BOTH classes. Asserted as a single match on purpose:
  // two independent toContain calls are satisfied by `active` on one tab and
  // `today` on another, which is exactly the defect.
  const ACTIVE_AND_TODAY = /class="day-tab active[^"]*\btoday\b[^"]*"/;

  /** How many tabs render as the open one. Exactly one may. */
  const activeTabCount = (html: string) => html.split('day-tab active').length - 1;

  /** Which column the timeline opens on: `<div class="tl-body" data-day="N">`. */
  const openDay = (html: string): string | null =>
    html.match(/class="tl-body" data-day="([^"]*)"/)?.[1] ?? null;

  it('opens the schedule on the day it badges as today', async () => {
    const pinned = '2026-09-05';
    const html = await renderFestival(pinned, SCHEDULE);

    // Non-vacuity: the timeline rendered AND the badge is genuinely present, so
    // a red below means the two disagree rather than that nothing rendered.
    expect(html).toContain('day-mobile-tabs');
    expect(html).toContain(TODAY_BADGE);

    expect(html).toMatch(ACTIVE_AND_TODAY);
    expect(openDay(html)).toBe(String(SPAN_DAYS.indexOf(pinned)));

    // CARDINALITY, separately from identity. ACTIVE_AND_TODAY only proves that
    // SOME button carries both classes, and `openDay` reads a different element
    // entirely, so neither notices extra open tabs: `activeDayIdx === i` ->
    // `activeDayIdx >= i` renders three active tabs and was measured green
    // against every other case in this file. Same hole triage finding 8
    // recorded for the mobile today-badge, one class over.
    expect(activeTabCount(html)).toBe(1);
  });

  it('opens day 1 when no key is pinned', async () => {
    // The control that stops a seed which fires unconditionally from passing
    // the case above. With no pin there is nothing to seed from, the mount gate
    // is all there is, and day 1 is the correct server answer.
    const html = await renderFestival(undefined, SCHEDULE);
    expect(html).toContain('day-mobile-tabs');
    expect(openDay(html)).toBe('0');
    // NOT `not.toMatch(ACTIVE_AND_TODAY)`, which was here and could not fail:
    // with no key `canRenderClockDerived` is false, so no button carries
    // `today` at all and the two-class regex cannot match whatever the seed
    // does. It restated the badge gate instead of controlling the seed. The
    // real control is `openDay` above -- and it only bites because the runner's
    // clock sits outside the September fixture, which is why the fake-clock
    // case below exists. This line adds the part openDay cannot see.
    expect(activeTabCount(html)).toBe(1);
  });

  it('never seeds from the machine clock, only from the pin', async () => {
    // KILLS THE MUTANT THAT SEEDS FROM `todayKey` INSTEAD OF `serverTodayKey`.
    // Without a faked clock that mutant is invisible: the runner's real date is
    // never inside the fixture's September span, so a clock-derived seed and a
    // pin-derived seed both land on day 1 and every other case in this file
    // passes either way. Measured before this case existed -- it survived with
    // zero failing assertions.
    //
    // A server that derives the day itself is the React #418 hydration mismatch
    // `canRenderClockDerived` exists to prevent: the pin is there precisely so
    // the server and the client's FIRST render cannot disagree.
    //
    // Only Date is faked. Faking the timer functions as well would put the
    // dynamic imports and the query client on a stopped clock for no benefit.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z')); // mid-run, column 1
    try {
      const html = await renderFestival(undefined, SCHEDULE);
      expect(html).toContain('day-mobile-tabs');
      expect(openDay(html)).toBe('0');
      // Second job, worth having: with the clock inside the fixture span this
      // is the one render in this file where a degraded mount gate could badge
      // a day. The other negative cases cannot see that -- their clock is two
      // weeks short of the fixture, so they would pass with no gate at all.
      expect(html).not.toContain(TODAY_BADGE);
      expect(html).not.toMatch(TODAY_TAB);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens day 1 when the pinned day falls outside the festival', async () => {
    const html = await renderFestival('2026-10-01', SCHEDULE);
    expect(html).toContain('day-mobile-tabs');
    expect(openDay(html)).toBe('0');
  });

  it('badges a session-less span day but still opens day 1', async () => {
    // THE GAP-DAY RULE -- and the one place badge and tab are MEANT to
    // disagree. `days` come from the span, so a rest day is a real column with
    // nothing in it; opening the schedule on a blank column is worse than
    // opening on day 1, so the key is withheld from the PICK while the badge,
    // which is a statement about the calendar and not about content, stays.
    //
    // Stated as a case because it is the constraint most likely to be deleted
    // by someone "simplifying" the seed to just pass the pinned key through.
    const gapSchedule = SCHEDULE.filter((s) => s.day !== '2026-09-05');
    const html = await renderFestival('2026-09-05', gapSchedule);

    expect(html).toContain('day-mobile-tabs');
    expect(html).toContain(TODAY_BADGE);
    expect(openDay(html)).toBe('0');
    expect(html).not.toMatch(ACTIVE_AND_TODAY);
  });
});
