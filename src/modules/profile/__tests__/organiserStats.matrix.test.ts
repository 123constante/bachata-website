/**
 * organiserStats x every organiser shape prod holds. Read-only survey
 * 2026-11-05 (prod stsdtacfauprzrdebmzg, event_occurrence_p5 joined to
 * event_series_organiser_p5, counts only): 50 organisers; 2 with no nights at
 * all; 31 with an upcoming night; 17 with past nights only; 31 with 5+ past
 * nights; up to 262 dates on one organiser; 8 with a founded_year. The strip offers
 * only next night, nights hosted and running since (owner decision 5, 2026-11-06).
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

const ORDER: OrganiserStatKey[] = ['next_night', 'nights_hosted', 'running_since'];

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

const BANNED = /week|sunday|monday|tuesday|wednesday|thursday|friday|saturday|last night|ticket|dancers|venue/i;

// Shapes fixed at NOW (Thu 5 Nov 2026). The first row is the owner's FK Dance-like screenshot shape.
const SHAPES: Array<[string, Partial<OrganiserStatsInput>, Array<[OrganiserStatKey, string]>]> = [
  ['weekly organiser, 30 past inside a year, upcoming, no founded year',
    { nights: [...series(addDaysToKey(TODAY, -30 * 7), 30), ...series('2026-11-08', 10)] },
    [['next_night', 'Sun 8 Nov'], ['nights_hosted', '30']]],
  ['same with founded_year 2019',
    { nights: [...series(addDaysToKey(TODAY, -30 * 7), 30), ...series('2026-11-08', 10)], foundedYear: 2019 },
    [['next_night', 'Sun 8 Nov'], ['nights_hosted', '30'], ['running_since', 'Since 2019']]],
  ['new organiser, 1 upcoming, 0 past', { nights: [night('2026-11-20')] }, [['next_night', 'Fri 20 Nov']]],
  ['4 past with upcoming', { nights: [...series('2026-09-01', 4, 7), night('2026-11-20')] }, [['next_night', 'Fri 20 Nov']]],
  ['ended organiser, 12 past, nothing upcoming', { nights: series('2026-06-01', 12, 7) }, [['nights_hosted', '12']]],
  ['ended organiser, 2 past, founded 2019', { nights: series('2026-06-01', 2, 7), foundedYear: 2019 }, [['running_since', 'Since 2019']]],
  ['no data, no founded year', {}, []],
  ['cancelled-only and unparseable starts',
    { nights: [...series('2026-11-12', 6).map((n) => ({ ...n, cancelled: true })), { start: 'garbage' }, { start: null }] }, []],
];

describe('organiserStats: real shapes (three-stat rule)', () => {
  it.each(SHAPES)('%s', (_name, input, expected) => {
    const out = run(input);
    expect(out.map((s) => [s.key, s.value])).toEqual(expected);
  });

  it('no row ever shows weekly, last-night, ticket, dancer or venue wording', () => {
    for (const [name, input] of SHAPES) {
      for (const s of run(input)) {
        expect(s.label, name).not.toMatch(BANNED);
        if (s.key !== 'next_night') expect(s.value, name).not.toMatch(BANNED);
      }
    }
  });

  it('nothing upcoming never falls back to a Last night stat', () => {
    expect(keys({ nights: series('2026-06-01', 12, 7) })).not.toContain('next_night');
    expect(keys({ nights: [night('2026-11-04')] })).toEqual([]);
  });

  it('the candidate set is exactly next_night, nights_hosted, running_since', () => {
    expect(ORDER).toEqual(['next_night', 'nights_hosted', 'running_since']);
  });
});

describe('organiserStats: nights hosted threshold', () => {
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
    expect(out).toEqual([]);
  });

  it('BST: 00:30 London (23:30 UTC) is still the previous night', () => {
    expect(nowNightKey(new Date('2026-07-09T23:30:00Z'))).toBe('2026-07-09');
    expect(nowNightKey(new Date('2026-07-10T07:30:00Z'))).toBe('2026-07-10');
  });

  it("the server's is_past flag wins over the date split", () => {
    const out = run({ nights: [night(TODAY, '19:00', { isPast: true })] });
    expect(out.map((s) => s.key)).not.toContain('next_night');
  });
});
