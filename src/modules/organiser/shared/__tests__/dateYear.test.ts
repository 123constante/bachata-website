/**
 * Every organiser date label names the year when the date is not in the
 * current (London) year, so 'Listed until Wednesday 6 October' can never mean a date a
 * year away. Table-driven over the label helpers the organiser screens use.
 */
import { describe, expect, it } from 'vitest';
import { dateLabel } from '../homeModel';
import { endedOnLabel } from '../eventState';
import { instantDateLabel } from '../teamModel';
import { shortDate as homeShortDate } from '../../home/homeView';
import { askedOn } from '../../home/onboarding/onboardingModel';
import { londonDateParts } from '../../ui/londonDate';

const TODAY = '2026-10-08';
const NOW = new Date('2026-10-08T10:00:00Z');

describe('calendar-date labels', () => {
  it.each([
    ['this year', '2026-11-14', 'Saturday 14 November'],
    ['next year (the owner case)', '2027-10-06', 'Wednesday 6 October 2027'],
    ['next January', '2027-01-06', 'Wednesday 6 January 2027'],
    ['last year', '2025-12-31', 'Wednesday 31 December 2025'],
  ])('dateLabel: %s', (_name, date, want) => {
    expect(dateLabel(date, TODAY)).toBe(want);
  });

  it('dateLabel keeps Tonight for today', () => expect(dateLabel(TODAY, TODAY)).toBe('Tonight'));

  it.each([
    ['this year', '2026-11-28', 'Saturday 28 November'],
    ['across New Year', '2027-01-09', 'Saturday 9 January 2027'],
  ])('Home runway strip date: %s', (_name, date, want) => {
    expect(homeShortDate(date, TODAY)).toBe(want);
  });

  it.each([
    ['this year', '2026-09-05', 'Ended on Saturday 5 September'],
    ['last year', '2025-09-06', 'Ended on Saturday 6 September 2025'],
  ])('Ended on: %s', (_name, date, want) => {
    expect(endedOnLabel('ended', date, TODAY)).toBe(want);
  });
});

describe('instant labels (asked / joined)', () => {
  it.each([
    ['this year', '2026-10-01T10:00:00Z', false],
    ['last year', '2025-11-03T10:00:00Z', true],
  ])('instantDateLabel: %s', (_name, iso, hasYear) => {
    expect(/2025/.test(instantDateLabel(iso, NOW) ?? '')).toBe(hasYear);
  });

  it.each([
    ['this year', '2026-10-06T10:00:00Z', 'Tuesday 6 October'],
    ['last year', '2025-10-06T10:00:00Z', 'Monday 6 October 2025'],
  ])('askedOn: %s', (_name, iso, want) => {
    expect(askedOn(iso, NOW)).toBe(want);
  });
});

describe('date tiles (DateChip parts)', () => {
  it.each([
    ['this year', '2026-12-30', null, 'Wednesday 30 December'],
    ['next year', '2027-01-06', '2027', 'Wednesday 6 January 2027'],
  ])('londonDateParts: %s', (_name, date, year, label) => {
    const parts = londonDateParts(date, TODAY);
    expect(parts.year).toBe(year);
    expect(parts.label).toBe(label);
  });
});
