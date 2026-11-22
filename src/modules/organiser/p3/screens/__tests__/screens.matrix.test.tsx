// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SHAPES, SHAPE_KEYS, TODAY, homeOf, statsOf, type ShapeKey } from './fixtures';
import { groupsOf, needsOf, nextUpView, rowOf, rowsOf } from '../../data/home';
import { dailyTotals, parseStats, rangeFrom, viewsTotal } from '../../data/stats';
import { sumAnalytics, parseAnalyticsV2 } from '../../data/analyticsV2';
import { L, dayWord, nextUpAdviceOf, statusOf } from '../../model';
import { NOTHING_COMING_UP } from '../../../shared/lifeLabel';

/*
 * W1 consistency matrix: every screen (Home, Events, Stats) x every prod shape
 * (fixtures.ts), plus the C3 probes that apply to read screens (selfcheck/C3-probes.mjs:
 * #24, S18, #8b, #8d, #15, R-sim-m1-header, R-pol-w1, R-sim-s4-tile, R-sim-stats-sum).
 */

const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const viewsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const going = vi.hoisted(() => ({ value: { view: { state: 'off' }, total: null } as Record<string, unknown> }));

const analyticsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const codeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('../../data/useP3Data', () => ({
  useP3Home: () => homeQ.value,
  useP3Views: () => viewsQ.value,
  useP3Analytics: () => analyticsQ.value,
  useP3ShareCode: () => codeQ.value,
}));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => going.value }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));

import { P3_PATHS } from '../../shell/paths';

const ok = (data: unknown) => ({ isPending: false, isError: false, data, refetch: vi.fn() });
const pending = () => ({ isPending: true, isError: false, data: undefined, refetch: vi.fn() });
const failed = () => ({ isPending: false, isError: true, data: undefined, refetch: vi.fn() });

function show(node: JSX.Element) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(() => {
  going.value = { view: { state: 'off' }, total: null };
  viewsQ.value = ok(statsOf([['weekly', 'Sensual Fridays', 300]]));
  analyticsQ.value = ok(analyticsOf({}));
  codeQ.value = ok({ code: 'abc', disabled: false });
  homeQ.value = ok(homeOf([SHAPES.weekly]));
});
afterEach(cleanup);

/** What each shape must read as: [status tag, kind chip, a piece of the second line]. */
const EXPECT: Record<ShapeKey, [string, string, string]> = {
  weekly: [L.live, 'Night', 'Next Friday 30 October, 8pm \u00b7 52 dates coming up \u00b7 Studio One'],
  over100: [L.live, 'Night', 'Next Tuesday 27 October, 9pm \u00b7 57 dates coming up'],
  monthly: [L.live, 'Night', 'Next Saturday 7 November, 9pm \u00b7 12 dates coming up'],
  oneoff: [L.live, 'Night', 'Saturday 31 October, 9pm \u00b7 Studio One'],
  oneoffPast: [L.finished, 'Night', L.finished],
  course: [L.live, 'Course', 'Wednesday 28 October, 7pm \u00b7 3 classes left'],
  courseDone: [L.allDone, 'Course', L.allDone],
  festival: [L.live, 'Festival', 'Friday 20 November, 6pm'],
  allCancelled: [NOTHING_COMING_UP, 'Night', NOTHING_COMING_UP],
  moved: [L.live, 'Night', 'Next Sunday 1 November, 9pm \u00b7 20 dates coming up \u00b7 Other Hall'],
  noTime: [L.live, 'Night', `Next Thursday 29 October, ${L.noTime}`],
  paused: [L.hidden, 'Night', 'Tomorrow, 8pm \u00b7 51 dates coming up'],
  ended: [L.finished, 'Night', L.finished],
  draft: [L.draftTag, 'Not set', L.noDatesYet],
  tonight: [L.live, 'Night', 'Tonight, 8:30pm \u00b7 8 dates coming up'],
};

describe('row model x every shape', () => {
  it.each(SHAPE_KEYS)('%s', (k) => {
    const r = rowOf(SHAPES[k], TODAY);
    const [status, kind, sub] = EXPECT[k];
    expect(r.status.label).toBe(status);
    expect(r.kindWord).toBe(kind);
    expect(r.sub).toContain(sub);
  });

  it('a blank name reads "No name yet"', () => {
    expect(rowOf(SHAPES.draft, TODAY).name).toBe(L.noName);
  });

  it('no row text carries a raw stored time or an ISO date', () => {
    for (const k of SHAPE_KEYS) expect(rowOf(SHAPES[k], TODAY).sub).not.toMatch(/\d{2}:\d{2}|\d{4}-\d{2}-\d{2}/);
  });
});

describe('Home x every shape', () => {

  it('Next up is the soonest live date: tonight beats later, hidden and finished never count (probe #8b, #8d)', () => {
    const home = homeOf(SHAPE_KEYS.map((k) => SHAPES[k]));
    const n = nextUpView(rowsOf(home), home)!;
    expect(n.row.id).toBe('tonight');
    expect(n.when).toBe('Next up \u00b7 Tonight, 8:30pm');
    const noTonight = homeOf(SHAPE_KEYS.filter((k) => k !== 'tonight').map((k) => SHAPES[k]));
    // the hidden series has the 26 Oct date, but Next up skips it
    expect(nextUpView(rowsOf(noTonight), noTonight)!.row.id).toBe('over100');
  });


  it('Needs you lists only what home_v1 can prove: no photo, a repeating series with nothing coming up, drafts', () => {
    const rows = rowsOf(homeOf(SHAPE_KEYS.map((k) => SHAPES[k])));
    const n = needsOf(rows);
    expect(n.map((x) => x.key)).toEqual(['photo', 'dates', 'draft']);
    // an unnamed event is never put in a sentence as "No name yet has ..."
    expect(n[0].title).toBe('1 event has no photo yet');
    expect(n[2].title).toBe('1 event is still a draft');
    // a past one-off or a finished course is history, never "add dates" (review finding)
    expect(n[1].title).toBe('1 event is live but has no dates coming up');
    expect(n[1].detail).toBe('Thursday Social \u00b7 add dates or end it.');
    expect(needsOf(rowsOf(homeOf([SHAPES.weekly])))).toEqual([]);
  });




});

describe('Events x every shape', () => {


  it('probe #24: two events with the same name have different second lines', () => {
    const a = rowOf(SHAPES.course, TODAY);
    const b = rowOf(SHAPES.courseDone, TODAY);
    expect(a.name).toBe(b.name);
    expect(a.sub).not.toBe(b.sub);
  });

  it('probe S18: a live course with no dates left reads "All classes done"', () => {
    expect(rowOf(SHAPES.courseDone, TODAY).status.label).toBe(L.allDone);
  });




});


describe('stats parsing', () => {
  it('reads the RPC shape and drops junk', () => {
    const s = parseStats({ from: '2026-09-26', to: TODAY, series: [{ series_id: 'a', name: 'A', views_total: 7, views_by_day: [{ day: TODAY, count: 7 }, null] }, null, { name: 'no id' }] });
    expect(s.series).toEqual([{ seriesId: 'a', name: 'A', total: 7, byDay: [{ day: TODAY, count: 7 }] }]);
    expect(viewsTotal(s)).toBe(7);
    expect(parseStats(null)).toEqual({ from: '', to: '', series: [] });
  });

  it('daily totals are zero-filled over the whole window and add up to the total', () => {
    const s = statsOf([['a', 'A', 4], ['b', 'B', 6]]);
    const d = dailyTotals(s);
    expect(d).toHaveLength(30);
    expect(d.reduce((m, x) => m + x.count, 0)).toBe(10);
  });

  it('range windows end today', () => {
    expect(rangeFrom(TODAY, 1)).toBe(TODAY);
    expect(rangeFrom(TODAY, 7)).toBe('2026-10-19');
    expect(rangeFrom(TODAY, 30)).toBe('2026-09-26');
  });
});


describe('review findings (round 1)', () => {
  it.each([
    ['pending_review', 'In review'],
    ['rejected', 'Changes needed'],
  ])('a %s series with dates is never tagged Live', (lc, word) => {
    const st = statusOf(lc, 'recurring', 'weekly', 5);
    expect(st).toEqual({ key: 'review', label: word, past: false });
  });

  it('the status fact matches the current area\'s seriesLife for every shape', () => {
    for (const k of SHAPE_KEYS) {
      const r = rowOf(SHAPES[k], TODAY);
      expect(r.status.past).toBe(['ended', 'oneoffPast', 'courseDone', 'allCancelled'].includes(k));
    }
  });





});

describe('review findings (round 2)', () => {
  it('an unknown today never throws and never guesses Tonight', () => {
    expect(dayWord('2026-10-30', '')).toBe('Friday 30 October 2026');
    expect(() => rowsOf(homeOf(SHAPE_KEYS.map((k) => SHAPES[k]), ''))).not.toThrow();
  });

  it('a date today before 5pm is "Today", from 5pm "Tonight"', () => {
    expect(dayWord(TODAY, TODAY, '10:00:00')).toBe(L.today);
    expect(dayWord(TODAY, TODAY, '17:00')).toBe(L.tonight);
    expect(dayWord(TODAY, TODAY, null)).toBe(L.tonight);
    const day = { ...SHAPES.course, next_dates: [{ ...SHAPES.course.next_dates[0], occurrence_date: TODAY, materialised_start_utc: `${TODAY}T10:00:00+00:00` }] };
    expect(rowOf(day, TODAY).sub).toContain('Today, 10am');
  });


});


/* ---- Stats v2: Visitors, From your link, share link card (organiser_analytics_v2) ---- */
function analyticsOf(t: Record<string, number>, hasOwn = true) {
  return { hidden: false as const, data: sumAnalytics([parseAnalyticsV2({ has_own_code: hasOwn, totals: t, by_day: [] })]) };
}
const ZERO = {};
const ANALYTICS_SHAPES: Array<[string, Record<string, number>, boolean, string, string]> = [
  ['all zero', ZERO, true, '0', '0'],
  ['views only', { visitors: 8, views: 12 }, false, '8', '0'],
  ['own-code taps', { visitors: 5, from_your_link: 3, link_taps_from_your_link: 2 }, true, '5', '3'],
  ['guest list 6 and tickets 2', { visitors: 9, guest_list_signups: 6, tickets_sold: 2 }, true, '9', '0'],
  ['huge', { visitors: 123456, from_your_link: 100000 }, true, '123456', '100000'],
];


