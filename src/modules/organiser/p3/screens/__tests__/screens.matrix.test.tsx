// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SHAPES, SHAPE_KEYS, TODAY, homeOf, statsOf, type ShapeKey } from './fixtures';
import { groupsOf, needsOf, nextUpView, rowOf, rowsOf } from '../../data/home';
import { dailyTotals, parseStats, rangeFrom, viewsTotal } from '../../data/stats';
import { L, dayWord, statusOf } from '../../model';
import { NOTHING_COMING_UP } from '../../../shared/lifeLabel';

/*
 * W1 consistency matrix: every screen (Home, Events, Stats) x every prod shape
 * (fixtures.ts), plus the C3 probes that apply to read screens (selfcheck/C3-probes.mjs:
 * #24, S18, #8b, #8d, #15, R-sim-m1-header, R-pol-w1, R-sim-s4-tile, R-sim-stats-sum).
 */

const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const viewsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const going = vi.hoisted(() => ({ value: { view: { state: 'off' }, total: null } as Record<string, unknown> }));

vi.mock('../../data/useP3Data', () => ({ useP3Home: () => homeQ.value, useP3Views: () => viewsQ.value }));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => going.value }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));

import { HomeScreen } from '../HomeScreen';
import { EventsScreen } from '../EventsScreen';
import { StatsScreen } from '../StatsScreen';

const ok = (data: unknown) => ({ isPending: false, isError: false, data, refetch: vi.fn() });
const pending = () => ({ isPending: true, isError: false, data: undefined, refetch: vi.fn() });
const failed = () => ({ isPending: false, isError: true, data: undefined, refetch: vi.fn() });

function show(node: JSX.Element) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

beforeEach(() => {
  going.value = { view: { state: 'off' }, total: null };
  viewsQ.value = ok(statsOf([['weekly', 'Sensual Fridays', 300]]));
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
  it.each(SHAPE_KEYS)('%s alone', (k) => {
    homeQ.value = ok(homeOf([SHAPES[k]]));
    show(<HomeScreen />);
    const row = rowOf(SHAPES[k], TODAY);
    const next = nextUpView([row], homeOf([SHAPES[k]]));
    if (next) {
      expect(within(screen.getByTestId('p3-nextup')).getByText(row.name)).toBeTruthy();
      expect(screen.queryByTestId('p3-nextup-none')).toBeNull();
    } else {
      // says what the person can do, with the control on screen
      const none = screen.getByTestId('p3-nextup-none');
      expect(within(none).getByRole('link').textContent).toMatch(/current organiser area/);
      // the words follow the state: a draft or a hidden event is never told to "add dates"
      const want = row.lifecycle === 'live' ? /Add dates/ : row.lifecycle === 'draft' ? /Put a draft live/ : row.lifecycle === 'paused' ? /hidden/ : /Nothing is on the calendar/;
      expect(none.textContent).toMatch(want);
    }
    if (row.status.past) expect(screen.getByTestId('p3-home-allended')).toBeTruthy();
    else expect(within(screen.getByRole('list', { name: 'Your first events' })).getAllByTestId('p3-row')).toHaveLength(1);
  });

  it('Next up is the soonest live date: tonight beats later, hidden and finished never count (probe #8b, #8d)', () => {
    const home = homeOf(SHAPE_KEYS.map((k) => SHAPES[k]));
    const n = nextUpView(rowsOf(home), home)!;
    expect(n.row.id).toBe('tonight');
    expect(n.when).toBe('Next up \u00b7 Tonight, 8:30pm');
    const noTonight = homeOf(SHAPE_KEYS.filter((k) => k !== 'tonight').map((k) => SHAPES[k]));
    // the hidden series has the 26 Oct date, but Next up skips it
    expect(nextUpView(rowsOf(noTonight), noTonight)!.row.id).toBe('over100');
  });

  it('Next up names tomorrow, and a different-from-usual date says so', () => {
    const home = homeOf([SHAPES.moved], '2026-10-31');
    show(<HomeScreen />);
    cleanup();
    homeQ.value = ok(home);
    show(<HomeScreen />);
    expect(screen.getByTestId('p3-nextup').textContent).toContain('Next up \u00b7 Tomorrow, 9pm');
    expect(screen.getByTestId('p3-different')).toBeTruthy();
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

  it('views: the total links to Stats; zero says how to get the first ones; the going tile hides while the switch is off', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<HomeScreen />);
    expect(screen.getByTestId('p3-views').getAttribute('href')).toBe('/account/p3/stats');
    expect(screen.getByTestId('p3-views').textContent).toContain('300');
    expect(screen.queryByTestId('p3-going')).toBeNull();
    cleanup();
    viewsQ.value = ok(statsOf([['weekly', 'Sensual Fridays', 0]]));
    show(<HomeScreen />);
    expect(screen.getByTestId('p3-views-none').textContent).toMatch(/Instagram or WhatsApp/);
  });

  it('going shows once the switch is on and the read is ready', () => {
    going.value = { view: { state: 'ready' }, total: { going_total: 14, nights: 3, events: 2 } };
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<HomeScreen />);
    expect(screen.getByTestId('p3-going').textContent).toContain('14');
  });

  it.each([
    ['loading', pending, 'p3-home-loading'],
    ['error', failed, 'p3-home-error'],
    ['empty', () => ok(homeOf([])), 'p3-home-empty'],
  ] as const)('%s state says what the person can do', (_n, q, id) => {
    homeQ.value = q();
    show(<HomeScreen />);
    const card = screen.getByTestId(id);
    expect(card.textContent!.length).toBeGreaterThan(20);
    if (id === 'p3-home-error') {
      fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      expect((homeQ.value.refetch as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    }
    if (id === 'p3-home-empty') expect(within(card).getByRole('link')).toBeTruthy();
  });

  it('"See all N" only when more than four events', () => {
    homeQ.value = ok(homeOf(['weekly', 'oneoff', 'course', 'festival'].map((k) => SHAPES[k as ShapeKey])));
    show(<HomeScreen />);
    expect(screen.queryByText(/See all/)).toBeNull();
    cleanup();
    homeQ.value = ok(homeOf(SHAPE_KEYS.map((k) => SHAPES[k])));
    show(<HomeScreen />);
    expect(screen.getByText(`See all ${SHAPE_KEYS.length}`)).toBeTruthy();
  });
});

describe('Events x every shape', () => {
  it.each(SHAPE_KEYS)('%s: one row, in its status group, with its kind chip and status', (k) => {
    homeQ.value = ok(homeOf([SHAPES[k]]));
    show(<EventsScreen />);
    const rows = screen.getAllByTestId('p3-row');
    expect(rows).toHaveLength(1);
    const [status, kind, sub] = EXPECT[k];
    expect(within(rows[0]).getByTestId('p3-status').textContent).toBe(status);
    expect(within(rows[0]).getByTestId('p3-kind').textContent).toBe(kind);
    expect(rows[0].textContent).toContain(sub);
    const group = rows[0].closest('ul')!.getAttribute('aria-label');
    const past = ['ended', 'oneoffPast', 'courseDone', 'allCancelled'].includes(k);
    expect(group).toBe(k === 'paused' ? L.hidden : past ? 'Past and nothing coming up' : 'Your events');
  });

  it('every shape at once: soonest first, grouped by status only, never by kind (C3 #71)', () => {
    const rows = rowsOf(homeOf(SHAPE_KEYS.map((k) => SHAPES[k])));
    const g = groupsOf(rows);
    expect(g.hidden.map((r) => r.id)).toEqual(['paused']);
    expect(g.finished.map((r) => r.id).sort()).toEqual(['allCancelled', 'courseDone', 'ended', 'oneoffPast']);
    expect(g.on.slice(0, 3).map((r) => r.id)).toEqual(['tonight', 'over100', 'course']);
    // nothing coming up goes last
    expect(g.on.slice(-1)[0].next).toBeNull();
    homeQ.value = ok(homeOf(SHAPE_KEYS.map((k) => SHAPES[k])));
    show(<EventsScreen />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([L.hidden, 'Past and nothing coming up']);
  });

  it('probe #24: two events with the same name have different second lines', () => {
    const a = rowOf(SHAPES.course, TODAY);
    const b = rowOf(SHAPES.courseDone, TODAY);
    expect(a.name).toBe(b.name);
    expect(a.sub).not.toBe(b.sub);
  });

  it('probe S18: a live course with no dates left reads "All classes done"', () => {
    expect(rowOf(SHAPES.courseDone, TODAY).status.label).toBe(L.allDone);
  });

  it('probe R-pol-w1 / R-sim-m1: the row shows the NEXT date\u2019s time, the same on Home and Events', () => {
    const r = rowOf(SHAPES.moved, TODAY);
    expect(r.nextTime).toBe('9pm');
    homeQ.value = ok(homeOf([SHAPES.moved]));
    show(<EventsScreen />);
    const ev = screen.getByTestId('p3-row').textContent;
    cleanup();
    show(<HomeScreen />);
    expect(within(screen.getByRole('list', { name: 'Your first events' })).getByTestId('p3-row').textContent).toBe(ev);
  });

  it.each([
    ['loading', pending, 'p3-events-loading'],
    ['error', failed, 'p3-events-error'],
    ['empty', () => ok(homeOf([])), 'p3-events-empty'],
  ] as const)('%s state', (_n, q, id) => {
    homeQ.value = q();
    show(<EventsScreen />);
    expect(screen.getByTestId(id).textContent!.length).toBeGreaterThan(10);
  });

  it('the note points at a link that is on screen', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<EventsScreen />);
    expect(screen.getByRole('link', { name: /current organiser area/ }).getAttribute('href')).toBe('/account/o');
  });
});

describe('Stats x every shape', () => {
  it.each(SHAPE_KEYS)('%s: its views row, total = the sum (probe R-sim-stats-sum)', (k) => {
    homeQ.value = ok(homeOf([SHAPES[k]]));
    const name = rowOf(SHAPES[k], TODAY).name;
    viewsQ.value = ok(statsOf([[k, SHAPES[k].name, 41], ['other', 'Other', 9]]));
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('50');
    const items = within(screen.getByTestId('p3-stats-byevent')).getAllByRole('listitem');
    expect(items[0].textContent).toContain(`${name}41 ${L.views}`);
  });

  it('probe R-sim-s4-tile + #15: the tile says "views, all your events"; no saves count', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-total').textContent).toBe('300views, all your events');
    expect(screen.getByTestId('p3-stats').textContent).not.toMatch(/saves/i);
  });

  it('range buttons are pressed one at a time; the table lists every day', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok({ from: '2026-10-19', to: TODAY, series: [{ seriesId: 'w', name: 'W', total: 5, byDay: [{ day: '2026-10-20', count: 2 }, { day: TODAY, count: 3 }] }] });
    show(<StatsScreen />);
    const pressed = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
    expect(pressed()).toEqual(['30 days']);
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(pressed()).toEqual(['7 days']);
    fireEvent.click(screen.getByRole('button', { name: 'Show as a table' }));
    expect(within(screen.getByTestId('p3-stats-table')).getAllByRole('row')).toHaveLength(8);
  });

  it('no views / no events say what to do; loading and error too', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok(statsOf([['w', 'W', 0]]));
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-none').textContent).toMatch(/Share your link/);
    cleanup();
    viewsQ.value = ok(statsOf([]));
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-none').textContent).toMatch(/no events to count/);
    cleanup();
    viewsQ.value = pending();
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-loading')).toBeTruthy();
    cleanup();
    viewsQ.value = failed();
    show(<StatsScreen />);
    expect(within(screen.getByTestId('p3-stats-error')).getByRole('button', { name: 'Try again' })).toBeTruthy();
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

describe('photo', () => {
  it('a cover that fails to load falls back to the "No photo yet" box', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<EventsScreen />);
    const row = screen.getByTestId('p3-row');
    fireEvent.error(row.querySelector('img')!);
    expect(within(row).getByRole('img', { name: 'No photo yet' })).toBeTruthy();
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

  it('a new cover gets its own try after an earlier one failed', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    const v = show(<EventsScreen />);
    fireEvent.error(screen.getByTestId('p3-row').querySelector('img')!);
    homeQ.value = ok(homeOf([{ ...SHAPES.weekly, default_cover_image_url: 'https://example.test/new.jpg' }]));
    v.rerender(<MemoryRouter><EventsScreen /></MemoryRouter>);
    expect(screen.getByTestId('p3-row').querySelector('img')!.getAttribute('src')).toBe('https://example.test/new.jpg');
  });

  it('an event with 0 views has an empty bar', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok(statsOf([['a', 'A', 30], ['b', 'B', 0]]));
    show(<StatsScreen />);
    const bars = [...screen.getByTestId('p3-stats-byevent').querySelectorAll('.p3-bar i')] as HTMLElement[];
    expect(bars.map((b) => b.style.width)).toEqual(['100%', '0%']);
  });

  it('Today and 7 days are sliced from the one 30-day read, totals included', () => {
    const s = { from: '2026-09-26', to: TODAY, series: [{ seriesId: 'a', name: 'A', total: 6, byDay: [{ day: '2026-10-01', count: 1 }, { day: '2026-10-20', count: 2 }, { day: TODAY, count: 3 }] }] };
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok(s);
    show(<StatsScreen />);
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('6');
    fireEvent.click(screen.getByRole('button', { name: '7 days' }));
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('5');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('3');
  });

  it('a window across New Year shows the year on last year\'s days', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok({ from: '2026-12-12', to: '2027-01-10', series: [{ seriesId: 'a', name: 'A', total: 2, byDay: [{ day: '2026-12-31', count: 2 }] }] });
    show(<StatsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Show as a table' }));
    expect(screen.getByTestId('p3-stats-table').textContent).toContain('Thursday 31 December 2026');
    expect(screen.getByTestId('p3-stats-table').textContent).toContain('Sunday 10 January');
    expect(screen.getByTestId('p3-stats-table').textContent).not.toContain('January 2027');
  });

  it('going: switch off renders nothing; a failed read shows the going module\'s Try again', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    show(<StatsScreen />);
    expect(screen.queryByTestId('p3-going')).toBeNull();
    cleanup();
    going.value = { view: { state: 'error', code: 'network' }, total: null, retry: vi.fn(), fetching: false, refreshFailed: false };
    show(<StatsScreen />);
    expect(screen.getByTestId('going-total-stat').dataset.state).toBe('error');
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

  it('Home and Events split current / past the same way; "See all" reaches the past ones', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly, SHAPES.oneoffPast, SHAPES.ended]));
    show(<HomeScreen />);
    const listed = within(screen.getByRole('list', { name: 'Your first events' })).getAllByTestId('p3-row').map((r) => r.dataset.id);
    expect(listed).toEqual(['weekly']);
    expect(screen.getByText('See all 3')).toBeTruthy();
  });

  it('a quiet day on Today is not "No views yet" when the 30 days have views', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly]));
    viewsQ.value = ok({ from: '2026-09-26', to: TODAY, series: [{ seriesId: 'a', name: 'A', total: 240, byDay: [{ day: '2026-10-01', count: 240 }] }] });
    show(<StatsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    const card = screen.getByTestId('p3-stats-none-range');
    expect(card.textContent).toContain('240 views in the last 30 days');
    fireEvent.click(within(card).getByRole('button', { name: 'Show 30 days' }));
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('240');
  });
});
