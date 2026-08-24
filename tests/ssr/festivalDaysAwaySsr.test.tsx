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
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router';

// The fixture lives in tests/fixtures/festivalFixture, shared with the CLIENT
// harness (tests/client/festivalClientState). It used to be declared here and
// would have been copied there; the two suites assert opposite halves of this
// component -- what the SERVER emits, and what the CLIENT does after hydration
// -- and a copied fixture drifts silently, because a stale payload shape still
// renders SOMETHING and the copy that stopped matching the parser keeps passing.
import {
  EVENT_UUID,
  LOCAL_START,
  LOCAL_END,
  SCHEDULE,
  seedClient,
  installFixtureFetchGate,
  removeFixtureFetchGate,
} from '../fixtures/festivalFixture';

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

// The mobile day-tab strip, asserted as RENDERED MARKUP rather than as the bare
// class name -- for exactly the reason the TODAY_BADGE note above gives, which
// these cases had copied the trap of rather than the lesson. The component
// inlines its stylesheet, and that stylesheet carries both
// `.cinematic-festival .day-mobile-tabs{...}` and `.day-mobile-tabs[hidden]`, so
// `toContain(TABS_RENDERED)` sat in the HTML of every festival page whether
// or not the strip rendered -- including one where the whole timeline section
// was skipped. It could not fail, which made it a non-vacuity guard that
// guaranteed nothing.
const TABS_RENDERED = 'class="day-mobile-tabs"';

/**
 * The inclusive `YYYY-MM-DD` keys a span covers -- this file's notion of "the
 * days a festival has columns for".
 *
 * ONE definition, because it is an ORACLE and not a convenience: the wide-span
 * case below checks the rendered column COUNT and the open column's INDEX
 * against what this returns. A second copy of the same loop can drift from the
 * first, and the drift would present as the grid being wrong.
 *
 * IT THROWS ON INPUT IT CANNOT READ rather than returning `[]`. An oracle that
 * fails open is worse than none: `Date.parse('2026-9-1T00:00:00Z')` is NaN,
 * `NaN <= NaN` is false, and the empty list would then have the wide-span case
 * assert that the grid emitted ZERO columns and that `openDay` read '-1' --
 * two confusing reds blamed on the grid, for one character in a fixture.
 */
const spanDayKeys = (start: string, end: string): string[] => {
  const first = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    throw new Error(`spanDayKeys: unparseable span bounds ${start}..${end}`);
  }
  if (last < first) throw new Error(`spanDayKeys: end precedes start ${start}..${end}`);

  const out: string[] = [];
  for (let t = first; t <= last; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

// The festival fixture -- SCHEDULE, the dates, the timezone and seedClient --
// is imported from tests/fixtures/festivalFixture, along with the notes on what
// it can and cannot express.
beforeAll(() => installFixtureFetchGate('SSR gate'));
afterAll(removeFixtureFetchGate);

/** Server-render /festival/:id, optionally with the loader's pinned day key. */
async function renderFestival(
  serverTodayKey?: string,
  schedule: unknown[] = [],
  span?: { start: string; end: string },
): Promise<string> {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');
  const client = await seedClient(schedule, span);

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
    expect(withKey).toContain(TABS_RENDERED);
    expect(withoutKey).toContain(TABS_RENDERED);
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
    expect(html).toContain(TABS_RENDERED);
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
  const SPAN_DAYS = spanDayKeys(LOCAL_START, LOCAL_END);

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
    expect(html).toContain(TABS_RENDERED);
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
    expect(html).toContain(TABS_RENDERED);
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
      expect(html).toContain(TABS_RENDERED);
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
    expect(html).toContain(TABS_RENDERED);
    expect(openDay(html)).toBe('0');
  });

  /**
   * The `.tl-body` element, tag-depth-matched out of the served document.
   *
   * BOUNDS THE SCAN, which end-of-document does not. The last row would
   * otherwise run to the foot of the page and absorb the legend, venue,
   * tickets and footer; today that is the WHOLE remainder, because every
   * fixture here renders a single row. It reads correct only because nothing
   * below the timeline happens to emit a `.slot` -- the day one does, the
   * column-count assertion reds pointing at the grid instead of at this
   * helper.
   */
  const tlBody = (html: string): string => {
    const at = html.search(/<div [^>]*class="[^"]*\btl-body\b/);
    if (at === -1) throw new Error('tlBody: the served document has no .tl-body');

    const tagRe = /<div\b|<\/div>/g;
    tagRe.lastIndex = at;
    let depth = 0;
    for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) return html.slice(at, m.index + m[0].length);
    }
    throw new Error('tlBody: unbalanced <div> nesting -- the timeline cannot be bounded');
  };

  /**
   * Per rendered `.tl-row` inside the timeline: how many day cells it has,
   * which 0-based cell carries `data-open` (-1 for none), and HOW MANY do.
   *
   * This reads the SERVED MARKUP because that is where the defect lived. The
   * single-day view works by HIDING, so the pairing of open column to open cell
   * is the whole contract: get it wrong and the page silently shows the
   * NEIGHBOURING day, which no assertion on `data-day` alone can tell from the
   * right one.
   *
   * `opens` IS SEPARATE FROM `open`, for the reason `activeTabCount` exists one
   * element over: `open` records the LAST matching cell, so identity alone
   * cannot see EXTRA open columns. Measured, not reasoned -- mutating the stamp
   * to `dayIdx <= activeDayIdx` opens EIGHT of fourteen columns on a 375px
   * viewport, and every case in this file stayed green, because `open` still
   * read 7 and `count` still read 14. Cardinality has to be counted.
   *
   * Both anchors match the class within the attribute run rather than requiring
   * `class="..."` to be the exact and first attribute: a `cn()` refactor or a
   * reordered attribute would otherwise report every row as ZERO cells, reding
   * as "the grid stopped emitting columns" when the grid is fine.
   */
  const rowSlots = (html: string): Array<{ count: number; open: number; opens: number }> => {
    const body = tlBody(html);

    const starts: number[] = [];
    const rowRe = /<div [^>]*class="[^"]*\btl-row\b/g;
    for (let m = rowRe.exec(body); m; m = rowRe.exec(body)) starts.push(m.index);

    return starts.map((start, i) => {
      const chunk = body.slice(start, starts[i + 1] ?? body.length);
      const slotRe = /<div [^>]*class="[^"]*\bslot\b([^>]*)>/g;
      let count = 0;
      let open = -1;
      let opens = 0;
      for (let m = slotRe.exec(chunk); m; m = slotRe.exec(chunk)) {
        // ATTRIBUTE BOUNDARY, not a substring. A bare
        // `m[0].includes('data-open')` counts any attribute whose NAME OR VALUE
        // merely contains the text -- add `data-open-hour={hour}` to the cell
        // and all 14 columns report open, reding the cardinality assertion
        // below against the stamp when the stamp is fine.
        if (/\sdata-open(=|\s|>)/.test(m[0])) {
          open = count;
          opens += 1;
        }
        count += 1;
      }
      return { count, open, opens };
    });
  };

  /**
   * Every `@media (max-width:900px){...}` block of the inlined stylesheet,
   * brace-matched out of the served document and joined.
   *
   * Needed because "the rule is in the HTML" is NOT the property under test.
   * Hoisted out of the mobile block these rules hide every column but one on
   * DESKTOP too -- a worse regression than the one they fix, and one that a
   * `toContain` on the whole document cannot see.
   */
  const mobileCss = (html: string): string => {
    const OPEN = '@media (max-width:900px){';
    const blocks: string[] = [];
    for (let at = html.indexOf(OPEN); at !== -1; at = html.indexOf(OPEN, at + 1)) {
      let depth = 0;
      let i = at + OPEN.length - 1;
      for (; i < html.length; i += 1) {
        if (html[i] === '{') depth += 1;
        else if (html[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      // RECORD THE FAILURE rather than slicing to end-of-input. The loop can
      // also exit by exhausting the string, and `html.slice(at, html.length+1)`
      // is then everything from the first mobile block to the foot of the page
      // -- which makes the "only inside the mobile media block" half of this
      // gate a TAUTOLOGY: the rules satisfy `toContain` wherever they live,
      // including hoisted onto DESKTOP, and `not.toBe('')` still passes. One
      // stray brace is enough, and CSS permits them inside strings -- this
      // sheet already ships `content:'\a3 '` and `content:''`.
      if (depth !== 0) throw new Error('mobileCss: unbalanced braces -- the media block cannot be bounded');

      blocks.push(html.slice(at, i + 1));
    }
    return blocks.join('|');
  };

  const HIDE_CLOSED_SLOTS =
    '.cinematic-festival .tl-body:not([data-day="all"]) .tl-row > .slot:not([data-open]){display:none}';
  const HIDE_EMPTY_ROWS =
    '.cinematic-festival .tl-body:not([data-day="all"]) .tl-row:not(:has(> .slot[data-open] > .session)){display:none}';

  it('ships both single-day rules, and only inside the mobile media block', async () => {
    // THE CONSUMER HALF. A generator or a constant proven in isolation says
    // nothing about whether the page uses it: the rules these replaced were
    // themselves correct CSS, and the page still fell apart, because nothing
    // tied them to what it rendered. Delete either rule and this reds; hoist
    // either out of the media block and this reds.
    const html = await renderFestival('2026-09-05', SCHEDULE);
    const mobile = mobileCss(html);
    expect(mobile).not.toBe('');

    for (const rule of [HIDE_CLOSED_SLOTS, HIDE_EMPTY_ROWS]) {
      // Exactly once in the document, and that once is inside a mobile block.
      expect(html.split(rule).length - 1).toBe(1);
      expect(mobile).toContain(rule);
    }
  });

  it('opens exactly one column per row on a 14-day span, with no fallback', async () => {
    // COUNT INDEPENDENCE, which is the point of stamping `data-open` on the
    // cell rather than counting child positions from the ancestor.
    //
    // This is the case the three-day fixture could never express -- it only
    // ever emits columns 0..2, which is how a four-column ceiling survived
    // review. The span is a parameter so the column count can exceed anything
    // a hand-written rule list would have covered.
    const start = '2026-09-01';
    const end = '2026-09-14';
    const pinned = '2026-09-08';

    const wideSpan = spanDayKeys(start, end);

    // TWO DISTINCT HOURS, and the later one deliberately ABSENT from the pinned
    // day. `hours` is the set of distinct wall-clock start hours, so a fixture
    // whose sessions all start at 20:00 renders exactly ONE row -- which is
    // what this case shipped with. Every `new Set(rows.map(...))` below was
    // then a set of ONE element, and "per row" was a claim about n=1: a defect
    // that stamped the first row correctly and the rest wrongly was invisible.
    // The 22:00 row also gives the empty-row rule something real to act on,
    // since it has no session in the open column.
    const wideSchedule = [
      { day: start, hour: '20:00:00' },
      { day: pinned, hour: '20:00:00' },
      { day: end, hour: '20:00:00' },
      { day: start, hour: '22:00:00' },
      { day: end, hour: '22:00:00' },
    ].map((s, i) => ({
      id: `wide-${i}`,
      day: s.day,
      title: `Session ${i}`,
      start_time: s.hour,
      type: 'class',
    }));

    const html = await renderFestival(pinned, wideSchedule, { start, end });
    expect(html).toContain(TABS_RENDERED);

    // Still the SINGLE-DAY view. No ceiling to trip, so nothing forces the
    // all-days grid on a reader who did not ask for it.
    expect(openDay(html)).toBe(String(wideSpan.indexOf(pinned)));

    const rows = rowSlots(html);

    // Non-vacuity, PINNED rather than floored: one row per distinct hour, so
    // there are genuinely several rows for the per-row assertions to range
    // over. `toBeGreaterThan(0)` was satisfied by the single row this fixture
    // used to render, which is exactly how a claim about n=1 read as a claim
    // about every row.
    expect(rows.length).toBe(2);

    // Non-vacuity: the grid really did emit 14 columns, so a 3-column render
    // cannot satisfy the pairing assertion below by accident.
    expect(new Set(rows.map((r) => r.count))).toEqual(new Set([wideSpan.length]));

    // THE PAIRING, identity. Every row opens the column the timeline says is
    // open -- drop `data-open` from the cell and every row reads -1; shift it
    // by one and every row reads the neighbour.
    expect(new Set(rows.map((r) => r.open))).toEqual(new Set([wideSpan.indexOf(pinned)]));

    // THE PAIRING, CARDINALITY -- the half identity cannot express, and the
    // half this case's own title claims ("exactly one"). `open` holds the LAST
    // open cell, so a stamp that opens columns 0..7 leaves it at 7 and agrees
    // with the assertion above while rendering eight columns at once on a
    // 375px viewport. Verified against that mutant: green before, red now.
    expect(new Set(rows.map((r) => r.opens))).toEqual(new Set([1]));
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

    expect(html).toContain(TABS_RENDERED);
    expect(html).toContain(TODAY_BADGE);
    expect(openDay(html)).toBe('0');
    expect(html).not.toMatch(ACTIVE_AND_TODAY);
  });
});
