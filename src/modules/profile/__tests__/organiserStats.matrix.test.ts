/**
 * organiserStats x every organiser shape prod holds. Read-only survey
 * 2026-11-05 (prod stsdtacfauprzrdebmzg, event_occurrence_p5 joined to
 * event_series_organiser_p5, counts only): 50 organisers; 2 with no nights at
 * all; 31 with an upcoming night; 17 with past nights only; 31 with 5+ past
 * nights; up to 262 dates on one organiser; 8 with a founded_year; 18 pass the
 * weekly-rhythm rule over the last 12 months and 12 have 4+ dates on one
 * weekday but fail the 60% share -- the reason share is required.
 *
 * Every case asserts the invariants too: at most 3 stats, priority order kept,
 * no value that is 0, empty, "--" or a placeholder.
 */
import { describe, expect, it } from 'vitest';
import { addDaysToKey } from '@/lib/londonDate';
import {
  MAX_ORGANISER_STATS,
  nightKeyOf,
  nowNightKey,
  organiserStats,
  roundedCount,
  type OrganiserStatKey,
  type OrganiserStatNight,
  type OrganiserStatsInput,
} from '../organiserStats';

// Thursday 5 Nov 2026, 18:00 London (GMT in November, so UTC == London).
const NOW = new Date('2026-11-05T18:00:00Z');
const TODAY = '2026-11-05';

const night = (key: string, time = '21:00', extra: Partial<OrganiserStatNight> = {}): OrganiserStatNight =>
  ({ start: `${key}T${time}:00`, ...extra });
/** `count` weekly dates starting at `fromKey`, stepping `step` days. */
const series = (fromKey: string, count: number, step = 7, time = '20:00'): OrganiserStatNight[] =>
  Array.from({ length: count }, (_, i) => night(addDaysToKey(fromKey, i * step), time));

const ORDER: OrganiserStatKey[] = [
  'next_night', 'last_night', 'tickets_sold', 'dancers_came', 'nights_hosted',
  'weekly_rhythm', 'running_since', 'venues',
];

const run = (partial: Partial<OrganiserStatsInput>) => {
  const out = organiserStats({ now: NOW, nights: [], ...partial });
  expect(out.length).toBeLessThanOrEqual(MAX_ORGANISER_STATS);
  const idx = out.map((s) => ORDER.indexOf(s.key));
  expect(idx).toEqual([...idx].sort((a, b) => a - b));
  for (const s of out) {
    expect(s.value.trim()).not.toBe('');
    expect(s.value).not.toMatch(/^(0|--|-|n\/a|null|undefined|TBC)$/i);
    expect(s.value).not.toMatch(/^0\b/);
    expect(s.value).toMatch(/^[\x20-\x7e]+$/);
    expect(s.label.trim()).not.toBe('');
  }
  return out;
};
const keys = (partial: Partial<OrganiserStatsInput>) => run(partial).map((s) => s.key);
const stat = (partial: Partial<OrganiserStatsInput>, key: OrganiserStatKey) =>
  run(partial).find((s) => s.key === key);

describe('organiserStats: real shapes', () => {
  it('big ticketed organiser (221 dates, tickets >= 100): next night, tickets, nights hosted', () => {
    const nights = [...series('2023-01-05', 200), ...series('2026-11-12', 21)];
    const out = run({ nights, ticketsSold: 640, dancersCame: 80, foundedYear: 2019 });
    expect(out).toEqual([
      { key: 'next_night', value: 'Thu 12 Nov', label: 'Next night' },
      { key: 'tickets_sold', value: '500+', label: 'Tickets sold' },
      { key: 'nights_hosted', value: '200', label: 'Nights hosted' },
    ]);
  });

  it('small weekly class (35 past, 53 upcoming, Thursdays): next night, nights hosted, Thursdays', () => {
    const nights = [...series(addDaysToKey(TODAY, -35 * 7), 35), ...series(addDaysToKey(TODAY, 7), 53)];
    const out = run({ nights });
    expect(out.map((s) => [s.key, s.value])).toEqual([
      ['next_night', 'Thu 12 Nov'],
      ['nights_hosted', '35'],
      ['weekly_rhythm', 'Thursdays'],
    ]);
  });

  it('nothing upcoming but 14 past: last night, nights hosted, running since (inferred)', () => {
    const nights = series('2024-06-07', 14, 28); // Fridays every 4 weeks, ending 2025
    const out = run({ nights });
    expect(out.map((s) => [s.key, s.value])).toEqual([
      ['last_night', 'Fri 6 Jun'],
      ['nights_hosted', '14'],
      ['running_since', '~2 yrs'],
    ]);
    expect(out[2].title).toMatch(/Estimated/);
  });

  it('brand new organiser (1 upcoming): next night only', () => {
    expect(run({ nights: [night('2026-11-20')] }).map((s) => [s.key, s.value])).toEqual([['next_night', 'Fri 20 Nov']]);
  });

  it('no events at all: [] (strip hidden)', () => {
    expect(run({})).toEqual([]);
    expect(run({ nights: [], ticketsSold: null, dancersCame: null, foundedYear: null, venueNames: [] })).toEqual([]);
  });

  it('cancelled-only organiser: []', () => {
    const nights = series('2026-11-12', 6).map((n) => ({ ...n, cancelled: true }));
    expect(run({ nights: [...nights, night('2025-01-01', '20:00', { cancelled: true })] })).toEqual([]);
  });
});

describe('organiserStats: weekly rhythm', () => {
  it('4 scattered dates over 3 years: NO weekly rhythm', () => {
    const nights = ['2023-11-09', '2024-11-07', '2025-11-06', '2026-10-29'].map((k) => night(k));
    expect(keys({ nights })).not.toContain('weekly_rhythm');
  });

  it('exactly 4 on one weekday in 12 months plus 3 others (57%): NO', () => {
    const nights = [...series('2026-09-03', 4), night('2026-09-05'), night('2026-09-12'), night('2026-09-19')];
    expect(keys({ nights })).not.toContain('weekly_rhythm');
  });

  it('5 of 7 on one weekday (71%): yes', () => {
    const nights = [...series('2026-09-03', 5), night('2026-09-05'), night('2026-09-12')];
    expect(stat({ nights }, 'weekly_rhythm')?.value).toBe('Thursdays');
  });

  it('dates older than 12 months do not count', () => {
    const nights = series('2025-01-02', 8); // Thursdays Jan-Feb 2025
    expect(keys({ nights })).not.toContain('weekly_rhythm');
  });

  it('two events on the same date count once', () => {
    const nights = [...series('2026-10-08', 3), night('2026-10-08', '22:00'), night('2026-10-29', '23:00')];
    // 4 distinct Thursdays: qualifies; but 3 distinct + a duplicate would not.
    expect(stat({ nights }, 'weekly_rhythm')?.value).toBe('Thursdays');
    expect(keys({ nights: [...series('2026-10-08', 3), night('2026-10-08', '22:00')] })).not.toContain('weekly_rhythm');
  });
});

describe('organiserStats: thresholds and rounding', () => {
  it('tickets: 100 shows "100+", 99 never shows', () => {
    expect(stat({ ticketsSold: 100 }, 'tickets_sold')?.value).toBe('100+');
    expect(keys({ ticketsSold: 99 })).toEqual([]);
    expect(keys({ ticketsSold: 0 })).toEqual([]);
    expect(keys({ ticketsSold: null })).toEqual([]);
  });

  it('rounding steps: 100+, 250+, 500+, 1,000+, 2,500+', () => {
    expect([100, 249, 250, 499, 500, 999, 1000, 2600, 12345].map(roundedCount))
      .toEqual(['100+', '100+', '250+', '250+', '500+', '500+', '1,000+', '2,500+', '10,000+']);
    expect(roundedCount(99)).toBeNull();
    expect(roundedCount(Number.NaN)).toBeNull();
  });

  it('dancers came: absent, below threshold, at threshold', () => {
    expect(keys({})).not.toContain('dancers_came');
    expect(keys({ dancersCame: 99 })).not.toContain('dancers_came');
    expect(stat({ dancersCame: 260 }, 'dancers_came')?.value).toBe('250+');
  });

  it('nights hosted: 4 past never shows, 5 shows', () => {
    expect(keys({ nights: series('2026-06-01', 4, 30) })).not.toContain('nights_hosted');
    expect(stat({ nights: series('2026-05-01', 5, 30) }, 'nights_hosted')?.value).toBe('5');
  });

  it('nights hosted counts DISTINCT nights: 5 occurrences on 3 nights never shows, 5 distinct shows', () => {
    const three = ['2026-05-01', '2026-05-01', '2026-05-08', '2026-05-08', '2026-05-15'].map((d) => night(d));
    expect(keys({ nights: three })).not.toContain('nights_hosted');
    const five = [...three, night('2026-05-22'), night('2026-05-29')];
    expect(stat({ nights: five }, 'nights_hosted')?.value).toBe('5');
  });
});

describe('organiserStats: running since', () => {
  it('founded_year present wins over inferred', () => {
    expect(stat({ foundedYear: 2023, nights: [night('2021-03-01')] }, 'running_since')).toEqual(
      { key: 'running_since', value: 'Since 2023', label: 'Running' },
    );
  });

  it('inferred from first night more than a year ago, with "~"', () => {
    expect(stat({ nights: [night('2023-10-01')] }, 'running_since')?.value).toBe('~3 yrs');
    expect(stat({ nights: [night('2025-11-04')] }, 'running_since')?.value).toBe('~1 yr');
  });

  it('first night under a year ago: no running since', () => {
    expect(keys({ nights: [night('2025-11-06')] })).not.toContain('running_since');
  });

  it('junk founded_year falls back to inference', () => {
    expect(keys({ foundedYear: 2099 })).toEqual([]);
    expect(keys({ foundedYear: 0 })).toEqual([]);
    expect(stat({ foundedYear: 1200, nights: [night('2022-12-01')] }, 'running_since')?.value).toBe('~3 yrs');
  });
});

describe('organiserStats: venues', () => {
  it('exactly one distinct venue shows; zero or two do not', () => {
    expect(stat({ venueNames: ['Salsa Soho', ' Salsa Soho ', null, ''] }, 'venues')?.value).toBe('Salsa Soho');
    expect(keys({ venueNames: ['A', 'B'] })).toEqual([]);
    expect(keys({ venueNames: [null, ''] })).toEqual([]);
  });
});

describe('organiserStats: wording and day rollover', () => {
  it('upcoming today reads "Tonight", tomorrow "Tomorrow"', () => {
    expect(stat({ nights: [night(TODAY)] }, 'next_night')?.value).toBe('Tonight');
    expect(stat({ nights: [night('2026-11-06')] }, 'next_night')?.value).toBe('Tomorrow');
  });

  it('a 01:00 start belongs to the previous night', () => {
    expect(nightKeyOf('2026-11-06T01:00:00')).toBe('2026-11-05');
    expect(nightKeyOf('2026-11-06 07:59:00+00')).toBe('2026-11-05');
    expect(nightKeyOf('2026-11-06T08:00:00')).toBe('2026-11-06');
    expect(nightKeyOf('2026-11-06')).toBe('2026-11-06');
    expect(nightKeyOf('garbage')).toBeNull();
    expect(nightKeyOf('2026-02-30T20:00:00')).toBeNull();
    expect(stat({ nights: [night('2026-11-06', '01:00')] }, 'next_night')?.value).toBe('Tonight');
  });

  it('at 01:00 London, last night is still "Tonight"', () => {
    const at1am = new Date('2026-11-06T01:00:00Z');
    expect(nowNightKey(at1am)).toBe('2026-11-05');
    const out = organiserStats({ now: at1am, nights: [night('2026-11-05', '22:00')] });
    expect(out[0]).toMatchObject({ key: 'next_night', value: 'Tonight' });
    const out2 = organiserStats({ now: at1am, nights: [night('2026-11-06', '21:00')] });
    expect(out2[0]).toMatchObject({ key: 'next_night', value: 'Tomorrow' });
  });

  it('yesterday inside the server grace window (isPast false) is never "Tonight"', () => {
    const out = organiserStats({ now: new Date('2026-11-06T09:00:00Z'), nights: [night('2026-11-05', '21:00', { isPast: false })] });
    expect(out.map((s) => s.key)).not.toContain('next_night');
    expect(out[0]).toMatchObject({ key: 'last_night', value: 'Thu 5 Nov' });
  });

  it('BST: 00:30 London (23:30 UTC) is still the previous night', () => {
    expect(nowNightKey(new Date('2026-07-09T23:30:00Z'))).toBe('2026-07-09');
    expect(nowNightKey(new Date('2026-07-10T07:30:00Z'))).toBe('2026-07-10');
  });

  it("the server's is_past flag wins over the date split", () => {
    const out = run({ nights: [night(TODAY, '19:00', { isPast: true })] });
    expect(out[0]).toMatchObject({ key: 'last_night', value: 'Thu 5 Nov' });
  });
});
