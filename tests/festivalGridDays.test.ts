import { describe, expect, it } from 'vitest';
import { asWallClock, wallClockDateRange, type WallClock } from '@/lib/time/wallClock';
import { festivalGridDays } from '@/modules/event-page/utils/festivalGridDays';

const wc = (s: string) => asWallClock(s);
const sessions = (...days: string[]) => days.map((d) => ({ day: wc(d) }));
const keys = (out: WallClock[]) => out.map((d) => String(d));

// These live here, not in a wallClock-named spec, ON PURPOSE: this file is the
// one .github/workflows/unit-tests.yml lists in the New York / Sydney legs, and
// wallClockDateRange's UTC pin is what those legs exist to protect. Moving them
// to a "tidier" home would delete that coverage silently -- nothing would go
// red. Move the workflow entry in the same commit, or leave them.
describe('wallClockDateRange', () => {
  it('returns every day of an inclusive span', () => {
    expect(keys(wallClockDateRange(wc('2026-11-05'), wc('2026-11-08')))).toEqual([
      '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
  });

  it('a single-day span is one day, not zero', () => {
    expect(keys(wallClockDateRange(wc('2026-11-05'), wc('2026-11-05')))).toEqual(['2026-11-05']);
  });

  it('crosses a month and a year boundary without arithmetic drift', () => {
    expect(keys(wallClockDateRange(wc('2026-12-30'), wc('2027-01-02')))).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
    ]);
  });

  // The BST->GMT switch is 2026-10-25. A machine-local Date would double or
  // skip a day here; UTC-midnight arithmetic does not. This is the property
  // that makes the helper safe to run under the TZ matrix.
  it('spans a DST transition without gaining or losing a day', () => {
    expect(keys(wallClockDateRange(wc('2026-10-24'), wc('2026-10-27')))).toEqual([
      '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
    ]);
  });

  it('reads the date PREFIX of a timestamped bound', () => {
    expect(keys(wallClockDateRange(wc('2026-11-05T12:00:00'), wc('2026-11-06T02:00:00'))))
      .toEqual(['2026-11-05', '2026-11-06']);
  });

  it.each([
    ['end before start', wc('2026-11-08'), wc('2026-11-05')],
    ['null start', null, wc('2026-11-08')],
    ['null end', wc('2026-11-05'), null],
    ['both null', null, null],
    ['malformed start', wc('not-a-date'), wc('2026-11-08')],
    ['malformed end', wc('2026-11-05'), wc('13/11/2026')],
  ])('returns [] for %s', (_label, a, b) => {
    expect(wallClockDateRange(a, b)).toEqual([]);
  });

  // Shape-valid but calendar-impossible. Date.parse does NOT return NaN here --
  // '2026-02-30T00:00:00Z' parses to 2026-03-02 -- so a Number.isFinite guard
  // alone let a nonsense bound through and rendered phantom columns past the
  // end of the festival. isRealDateKey is the round-trip validator that catches
  // it, and it is leap-year aware, hence the 2027 case.
  it.each([
    ['impossible end (Feb 30)', wc('2026-02-27'), wc('2026-02-30')],
    ['impossible start (Feb 30)', wc('2026-02-30'), wc('2026-03-01')],
    // The case above does NOT prove the start bound is validated: 2026-02-30
    // rolls forward to 2026-03-02, which is past the 03-01 end, so the
    // inverted-range guard returns [] whether or not isRealDateKey ran. Found
    // by mutating the fix -- dropping the start check left every test green.
    // Here the rolled start lands INSIDE the range, so only the check can
    // reject it.
    ['impossible start that rolls INSIDE the range', wc('2026-02-30'), wc('2026-03-05')],
    ['impossible end (Nov 31)', wc('2026-11-01'), wc('2026-11-31')],
    ['non-leap 29 Feb', wc('2027-02-01'), wc('2027-02-29')],
  ])('returns [] for %s rather than rolling it over', (_label, a, b) => {
    expect(wallClockDateRange(a, b)).toEqual([]);
  });

  it('still accepts a REAL leap day', () => {
    expect(keys(wallClockDateRange(wc('2028-02-28'), wc('2028-02-29')))).toEqual([
      '2028-02-28', '2028-02-29',
    ]);
  });

  it('refuses a span longer than the cap rather than allocating it', () => {
    expect(wallClockDateRange(wc('2026-01-01'), wc('2027-01-01'))).toEqual([]);
    expect(keys(wallClockDateRange(wc('2026-01-01'), wc('2026-01-05'), 5))).toHaveLength(5);
    expect(wallClockDateRange(wc('2026-01-01'), wc('2026-01-06'), 5)).toEqual([]);
  });
});

describe('festivalGridDays', () => {
  // THE regression. Pre-fix, All Stars had two programme days on 2026-11-05,
  // so the schedule carried days [05, 05, 07, 08]. A Set over those yields
  // three columns and Friday 6 Nov disappears from the page. The span was
  // 05..08 throughout and was always right.
  it('renders 4 columns for the All Stars shape that used to render 3', () => {
    const out = festivalGridDays(
      sessions('2026-11-05', '2026-11-05', '2026-11-07', '2026-11-08'),
      wc('2026-11-05'),
      wc('2026-11-08'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    // The assertion that actually distinguishes old from new:
    expect(out).toHaveLength(4);
  });

  it('keeps a session-less middle day as an empty column', () => {
    const out = festivalGridDays(
      sessions('2026-11-05', '2026-11-08'),
      wc('2026-11-05'),
      wc('2026-11-08'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });

  // HELPER-ONLY CONTRACT, not coverage of the shipped path: FestivalDetail
  // returns `days: []` on `schedule.length === 0` before it ever calls this,
  // so an empty-schedule festival cannot reach here in production. Kept
  // because the helper's contract is worth pinning, labelled because a reader
  // would otherwise take it for a rendered case.
  it('renders the full span even with no sessions at all (helper contract only)', () => {
    expect(keys(festivalGridDays([], wc('2026-11-05'), wc('2026-11-07'))))
      .toEqual(['2026-11-05', '2026-11-06', '2026-11-07']);
  });

  // Union, not replacement. An out-of-span session is a data fault, but
  // dropping its column would hide the session -- the same failure this
  // change exists to stop, aimed at a different cause.
  it('keeps a session dated OUTSIDE the span rather than hiding it', () => {
    const out = festivalGridDays(
      sessions('2026-11-05', '2026-11-12'),
      wc('2026-11-05'),
      wc('2026-11-06'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06', '2026-11-12']);
  });

  it('falls back to session days when the span is missing', () => {
    expect(keys(festivalGridDays(sessions('2026-11-08', '2026-11-05'), null, null)))
      .toEqual(['2026-11-05', '2026-11-08']);
  });

  // THE claim that justified deleting the explicit "no span" branch, made
  // executable. The branch used to spell out "return the deduped sorted session
  // list"; the union path already does exactly that whenever the span yields no
  // days, so the branch could never change an answer. If a future edit to the
  // union path breaks that, THIS is what goes red -- previously the evidence
  // was a fuzz run in a scratch directory that nobody could re-run.
  it.each([
    ['both bounds null', null, null],
    ['start null', null, wc('2026-11-08')],
    ['end null', wc('2026-11-05'), null],
    ['malformed start', wc('nope'), wc('2026-11-08')],
    ['inverted span', wc('2026-11-08'), wc('2026-11-05')],
    ['impossible bound', wc('2026-02-30'), wc('2026-03-05')],
    ['span past the cap', wc('2026-01-01'), wc('2027-01-01')],
  ])('with no usable span (%s) the result IS the deduped sorted session list', (_l, a, b) => {
    const raw = ['2026-11-08', '2026-11-05', '2026-11-08', '2026-11-06'];
    const expected = Array.from(new Set(raw)).sort();
    expect(keys(festivalGridDays(sessions(...raw), a, b))).toEqual(expected);
  });

  it('falls back, and still dedupes, when the span is malformed', () => {
    expect(keys(festivalGridDays(sessions('2026-11-05', '2026-11-05'), wc('nope'), wc('2026-11-08'))))
      .toEqual(['2026-11-05']);
  });

  // Pre-extraction this fell out of a raw `new Set` over s.day, which kept the
  // codec's '' sentinel as a (blank-labelled) column. Dropping it looked like
  // tidiness and was a silent regression: the session became unreachable in the
  // UI, which is this module's one prohibited outcome.
  it('gives sessions with no usable day ONE undated column, not zero and not two', () => {
    const out = festivalGridDays(
      [{ day: null }, { day: wc('') }, { day: wc('2026-11-05') }],
      wc('2026-11-05'),
      wc('2026-11-06'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06', '']);
  });

  // A session day may carry a TIME suffix (sniffIsFestival guards for exactly
  // that shape), so every comparison here must go through wallClockDateKey.
  // Reading s.day raw would make this session a duplicate orphan column beside
  // its own span day, and no other case in this file would notice.
  it('matches a time-suffixed session day against its span day', () => {
    const out = festivalGridDays(
      [{ day: wc('2026-11-05T20:00:00') }, { day: wc('2026-11-06T02:00:00') }],
      wc('2026-11-05'),
      wc('2026-11-06'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('adds no undated column when every session has a usable day', () => {
    const out = festivalGridDays(sessions('2026-11-05'), wc('2026-11-05'), wc('2026-11-06'));
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('returns columns in ascending date order', () => {
    const out = festivalGridDays(sessions('2026-11-20'), wc('2026-11-05'), wc('2026-11-07'));
    expect(keys(out)).toEqual([...keys(out)].sort());
  });

  // The three below exist because mutation found the suite blind to them: each
  // one is the smallest input that kills a mutant the other 20 tests let live.

  // Kills `length === 0` -> `length === 1`, which sends a ONE-DAY festival down
  // the session-derived fallback -- the exact behaviour this module replaced.
  it('renders the single column of a one-day festival, stray session and all', () => {
    expect(keys(festivalGridDays(sessions('2026-11-07'), wc('2026-11-05'), wc('2026-11-05'))))
      .toEqual(['2026-11-05', '2026-11-07']);
    expect(keys(festivalGridDays(sessions('2026-11-05'), wc('2026-11-05'), wc('2026-11-05'))))
      .toEqual(['2026-11-05']);
  });

  // Kills the loss of `new Set(orphanKeys)`. Two sessions on one out-of-span
  // date must be ONE column; duplicated columns are the same visual defect as
  // the missing one, just spelled the other way.
  it('collapses two sessions on the SAME out-of-span date into one column', () => {
    const out = festivalGridDays(
      sessions('2026-11-05', '2026-11-12', '2026-11-12'),
      wc('2026-11-05'),
      wc('2026-11-06'),
    );
    expect(keys(out)).toEqual(['2026-11-05', '2026-11-06', '2026-11-12']);
  });

  // Kills the loss of the final `.sort()`. The ordering test above cannot: its
  // orphan (11-20) already sorts last, so the array is in order WITHOUT sorting.
  // An orphan dated BEFORE the span is the case that actually needs it.
  it('sorts an out-of-span session dated BEFORE the festival into first place', () => {
    const out = festivalGridDays(
      sessions('2026-11-01', '2026-11-06'),
      wc('2026-11-05'),
      wc('2026-11-06'),
    );
    expect(keys(out)).toEqual(['2026-11-01', '2026-11-05', '2026-11-06']);
  });
});
