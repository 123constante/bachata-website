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
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
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
  SCHEDULE_WITH_UNDATED,
  seedClient,
  IDS_A,
  installFixtureFetchGate,
  removeFixtureFetchGate,
  OUTSIDE_THE_SPAN,
} from '../fixtures/festivalFixture';

const DAYS_AWAY_CLASS = 'hero-days-away';

// The schedule's visible "today" marker, asserted as RENDERED MARKUP rather than
// as the bare class name. The component inlines its stylesheet into the document,
// so the string `day-tab-today` is in the HTML of every festival page whether or
// not a badge rendered -- a `toContain('day-tab-today')` would be green against a
// completely broken gate. The `<span ...>` form only exists if the element did.
//
// RE-ANCHORED, and honestly: this used to read `tl-day-today` on the timeline's
// own day-header row. That row is gone -- the columns are rooms now, so there is
// no per-day header to badge -- and the day chip is the only place the schedule
// says "today". So this and TODAY_TAB below now read the SAME element by two
// different channels (the rendered pill, and the class list) rather than two
// elements. That is a real reduction in redundancy and is recorded as one; the
// property under test, "the schedule marks today in the SERVED document", is
// unchanged. The two channels DO fail independently, but only because TODAY_TAB
// was tightened -- as first written it was satisfied by this very string, so the
// pair was one assertion wearing two names. See the note on TODAY_TAB below.
const TODAY_BADGE = '<span class="day-tab-today">Today</span>';

// The day chip's CLASS LIST, as opposed to the rendered pill above. Anchored to
// `class="day-tab` so the stylesheet's own rules cannot satisfy it either.
//
// THE TRAILING SPACE IS LOAD-BEARING. Without it this regex is satisfied by
// `class="day-tab-today"` -- the pill's own class -- because `[^"]*` eats the
// hyphen and `\btoday\b` then matches. TODAY_BADGE contains that exact string,
// so every `toContain(TODAY_BADGE)` guaranteed the paired `toMatch(TODAY_TAB)`
// and the two "independent channels" were one channel asserted twice. The chip
// always renders `class="day-tab ` followed by its state classes, so requiring
// the space separates the two for real.
const TODAY_TAB = /class="day-tab [^"]*\btoday\b[^"]*"/;

// The day-picker strip, asserted as RENDERED MARKUP rather than as the bare
// class name -- for exactly the reason the TODAY_BADGE note above gives, which
// these cases had copied the trap of rather than the lesson. The component
// inlines its stylesheet, and that stylesheet carries `.cinematic-festival
// .day-picker{...}`, so a `toContain('day-picker')` would sit in the HTML of
// every festival page whether or not the strip rendered -- including one where
// the whole timeline section was skipped. It could not fail, which would make
// it a non-vacuity guard that guaranteed nothing. The `class="..."` form can.
//
// RENAMED from `day-mobile-tabs`, deliberately rather than for tidiness: the
// strip is no longer a mobile affordance with a desktop counterpart, it is the
// only day navigation at every width, and a class still calling itself "mobile"
// would send the next reader looking for the other one.
const TABS_RENDERED = 'class="day-picker"';

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
beforeAll(() => {
  installFixtureFetchGate('SSR gate');
  // THE CLOCK IS PINNED, and it is a defect fix rather than hygiene. Every
  // negative in this file -- every `not.toContain` on a today marker, and every
  // `openDay(html)).toBe('0')` with no key pinned -- was satisfied by the real
  // wall-clock date happening to fall outside the fixture's 2026-09-04..06
  // span. That is a COINCIDENCE, not a design, and it expires: on 5 and 6
  // September the seed resolves a different column and cases red against
  // correct code. The client twin was pinned on 2026-08-24 and this one was
  // left, which is the whole reason it is being done now.
  //
  // Only Date is faked. Faking the timer functions as well would put the
  // dynamic imports and the query client on a stopped clock for no benefit.
  vi.useFakeTimers({ toFake: ['Date'] });
});

// Re-pinned per case, so the one case that deliberately MOVES the clock cannot
// leak its date into the next.
beforeEach(() => {
  vi.setSystemTime(OUTSIDE_THE_SPAN);
});

afterAll(() => {
  removeFixtureFetchGate();
  vi.useRealTimers();
});

/** Server-render /festival/:id, optionally with the loader's pinned day key. */
async function renderFestival(
  serverTodayKey?: string,
  schedule: unknown[] = [],
  span?: { start: string; end: string },
): Promise<string> {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');
  // IDS_A explicitly: seedClient no longer defaults its `ids`, because omitting
  // it silently meant "festival A" even at call sites showing another festival.
  const client = await seedClient(schedule, span, IDS_A);

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
    // The file already runs on a fake Date pinned OUTSIDE the span; this case
    // moves it INSIDE, which is the only arrangement that tells a clock-derived
    // seed from a pin-derived one apart.
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
      // RE-PIN, never useRealTimers(). Tearing the fake clock down here would
      // leave the file's own beforeEach re-pinning a clock that no longer
      // exists, and the cases after this one would silently go back to running
      // against the machine date -- reinstating exactly the time bomb the pin
      // was added to remove, in the one place nobody would look for it.
      vi.setSystemTime(OUTSIDE_THE_SPAN);
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
   * BOUNDS THE SCAN, which end-of-document does not. Every reader below
   * (`daySessions`, `hourRows`, `metaTexts`) matches on class names that are
   * not unique to the timetable, so an unbounded scan would absorb the legend,
   * venue, tickets and footer and answer about the whole page. Depth-matching
   * `<div>`/`</div>` from `.tl-body` ends the scan at its own closing tag, so
   * what those readers see is the grid and nothing else.
   *
   * The three justifications this note used to carry -- a single-row fixture,
   * `.slot` appearing nowhere below the timeline, and a column-count assertion
   * -- all named things the rooms-across rebuild deleted.
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
   * Every session card the served timeline rendered, with the day index each
   * one is stamped with.
   *
   * THIS REPLACES A ROW/SLOT READER, and the replacement is the shape change
   * rather than a rewording of it. The grid used to render EVERY day as a
   * column and hide all but one with CSS, so the only thing observable was
   * which column was un-hidden -- what was IN the open column could not be
   * wrong, because all of it was always there. Rooms are the columns now and
   * only the open day is built, so "the reader is looking at the wrong day"
   * became a fact about CONTENT, and that is what this reads.
   *
   * Cardinality is kept separate from identity for the reason the old reader
   * kept `opens` apart from `open`: a set of day indices proves they AGREE, and
   * a count proves how many cards there are, and neither implies the other. A
   * grid that rendered the open day's sessions PLUS a neighbour's satisfies the
   * first assertion the moment the sets are compared loosely.
   *
   * Both anchors match the class within the attribute run rather than requiring
   * `class="..."` to be the exact and first attribute: a `cn()` refactor or a
   * reordered attribute would otherwise report ZERO cards, reding as "the grid
   * stopped emitting sessions" when the grid is fine.
   */
  const daySessions = (
    html: string,
  ): Array<{ day: string | null; label: string | null; column: number | null }> => {
    const body = tlBody(html);
    const starts: number[] = [];
    const attrs: string[] = [];
    const evRe = /<div [^>]*class="[^"]*\btl-ev\b[^"]*"([^>]*)>/g;
    for (let m = evRe.exec(body); m; m = evRe.exec(body)) {
      starts.push(m.index);
      attrs.push(m[1]);
    }
    return starts.map((start, i) => ({
      day: attrs[i].match(/\sdata-day="([^"]*)"/)?.[1] ?? null,
      // THE GRID COLUMN THE CARD WAS PLACED IN, read off its own inline style.
      //
      // Nothing asserted this until now, and the gap was measured rather than
      // suspected: `column: roomStartColumn[gi] + lane` mutated to `+ lane + 1`
      // -- which moves EVERY card on EVERY fixture one column right -- survived
      // the whole suite. `sessionColumns` pins how many tracks exist and the
      // labels pin what is on the cards; between them sat the headline feature
      // of this grid, rooms across with lanes inside them, ungated.
      //
      // Read as a NUMBER and only as a number. The card is placed on a single
      // track (`gridColumn: cell.column + 2`), while every other element in
      // this grid that carries the property spans one (`2 / -1` on the row
      // rule, `1 / -1` on a gap, `N / span L` on a room heading). Anything but
      // a bare integer here means the card stopped being a single-track element
      // and the pairing below is answering about a shape it was not written
      // for, so it reports `null` and the assertion fails rather than coercing
      // `"2 / -1"` to 2 and passing.
      column: (() => {
        // TOLERANT ON EVERY SERIALIZATION AXIS, and the same ones `roomHeadings`
        // tolerates -- the two readers parse the SAME declaration and a
        // difference between them is a difference in what reds the gate, not a
        // difference in what the grid did.
        //
        // `[;"]` and not `;`: the declaration is second in the style attribute
        // today, and anchoring on the separator alone would report `null` for
        // every card the day something reorders it. `\s*` for the same reason
        // one axis along: `grid-column: 3` with a single space is a legal
        // emission, and an untolerated space would red three cases as
        // `expected [] to deeply equal ['Room A']` -- misattribution on a
        // public page -- for a character nobody can see.
        const raw = attrs[i].match(/[;"]grid-column:\s*([^;"]*)/)?.[1]?.trim();
        return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
      })(),
      // The card's accessible name, which is also the only text a session
      // contributes to the document in DOM order -- the visual block beside it
      // is aria-hidden. Reading it here is what lets a case assert ORDER.
      label:
        body
          .slice(start, starts[i + 1] ?? body.length)
          .match(/<span class="sr-only">([^<]*)<\/span>/)?.[1] ?? null,
    }));
  };

  /**
   * The VISIBLE meta line of each session card, bounded to its own element.
   *
   * Bounded deliberately: a `[\s\S]{0,240}?` scan from the opening tag crosses
   * `</span>` and runs into the NEXT card's accessible name, so it matched text
   * the meta line does not contain -- measured, by a mutant that deleted the
   * meta line's type and stayed green. React's `<!-- -->` text separators are
   * stripped so the result reads as the sentence a person sees.
   */
  const metaTexts = (html: string): string[] => {
    const body = tlBody(html);
    const out: string[] = [];
    const openRe = /<span class="tl-ev-meta">/g;
    for (let m = openRe.exec(body); m; m = openRe.exec(body)) {
      const rest = body.slice(m.index + m[0].length);
      const close = rest.indexOf('</span>');
      out.push((close === -1 ? rest : rest.slice(0, close)).replace(/<!-- -->/g, ''));
    }
    return out;
  };

  /**
   * How many SESSION columns (lanes) `.tl-grid` declares, read off the grid's
   * own track list rather than off prose.
   *
   * The two cases below used to assert `'2 columns'` against `.tl-note`, which
   * is `aria-hidden` decorative copy -- rewording it, or dropping it on a
   * viewport where nothing scrolls, red an assertion about greedy interval
   * partitioning for no defect. `grid-template-columns` IS the answer: the
   * leading `var(--tl-tgw)` is the time gutter, `repeat(N, ...)` the sessions.
   */
  const sessionColumns = (html: string): number => {
    const m = tlBody(html).match(/grid-template-columns:\s*var\(--tl-tgw\)\s*repeat\((\d+),/);
    if (!m) throw new Error('sessionColumns: .tl-grid declared no repeat() track list');
    return Number(m[1]);
  };

  /**
   * The ROOM HEADINGS of the open day, each with the track range it claims.
   *
   * The other half of a card's position. `sessionColumns` counts tracks and the
   * reader above says which track a card sits on, and neither can say whether
   * the card landed under the RIGHT heading -- which is the only form the
   * defect takes on a public page. A session shown under "Room B" when the
   * organiser published it in Room A is not a layout wobble, it is the page
   * stating a wrong fact about a real event, and it is what the shift-by-one
   * mutant does on the mixed fixture.
   *
   * Read in the SERVED coordinate system, 1-based with the time gutter at
   * column 1, because that is the one the browser resolves. Re-deriving the
   * `+ 2` offset here would put a copy of the layout's own arithmetic in the
   * gate, and the two would agree by construction the moment either moved.
   */
  const roomHeadings = (
    html: string,
  ): Array<{ name: string; start: number; span: number; count: string }> => {
    const body = tlBody(html);
    const starts: number[] = [];
    const attrs: string[] = [];
    // `<div ` anchored: `tl-room-name` and `tl-room-count` also satisfy
    // `\btl-room\b` (the boundary sits before the hyphen), and they are the
    // heading's own children -- matching them would report three headings for
    // every one rendered and quietly make the pairing below ambiguous.
    const roomRe = /<div [^>]*class="[^"]*\btl-room\b[^"]*"([^>]*)>/g;
    for (let m = roomRe.exec(body); m; m = roomRe.exec(body)) {
      starts.push(m.index);
      attrs.push(m[1]);
    }
    return starts.map((start, i) => {
      const range = attrs[i].match(/[;"]grid-column:\s*(\d+)\s*\/\s*span\s*(\d+)/);
      if (!range) {
        throw new Error(`roomHeadings: heading ${i} declared no "N / span L" column range`);
      }
      // Both children matched WITHIN the attribute run, for the reason
      // `daySessions` gives 120 lines above: requiring `class="..."` to be the
      // exact and only attribute means a `cn()` wrapper or an added `title`
      // turns this into a hard throw -- "heading 0 rendered no name" -- while
      // the grid is perfectly correct. This reader throws rather than
      // returning null, so an intolerant anchor here is the more expensive
      // mistake, not the cheaper one.
      const own = body.slice(start, starts[i + 1] ?? body.length);
      // Class matched as a WHOLE TOKEN out of the split attribute, not as a
      // word-boundary pattern in a built RegExp. Two reasons, one of which bit:
      // a `\b`-style boundary in a template literal is a BACKSPACE character
      // rather than a boundary unless the backslash survives every transport
      // between here and the file, and it did not -- three cases red with
      // "heading 0 rendered no name" against a grid that was perfectly correct.
      // Token equality also refuses `tl-room-name-suffix`, which a boundary
      // pattern would have accepted.
      const childText = (cls: string): string | undefined => {
        const spanRe = /<span ([^>]*)>([^<]*)<\/span>/g;
        for (let m = spanRe.exec(own); m; m = spanRe.exec(own)) {
          const classes = m[1].match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
          if (classes.includes(cls)) return m[2];
        }
        return undefined;
      };

      const name = childText('tl-room-name');
      if (name === undefined) throw new Error(`roomHeadings: heading ${i} rendered no name`);

      // THE SESSION COUNT, kept rather than parsed away. `count: g.placed.length`
      // mutated to `count: 1` survived the whole file: every heading on a live
      // festival then reads "1 session" over three cards, which is the same
      // class of wrong-fact-on-a-public-page the column pairing exists to close.
      // Held as the rendered STRING so the singular/plural fold is asserted too
      // -- "1 sessions" is visible copy, and a number would throw it away.
      const count = childText('tl-room-count');
      if (count === undefined) throw new Error(`roomHeadings: heading ${i} rendered no count`);

      return { name, start: Number(range[1]), span: Number(range[2]), count };
    });
  };

  /**
   * The headings whose track range covers `column` -- the pairing itself.
   *
   * A LIST rather than a first-hit lookup, so that NO heading covering the
   * column (the card is off the end of the room strip -- what shifting every
   * card one track right does to the last room) and MORE THAN ONE covering it
   * (overlapping headings, two rooms claiming one track) are both expressible
   * in one `toEqual([name])`.
   *
   * THE OVERLAP HALF IS CURRENTLY UNREACHABLE, and saying so is the point: a
   * review measured it. Six of the call sites render one room, which cannot
   * overlap, and both multi-room cases pin `expect(rooms).toEqual([...])`
   * BEFORE any pairing runs -- so every mutant that overlaps two rooms reds at
   * the absolute anchor first. Verified on `roomStartColumn[gi] = gi`, the
   * mutant the collision case names: it reds three assertions earlier. The list
   * form costs nothing and is the honest shape, but a first-hit lookup would be
   * indistinguishable across the whole suite today. Do not quote it as covered.
   */
  const headingsOver = (
    rooms: Array<{ name: string; start: number; span: number }>,
    column: number | null,
  ): string[] => {
    // AN UNREADABLE COLUMN IS NOT A MISPLACED ONE. Returning `[]` here would
    // merge a parser failure into the value that already means "no heading
    // covers this card", and the two send a reader to opposite files: `[]` from
    // a real defect points at `roomStartColumn`, `[]` from a failed match
    // points at the `grid-column` reader 100 lines above. Same red, same
    // message, two hours apart.
    if (column === null) {
      throw new Error('headingsOver: the card declared no readable grid-column');
    }
    return rooms.filter((r) => column >= r.start && column < r.start + r.span).map((r) => r.name);
  };

  /** One named card's column, for the cases that pair sessions by title. */
  const columnOf = (
    cards: Array<{ label: string | null; column: number | null }>,
    title: string,
  ): number | null => cards.find((c) => c.label?.split(',')[0] === title)?.column ?? null;


  /** How many hour rows the open day rendered -- one per hour it occupies. */
  const hourRows = (html: string): number =>
    tlBody(html).split(/<div [^>]*class="[^"]*\btl-hour\b/).length - 1;

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

  /**
   * The trapped-box rule -- a fixed height plus `overscroll-behavior:none` --
   * which is what stops the timetable from scrolling the PAGE underneath it
   * once the reader reaches an edge, on either axis.
   *
   * IT REPLACES THE TWO HIDE RULES, which no longer exist. Those were the
   * single-day view: every day was rendered as a column and all but one hidden
   * on mobile, so the stylesheet carried the whole burden of showing the right
   * day. Nothing is hidden now -- only the open day is built -- so the rule
   * worth gating is the one that still has a mobile-only job.
   *
   * The "and only inside the mobile media block" half carries over unchanged in
   * meaning: hoisted to every width, this pins the box to 360px on DESKTOP,
   * where the design is that it opens out to full height. That is a worse
   * regression than the one it fixes and a `toContain` over the whole document
   * cannot see it.
   */
  const TRAPPED_BOX =
    '.cinematic-festival .tl-box{height:var(--tl-boxh);overscroll-behavior:none;-webkit-overflow-scrolling:touch}';

  it('ships the trapped-box rule, and only inside the mobile media block', async () => {
    // THE CONSUMER HALF. A rule proven in isolation says nothing about whether
    // the page uses it: the rules this replaced were themselves correct CSS,
    // and the page still fell apart, because nothing tied them to what it
    // rendered. Delete the rule and this reds; hoist it out of the media block
    // and this reds.
    const html = await renderFestival('2026-09-05', SCHEDULE);
    const mobile = mobileCss(html);
    expect(mobile).not.toBe('');

    // Exactly once in the document, and that once is inside a mobile block.
    expect(html.split(TRAPPED_BOX).length - 1).toBe(1);
    expect(mobile).toContain(TRAPPED_BOX);

    // THE OTHER EDGE, which the rule alone cannot state: the box has to be a
    // scroll container at EVERY width, or trapping its overscroll on mobile
    // traps nothing and the desktop overflow silently clips instead. This
    // declaration lives outside the media block, so it must NOT be in `mobile`.
    const BASE_BOX = '.cinematic-festival .tl-box{position:relative;overflow:auto;';
    expect(html.split(BASE_BOX).length - 1).toBe(1);
    expect(mobile).not.toContain(BASE_BOX);

    // THE KEYBOARD REACHES THE SCROLLER, not the panel around it. `tabIndex`
    // lived on `.tl-body`, which has no overflow, so Tab put a focus ring on an
    // element that does not scroll and the arrow keys moved the PAGE instead --
    // leaving everything past the fourth row unreachable on mobile in browsers
    // that do not auto-focus scroll regions.
    expect(html).toMatch(/<div class="tl-box" tabindex="0"/i);
    expect(html).not.toMatch(/class="tl-body"[^>]*tabindex/i);

    // And the focus ring follows it, or the focused element is invisible.
    expect(html).toContain('.cinematic-festival .tl-box:focus-visible{');
  });

  it('separates the day chip\'s date from its session count', async () => {
    // Without the separator the chip renders "Friday 4 3" -- date then count,
    // two unlabelled numbers running together -- and "Friday 4 4" on a day whose
    // count matches its date, which cannot be read at all.
    // The `<!-- -->` is React's own text separator between a static string and
    // an interpolated one under renderToString -- not markup this page writes.
    const html = await renderFestival(LOCAL_START, SCHEDULE);
    // \u00b7, never a pasted middle dot: CLAUDE.md forbids raw Unicode
    // punctuation in source, because the cp1252 round-trip over this mount
    // mangles the byte -- and the regex would then stop matching and red the
    // suite pointing at the day-tab separator rather than at the corruption.
    // The component renders it the same way, for the same reason.
    expect(html).toMatch(/<span class="day-tab-count"[^>]*>\u00b7\s*(<!-- -->)?\s*\d+<\/span>/);
  });

  it('renders only the open day on a 14-day span, with no fallback', async () => {
    // COUNT INDEPENDENCE. The old grid put every day on screen as a column and
    // hid all but one, so the number of days was a number the STYLESHEET had to
    // know -- which is how a four-column ceiling survived review against a
    // three-day fixture. Days reach the grid through one index now, so the span
    // is a parameter here to prove that nothing downstream counts.
    const start = '2026-09-01';
    const end = '2026-09-14';
    const pinned = '2026-09-08';

    const wideSpan = spanDayKeys(start, end);

    // TWO SESSIONS ON THE PINNED DAY, at DIFFERENT hours, and four on other
    // days. The two hours are what make the per-card assertions below a claim
    // about n>1 rather than about n=1: a defect that placed the first card
    // correctly and the rest wrongly would otherwise be invisible, which is
    // exactly what this case shipped with when the fixture pinned every session
    // to 20:00. The four elsewhere are what make "only the open day" mean
    // something -- there is real content to wrongly include.
    const wideSchedule = [
      { day: start, hour: '20:00:00' },
      { day: pinned, hour: '20:00:00' },
      { day: end, hour: '20:00:00' },
      { day: start, hour: '22:00:00' },
      { day: end, hour: '22:00:00' },
      { day: pinned, hour: '22:00:00' },
    ].map((s, i) => ({
      id: `wide-${i}`,
      day: s.day,
      title: `Session ${i}`,
      start_time: s.hour,
      type: 'class',
    }));

    const html = await renderFestival(pinned, wideSchedule, { start, end });
    expect(html).toContain(TABS_RENDERED);

    const openIdx = wideSpan.indexOf(pinned);
    expect(openDay(html)).toBe(String(openIdx));

    // Non-vacuity: the picker really did emit all 14 days, so the assertions
    // below cannot be satisfied by a page that rendered a three-day strip.
    //
    // TWO ANCHORS, and the class one carries its trailing SPACE deliberately.
    // The chip's children are `day-tab-wd`, `day-tab-num`, `day-tab-count` and
    // `day-tab-today`, so a bare `class="day-tab` prefix counts them all: it
    // read 57 against a 14-day strip, and would have read a plausible-looking
    // number against a broken one. `role="tab"` is exact -- `role="tablist"`
    // does not contain it, because of the closing quote -- and it is worth
    // asserting in its own right, since the chips carried an `aria-selected`
    // with no role at all before this design.
    expect(html.split('class="day-tab ').length - 1).toBe(wideSpan.length);
    expect(html.split('role="tab"').length - 1).toBe(wideSpan.length);
    expect(activeTabCount(html)).toBe(1);

    const cards = daySessions(html);

    // THE PAIRING, identity. Every card on screen belongs to the day the
    // timeline says is open -- an off-by-one in the day lookup shows the
    // NEIGHBOUR's sessions, which no assertion on `data-day` alone can tell
    // apart from the right ones.
    expect(new Set(cards.map((c) => c.day))).toEqual(new Set([String(openIdx)]));

    // THE PAIRING, CARDINALITY -- the half identity cannot express, and the
    // half the title claims. A grid that rendered the open day's two sessions
    // PLUS the other four still satisfies the set assertion above whenever the
    // extras carry the open day's own stamp, and a grid that dropped one
    // satisfies it too. Six sessions are supplied; exactly two may render.
    expect(cards).toHaveLength(2);

    // ...and the rows follow the sessions, not the span. One row per occupied
    // hour of the OPEN day -- two here, out of the two the whole fixture uses.
    // A grid that laid out fourteen days' hours would still read 2 only by
    // coincidence, so this is stated rather than assumed.
    expect(hourRows(html)).toBe(2);

    // VISUAL ORDER, which is an ARIA contract and not a tidy-up. Position on
    // this grid lives in CSS coordinates, so DOM order is free to disagree with
    // what the eye sees -- and DOM order is what a screen reader and a keyboard
    // walk follow. The layout sorts by row then column to make them agree.
    //
    // ASSERTED because the source comment claiming it was, for a while, the
    // only thing that did: replacing the sort with `cells.reverse()` survived
    // every case here with zero failing assertions. This is the pinned day's
    // 20:00 session (Session 1) before its 22:00 one (Session 5); it needs two
    // cards on one day to mean anything, which is why the fixture has them.
    expect(cards.map((c) => c.label?.split(',')[0])).toEqual(['Session 1', 'Session 5']);

    // THE SINGLE-ROOM SHAPE, which is what production actually serves: the
    // shared fixture publishes no rooms at all, so this renders the one-column
    // 'All sessions' grid Tunisia Bachata Festival ships (14 items, no rooms).
    // Every hand-paired case in this file is a synthetic multi-room day, so
    // without this the most-served geometry is the one nobody pairs.
    expect(sessionColumns(html)).toBe(1);
    expect(roomHeadings(html)).toEqual([
      { name: 'All sessions', start: 2, span: 1, count: '2 sessions' },
    ]);
  });

  /**
   * The fold-round cases. Each one exists because a reviewer found the defect
   * in code that had already passed a mutation pass and a browser check --
   * these are the fixes, and fixes are unreviewed code.
   */
  it('gives abutting sessions in one room separate columns, not the same cell', async () => {
    // 20:00-20:30 and 20:30-21:00 do not overlap in MINUTES, so a minute-based
    // lane assignment put both in lane 0 -- and both then floor into hour row
    // 20, so both got identical grid coordinates. CSS Grid stacks those and
    // `align-self:stretch` makes the later card cover the earlier one whole: a
    // session gone from a public page with nothing to see.
    const day = LOCAL_START;
    const abutting = [
      { id: 'ab-0', day, title: 'First half', start_time: '20:00:00', end_time: '20:30:00', type: 'class', venue_room: 'Room A' },
      { id: 'ab-1', day, title: 'Second half', start_time: '20:30:00', end_time: '21:00:00', type: 'class', venue_room: 'Room A' },
    ];
    const html = await renderFestival(day, abutting, { start: day, end: day });

    const cards = daySessions(html);
    expect(cards.map((c) => c.label?.split(',')[0])).toEqual(['First half', 'Second half']);

    // THE ASSERTION THAT BITES: two lanes, so two session tracks. One track
    // means they share a cell, which is the defect however many cards rendered.
    expect(sessionColumns(html)).toBe(2);

    // ...and the CARDS actually go in them. Two tracks existing is not two
    // tracks used: `column: roomStartColumn[gi] + lane` mutated to drop `lane`
    // still declares `repeat(2,` off `group.lanes`, puts both cards on track 2,
    // and stacks the second over the first exactly as the defect above did --
    // measured, and green across the whole file before this line.
    const cols = cards.map((c) => c.column);
    expect(new Set(cols).size).toBe(2);

    // BOTH TRACKS ARE ROOM A'S, and the heading is pinned in absolute grid
    // coordinates before the pairing is read. Without the absolute anchor the
    // pairing is satisfied by any layout that shifts the heading and the cards
    // TOGETHER, which is a real edit (`roomStartColumn` is one expression) --
    // so the two assertions cover the two sides, and neither implies the other.
    //
    // Track 1 is the time gutter, so one room over two lanes is "2 / span 2".
    const rooms = roomHeadings(html);
    expect(rooms).toEqual([{ name: 'Room A', start: 2, span: 2, count: '2 sessions' }]);
    expect(cols.map((c) => headingsOver(rooms, c))).toEqual([['Room A'], ['Room A']]);
  });

  it('bounds a start-after-end typo to one hour instead of the whole day', async () => {
    // 10:00 -> 09:00 wraps to a 23-hour span, which claims 23 hour rows and
    // renders one card over the entire day. The clamp that was supposed to stop
    // this was `Math.min(end, start + 1440)` -- unreachable in both branches, so
    // it read as a bound while being dead code.
    const day = LOCAL_START;
    const typo = [
      { id: 'ty-0', day, title: 'Typo session', start_time: '10:00:00', end_time: '09:00:00', type: 'class' },
    ];
    const html = await renderFestival(day, typo, { start: day, end: day });

    expect(daySessions(html)).toHaveLength(1);
    // One occupied hour, so one row. A 23-hour read renders 23.
    expect(hourRows(html)).toBe(1);
  });

  it('sorts an early-morning session after the evening it follows', async () => {
    // The programme day runs 09:00 -> 08:59, which is the axis
    // programDayRollover already puts the DATA on. Read raw, a 01:00 session
    // sorts to hour 1 -- above a 23:00 party -- and the grid renders 01:00
    // first, then "21 hours free", then 23:00, then rows labelled 00:00 and
    // 01:00 from the party's wrap. Two rows with the same clock label.
    const day = LOCAL_START;
    const overnight = [
      { id: 'on-0', day, title: 'Late class', start_time: '01:00:00', end_time: '02:00:00', type: 'class', is_masterclass: true },
      { id: 'on-1', day, title: 'Evening party', start_time: '23:00:00', end_time: '02:00:00', type: 'party' },
    ];
    const html = await renderFestival(day, overnight, { start: day, end: day });

    // THE SESSION TYPE IS STILL ON THE PAGE, by both routes. Colour is by LEVEL
    // now, so nothing else distinguishes a party from a workshop -- and on a
    // festival that publishes no levels (Tunisia: 14 items, every `levels`
    // empty) dropping it left every card an identical grey block. A tall card
    // gets a tag band; a one-row card cannot afford one, so its type is folded
    // into the meta line instead. Both are asserted, because a fix that only
    // covered the tall case would look complete against this fixture.
    expect(html).toContain('<span class="tl-ev-tag">Party</span>');

    // THE ONE-ROW PATH, asserted on the VISIBLE meta line and not on the
    // accessible name. The label carries `typeTag` whichever way the card
    // renders, so a `sr-only` assertion passes with the visual fold deleted --
    // measured: removing it left every case here green. This reads the meta
    // span, which only the fold writes to.
    expect(metaTexts(html).some((t) => t.includes('Masterclass'))).toBe(true);

    // ...and the accessible name reports it too, by whichever route.
    expect(daySessions(html).map((c) => c.label?.split(',')[1]?.trim())).toContain('Masterclass');

    // VISUAL ORDER is the receipt: the party comes first because it starts
    // first on the festival's own clock.
    const cards = daySessions(html);
    expect(cards.map((c) => c.label?.split(',')[0])).toEqual(['Evening party', 'Late class']);

    // Hours 23, 00 and 01 -- three rows, no duplicate label, no phantom gap.
    expect(hourRows(html)).toBe(3);
    expect(html).not.toContain('hours free');
  });

  it('gives an unroomed session its own column instead of dropping it', async () => {
    // THE DEFECT THIS EXISTS FOR, and it is not hypothetical: a review of the
    // four design mockups this grid was built from found it in FOUR OF FOUR.
    // Group the day by room, then select each group with `item.room === room`,
    // and every session whose room is NULL matches no group and vanishes from
    // the grid -- while the day chip above it goes on counting it, so the chip
    // reads one more than the grid shows. `event_program_items.room` is
    // nullable, so the mixed shape is representable.
    //
    // No live festival mixes roomed and unroomed sessions on one day (checked
    // against prod on 2026-08-25), which is exactly why this needs a case and
    // not a look: there is nothing to see it on.
    const day = LOCAL_START;
    const mixed = [
      { id: 'mx-0', day, title: 'In a room', start_time: '10:00:00', end_time: '11:00:00', type: 'class', venue_room: 'Room A' },
      { id: 'mx-1', day, title: 'Also in a room', start_time: '12:00:00', end_time: '13:00:00', type: 'class', venue_room: 'Room A' },
      { id: 'mx-2', day, title: 'Room not published', start_time: '10:00:00', end_time: '11:00:00', type: 'class' },
    ];
    const html = await renderFestival(day, mixed, { start: day, end: day });

    // EVERY session reaches the grid. Asserted by NAME and not only by count:
    // a count alone is satisfied by a grid that drops the unroomed session and
    // renders one of the others twice.
    const cards = daySessions(html);
    expect(cards.map((c) => c.label?.split(',')[0]).sort()).toEqual([
      'Also in a room',
      'In a room',
      'Room not published',
    ]);

    // ...and it sits in a column that SAYS the room is unknown, rather than
    // being folded into Room A -- which would not lose the session, it would
    // misattribute it, and that is worse on a public page about a real event.
    expect(html).toContain('Room A');
    expect(html).toContain('Room not set');
    expect(sessionColumns(html)).toBe(2);

    // THE MISATTRIBUTION ITSELF, which the three assertions above cannot see:
    // they prove both headings are somewhere on the page and that two tracks
    // exist, and every one of them stays green while the cards sit under the
    // WRONG heading. Both strings are in the document either way.
    //
    // Pinned absolutely first, in first-appearance order -- Room A leads
    // because `mx-0` does -- then paired. A card under a heading that says the
    // room is unknown when the organiser published Room A, or the reverse, is
    // the page stating a wrong fact about a real event.
    const rooms = roomHeadings(html);
    expect(rooms).toEqual([
      { name: 'Room A', start: 2, span: 1, count: '2 sessions' },
      { name: 'Room not set', start: 3, span: 1, count: '1 session' },
    ]);

    expect(headingsOver(rooms, columnOf(cards, 'In a room'))).toEqual(['Room A']);
    expect(headingsOver(rooms, columnOf(cards, 'Also in a room'))).toEqual(['Room A']);
    expect(headingsOver(rooms, columnOf(cards, 'Room not published'))).toEqual(['Room not set']);
  });

  it('starts the second room AFTER the first room lanes, not one track along', async () => {
    // THE PRODUCTION GEOMETRY, and the one the two cases above cannot express.
    // London Latin Fest runs three classes at once in a single room while a
    // second room runs one -- `repeat(4,` under two headings, verified live on
    // 2026-08-25. Both other fixtures are one room over two lanes, or two rooms
    // over one lane each, and in BOTH of those `columns += group.lanes` and
    // `columns += 1` compute the same number: a room only ever advances the
    // cursor by one, so the accumulator's whole job is invisible.
    //
    // WHAT THIS CASE UNIQUELY CATCHES, corrected from what an earlier draft of
    // this comment claimed. It said the accumulator `columns += group.lanes`
    // was invisible everywhere else; that is FALSE and was measured false by
    // the run that first recorded it -- mutating it to `columns += 1` also reds
    // the abutting case above, at `sessionColumns`, because one room over two
    // lanes advances the cursor by two there as well.
    //
    // What genuinely needs a multi-lane room FOLLOWED BY another room is the
    // room's START: `roomStartColumn[gi] = gi` numbers rooms 0, 1, 2 and agrees
    // with the truth on every other fixture in this file, because no other
    // fixture has a room wide enough for the two to disagree. Under it the
    // second room's heading lands INSIDE the first room's span, so a Room B
    // session sits under a heading that also says Room A -- which is why
    // `headingsOver` returns every covering heading instead of the first one.
    const day = LOCAL_START;
    const collision = [
      { id: 'cl-0', day, title: 'A one', start_time: '16:00:00', end_time: '17:00:00', type: 'class', venue_room: 'Room A' },
      { id: 'cl-1', day, title: 'A two', start_time: '16:00:00', end_time: '17:00:00', type: 'class', venue_room: 'Room A' },
      { id: 'cl-2', day, title: 'A three', start_time: '16:00:00', end_time: '17:00:00', type: 'class', venue_room: 'Room A' },
      { id: 'cl-3', day, title: 'B one', start_time: '16:00:00', end_time: '17:00:00', type: 'class', venue_room: 'Room B' },
    ];
    const html = await renderFestival(day, collision, { start: day, end: day });

    // IN DOM ORDER, not sorted. This is the only fixture in the file with more
    // than two cards sharing ONE row, so it is the strongest statement of the
    // row-then-column sort available anywhere here -- and that sort is the ARIA
    // contract the case above records having watched break in silence
    // (`cells.reverse()` survived every case with zero failing assertions).
    //
    // WHAT IT ACTUALLY CATCHES, corrected from a draft that claimed more. It
    // kills the tie-break reversed -- `b.column - a.column` -- measured. It
    // does NOT kill a `flow` keyed on room NAME instead of column: Room A sorts
    // before Room B, and within a room the stable sort falls back to `cells`
    // construction order, which is already column-ascending, so that mutant
    // emits byte-identical DOM and runs green here and everywhere else. A
    // fixture whose room names sort against their column order would be needed
    // to see it, and none exists. Do not read this line as covering that.
    const cards = daySessions(html);
    expect(cards.map((c) => c.label?.split(',')[0])).toEqual([
      'A one',
      'A two',
      'A three',
      'B one',
    ]);

    // Three lanes plus one, so four tracks -- the count prod renders.
    expect(sessionColumns(html)).toBe(4);

    // Room B begins where Room A's lanes END. Track 1 is the time gutter, so
    // Room A holds 2..4 and Room B starts at 5.
    const rooms = roomHeadings(html);
    expect(rooms).toEqual([
      { name: 'Room A', start: 2, span: 3, count: '3 sessions' },
      { name: 'Room B', start: 5, span: 1, count: '1 session' },
    ]);

    // Every card under exactly ONE heading, and its own. The three Room A
    // sessions take three different tracks between them, which is the
    // collision actually being laid out rather than stacked.
    const aCols = ['A one', 'A two', 'A three'].map((t) => columnOf(cards, t));
    expect(new Set(aCols).size).toBe(3);
    expect(aCols.map((c) => headingsOver(rooms, c))).toEqual([
      ['Room A'],
      ['Room A'],
      ['Room A'],
    ]);
    expect(headingsOver(rooms, columnOf(cards, 'B one'))).toEqual(['Room B']);
  });

  /**
   * REGRESSION CASES FOR THE REVIEW ROUND, and the reason they exist at all:
   * the three defects below were fixed and the suite stayed 34/34 green. A
   * fix nothing asserts is a fix that can be reverted in silence, and all
   * three are wrong information about a real event on a public page.
   */
  it('puts an 08:30 session at the TOP of its own day, not behind a fabricated gap', async () => {
    // programDayRollover rolls back sessions starting STRICTLY BEFORE 08:00, so
    // 08:00-08:59 belongs to its own day's morning. DAY_AXIS_START_HOUR read 9
    // while its comment claimed parity with that file, so an 08:30 bootcamp was
    // pushed a full day up the axis: last card of the day, behind a "10 hours
    // free" gap the organiser never published.
    const day = LOCAL_START;
    const html = await renderFestival(day, [
      { id: 'am-0', day, title: 'Morning bootcamp', start_time: '08:30:00', end_time: '09:30:00', type: 'class' },
      { id: 'pm-0', day, title: 'Evening party', start_time: '21:00:00', end_time: '23:00:00', type: 'party' },
    ], { start: day, end: day });

    expect(daySessions(html).map((c) => c.label?.split(',')[0])).toEqual([
      'Morning bootcamp',
      'Evening party',
    ]);
    // No gap row may claim the hours BEFORE the first session.
    expect(html).not.toContain('10 hours free');
  });

  it('does not print an end time the organiser never published', async () => {
    const day = LOCAL_START;
    const html = await renderFestival(day, [
      { id: 'ne-0', day, title: 'No end published', start_time: '20:00:00', type: 'class' },
    ], { start: day, end: day });

    // The card still needs a height, so the layout keeps its 60-minute default
    // -- but "20:00-21:00" is a CLAIM, and nobody made it.
    const meta = metaTexts(html);
    expect(meta.length).toBe(1);
    expect(meta[0]).toContain('20:00');
    expect(meta[0]).not.toContain('21:00');
    expect(daySessions(html)[0].label).toContain('no end published');
  });

  it('renders a REJECTED wrap as start-only, not as a different wrong end', async () => {
    // 10:00 -> 09:00 wraps to 23 hours, over MAX_WRAP_MINUTES, so the reading is
    // rejected as a typo. Substituting start+1h swapped one wrong end for
    // another; declining to state an end is the only honest option.
    const day = LOCAL_START;
    const html = await renderFestival(day, [
      { id: 'wr-0', day, title: 'Typo', start_time: '10:00:00', end_time: '09:00:00', type: 'class' },
    ], { start: day, end: day });

    const meta = metaTexts(html);
    expect(meta[0]).toContain('10:00');
    expect(meta[0]).not.toContain('11:00');
  });

  it('does not advertise a two-level class as open to everyone', async () => {
    // FestivalScheduleItem.levels: "All four named = 'All levels'." Reading ANY
    // multi-level session as "All levels" told advanced dancers a
    // beginner+improver class was for them.
    const day = LOCAL_START;
    const html = await renderFestival(day, [
      { id: 'lv-0', day, title: 'Two level class', start_time: '10:00:00', end_time: '11:00:00', type: 'class', levels: ['beginner', 'improver'] },
    ], { start: day, end: day });

    expect(metaTexts(html)[0]).toContain('Beginner, Improver');
    expect(html).not.toContain('All levels');
  });

  it('never paints two legend rows the same colour', async () => {
    // "Open Level" and "All levels" are both open -- they shared a swatch and
    // rendered as two rows, so a reader matching a purple card against the key
    // got two answers. Sharing a colour and sharing a row are the same claim.
    const day = LOCAL_START;
    const html = await renderFestival(day, [
      { id: 'op-0', day, title: 'Open', start_time: '10:00:00', end_time: '11:00:00', type: 'class', levels: ['open_level'] },
      { id: 'af-0', day, title: 'All four', start_time: '12:00:00', end_time: '13:00:00', type: 'class', levels: ['beginner', 'improver', 'intermediate', 'advanced'] },
    ], { start: day, end: day });

    const keys = [...html.matchAll(/class="legend-item l-([a-z]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size, `legend repeated a swatch: ${keys.join(', ')}`).toBe(keys.length);
  });

  it('renders the UNDATED column instead of an empty grid', async () => {
    // festivalGridDays appends a column for a session with no usable day, and
    // its own header says why: losing that column "was a silent regression: the
    // session became unreachable in the UI". `sessionsByDay` buckets it under
    // `''`, so reading the open day's key as `null` and feeding the grid `[]`
    // reintroduced exactly that -- with the day chip above still counting the
    // session it would not show.
    const html = await renderFestival(undefined, SCHEDULE_WITH_UNDATED);

    // The UNDATED column is appended LAST, after the three span days, and it
    // still gets a chip -- the column is not dropped.
    expect(html.split('class="day-tab ').length - 1).toBe(4);

    // THE CONTENT HALF IS NOT ASSERTABLE HERE, and saying so is the point.
    // Opening the undated column needs a CLICK: the seed answers day 0 (a real
    // span day) and no pinned key can select a column that has no date to pin.
    // A render with the undated session alone therefore shows "Nothing
    // scheduled" for day 0 and proves nothing about the undated one. The click
    // lives in tests/client/festivalClientState -- "opens the UNDATED column".
    // Splitting it is honest; asserting the easy half here and calling the
    // defect covered is how it got shipped in the first place.
  });

  it('reads gap rows between the sessions they separate, not all before them', async () => {
    // Gaps are the only content in the grid besides sessions that is NOT
    // aria-hidden, so DOM order is what a screen reader and a keyboard walk
    // follow. Emitted in their own pass they announced every break up front --
    // "3 hours free, 5 hours free", then the whole day -- which is the exact
    // mismatch the cells' row-then-column sort exists to prevent. The source
    // called that sort "the ARIA contract" while the gaps sat outside it.
    const day = LOCAL_START;
    const spaced = [
      { id: 'sp-0', day, title: 'Morning', start_time: '10:00:00', end_time: '11:00:00', type: 'class' },
      { id: 'sp-1', day, title: 'Afternoon', start_time: '15:00:00', end_time: '16:00:00', type: 'class' },
      { id: 'sp-2', day, title: 'Evening', start_time: '20:00:00', end_time: '21:00:00', type: 'class' },
    ];
    const html = await renderFestival(day, spaced, { start: day, end: day });
    const body = tlBody(html);

    // The exposed content, in served order.
    const flow = [...body.matchAll(/<div [^>]*class="[^"]*\b(tl-gap|tl-ev)\b[^"]*"[^>]*>(?:<span[^>]*>)?([^<]*)/g)]
      .map((m) => (m[1] === 'tl-gap' ? 'GAP' : 'SESSION'));

    expect(flow).toEqual(['SESSION', 'GAP', 'SESSION', 'GAP', 'SESSION']);
  });

  it('bounds a roster to what the card can hold, and still names the full count', async () => {
    // The card cannot use `overflow:hidden` (that disables the sticky label) and
    // it carries `z-index:3`, so an unbounded roster paints straight over the
    // session below it. A one-hour card has room for none of it.
    const day = LOCAL_START;
    const people = Array.from({ length: 8 }, (_unused, i) => ({
      id: `p-${i}`,
      display_name: `Artist Number ${i}`,
    }));
    const crowded = [
      { id: 'cr-0', day, title: 'One hour, eight artists', start_time: '10:00:00', end_time: '11:00:00', type: 'class', instructors: people },
    ];
    const html = await renderFestival(day, crowded, { start: day, end: day });
    const body = tlBody(html);

    // A one-row card shows NO roster block -- the count moves to the meta line.
    expect(body).not.toContain('tl-ev-roster');
    expect(body).toContain('8 artists');

    // ...and the accessible name reports the full count regardless, because it
    // is not space-constrained and must never under-report.
    expect(daySessions(html)[0].label).toContain('8 artists');
  });

  it('says so when the open day has nothing on it, instead of an empty grid', async () => {
    // THE REST-DAY BRANCH. `days` come from the SPAN, so a day with no sessions
    // is a real column, and when it is the one that opens -- a festival whose
    // span starts before its programme does -- the box would otherwise be a
    // headerless, rowless husk. No live festival reaches this today (checked
    // against prod on 2026-08-25: no event has a span day its programme
    // skips), which is exactly why it needs a case rather than a look.
    //
    // Day 0 is deliberately the blank one: with no key pinned the seed answers
    // 0, so the reader lands on it.
    const laterOnly = SCHEDULE.filter((s) => s.day !== LOCAL_START);
    const html = await renderFestival(undefined, laterOnly);

    expect(html).toContain(TABS_RENDERED);
    expect(openDay(html)).toBe('0');
    expect(html).toContain('Nothing scheduled');

    // The GRID is absent, not merely empty -- an empty `.tl-box` would satisfy
    // the copy assertion above while still drawing a bordered, blank 360px
    // rectangle under it.
    expect(html).not.toMatch(/<div [^>]*class="[^"]*\btl-box\b/);
    expect(daySessions(html)).toHaveLength(0);

    // ...and the picker still offers the days that DO have sessions, so the
    // empty state is a signpost rather than a dead end.
    expect(html.split('class="day-tab ').length - 1).toBe(3);
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
