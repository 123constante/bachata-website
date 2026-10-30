import { describe, expect, it } from 'vitest';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';
import { DATE_WHY, dateActions } from '../../model';
import { REPEAT_COPY, noRuleNote, repeatAccess, repeatWords } from '../../model/repeat';
import { dateEntries, dateFactsOf, repeatShapeOf, seriesFactsOf } from '../dates';
import { TODAY, occ, program, weekly, wsRaw } from '../../screens/__tests__/wsFixtures';

/*
 * p3-prefix-c: a recurring series with NO stored rule must never read "Doesn't repeat", and a
 * break (removed_dates) shows on any series. Skip and "Put this week back" per rule shape. Shapes
 * from the read-only prod survey of 30 Oct 2026 (counts only): 9 live + 13 ended `recurring`
 * series with a NULL rule, all legacy imports; most live ones have dates 3-16 weeks apart at
 * random, one runs every 2 weeks, the ended ones mostly weekly with breaks.
 */

const P = program([]);
const ws = (series: Record<string, unknown>, dates: string[], cancelled: string[] = []): EventWorkspace =>
  parseEventWorkspace(wsRaw(series, P, dates.map((d) => occ(d, cancelled.includes(d) ? 'cancelled' : 'scheduled'))))!;

export const NULL_SHAPES = {
  weeklyRule: ws({ removed_dates: ['2026-11-12'] }, weekly('2026-10-16', 6)),
  monthlyRule: ws({ recurrence_rule: { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: 1, weekday: 6 }, end: { kind: 'none' } }, removed_dates: ['2026-12-05'] },
    ['2026-10-03', '2026-11-07', '2027-01-02']),
  fortnightlyRule: ws({ recurrence_rule: { mode: 'weekly', weekdays: [5], interval: 2, end: { kind: 'none' } }, removed_dates: ['2026-11-13'] }, ['2026-10-16', '2026-10-30', '2026-11-27']),
  nullWeeklyDates: ws({ recurrence_rule: null, removed_dates: ['2026-11-06'] }, ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-13', '2026-11-20'], ['2026-10-23']),
  nullFortnightly: ws({ recurrence_rule: null }, weekly('2026-09-18', 6).filter((_, i) => i % 2 === 0).concat(['2026-10-30', '2026-11-13'])),
  nullLoose: ws({ recurrence_rule: null, removed_dates: ['2026-11-27'] }, ['2026-09-04', '2026-10-02', '2026-11-06', '2026-12-18']),
  nullOneOff: ws({ recurrence_rule: null, format: 'one_off' }, ['2026-11-06']),
  endedNullWeekly: ws({ recurrence_rule: null, lifecycle_status: 'ended', removed_dates: ['2026-08-21'] }, ['2026-08-07', '2026-08-14', '2026-08-28', '2026-09-04']),
};
type Shape = keyof typeof NULL_SHAPES;

const skipWhy = (w: EventWorkspace, date: string) => {
  const d = w.dates.find((x) => x.occurrence_date === date)!;
  return dateActions(seriesFactsOf(w, TODAY), dateFactsOf(w, d), TODAY).find((r) => r.action === 'skip')!.reason;
};
const breakRow = (w: EventWorkspace, date: string) => dateEntries(w, TODAY).find((e) => e.date === date && e.facts.state === 'skip') ?? null;
const unskipWhy = (w: EventWorkspace, date: string) => {
  const e = breakRow(w, date);
  return e ? dateActions(seriesFactsOf(w, TODAY), e.facts, TODAY)[0].reason : 'HIDDEN';
};

describe('Skip on a coming date, per rule shape', () => {
  it.each<[Shape, string, string | null]>([
    ['weeklyRule', '2026-10-30', null],
    ['monthlyRule', '2026-11-07', DATE_WHY.noPattern],
    ['fortnightlyRule', '2026-10-30', DATE_WHY.cantCheck],
    ['nullWeeklyDates', '2026-10-30', null],
    ['nullFortnightly', '2026-11-13', null],
    ['nullLoose', '2026-11-06', DATE_WHY.noDatesPattern],
    ['nullOneOff', '2026-11-06', DATE_WHY.oneOffNoBreak],
    ['endedNullWeekly', '2026-09-04', DATE_WHY.closed],
  ])('%s %s', (shape, date, why) => {
    expect(skipWhy(NULL_SHAPES[shape], date)).toBe(why);
  });
  it('a NULL rule with plain weekly dates can skip any coming date', () => {
    const w = ws({ recurrence_rule: null }, ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13']);
    expect(skipWhy(w, '2026-10-30')).toBeNull();
  });
});

describe('every break shows, whatever the rule, and says whether it can come back', () => {
  it.each<[Shape, string, string | null]>([
    ['weeklyRule', '2026-11-12', DATE_WHY.unskipOffRule],
    ['monthlyRule', '2026-12-05', DATE_WHY.unskipCantCheck],
    ['fortnightlyRule', '2026-11-13', DATE_WHY.unskipCantCheck],
    ['nullWeeklyDates', '2026-11-06', null],
    ['nullLoose', '2026-11-27', null],
    ['endedNullWeekly', '2026-08-21', DATE_WHY.closed],
  ])('%s %s', (shape, date, why) => {
    expect(unskipWhy(NULL_SHAPES[shape], date)).toBe(why);
  });
});

describe('ONE mapping: the Repeats row, the Repeat sheet and its note never say a recurring series does not repeat', () => {
  const access = (w: EventWorkspace) => repeatAccess({ format: w.series.format, lifecycle: w.series.lifecycle_status, rule: w.series.recurrence_rule }).mode;
  it.each<[Shape, string, string | null, string]>([
    ['weeklyRule', 'Every Friday, keeps going.', null, 'edit'],
    ['monthlyRule', 'Every month on the first Saturday, keeps going.', null, 'edit'],
    ['fortnightlyRule', 'Every 2 weeks on Friday, keeps going.', null, 'edit'],
    ['nullWeeklyDates', 'Every Friday, going by its dates. No pattern is saved.', 'No pattern is saved; its dates run every Friday. Pick the days to save it as a pattern.', 'edit'],
    ['nullFortnightly', 'Every 2 weeks on Friday, going by its dates. No pattern is saved.', 'No pattern is saved; its dates run every 2 weeks on Friday. Pick the days to save it as a pattern.', 'edit'],
    ['nullLoose', 'No pattern is saved, so each date is set on its own.', 'No pattern is saved, so each date is set on its own. Pick the days to save a pattern, or change single dates under Coming up.', 'edit'],
    ['nullOneOff', 'Doesn\u2019t repeat', REPEAT_COPY.noRule, 'none'],
    ['endedNullWeekly', 'Every Friday, going by its dates. No pattern is saved.', 'No pattern is saved; its dates run every Friday. Pick the days to save it as a pattern.', 'readonly'],
  ])('%s', (shape, words, note, mode) => {
    const w = NULL_SHAPES[shape];
    expect(repeatWords(repeatShapeOf(w), TODAY)).toBe(words);
    expect(noRuleNote(repeatShapeOf(w))).toBe(note);
    expect(access(w)).toBe(mode);
  });
  it('no recurring series reads "Doesn\u2019t repeat"', () => {
    for (const [name, w] of Object.entries(NULL_SHAPES)) {
      if (w.series.format === 'recurring') expect(repeatWords(repeatShapeOf(w), TODAY), name).not.toMatch(/repeat/i);
    }
  });
});
