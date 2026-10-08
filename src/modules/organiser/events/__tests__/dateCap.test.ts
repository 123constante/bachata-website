import { describe, expect, it } from 'vitest';
import { CAP_NOTE, MAX_UPCOMING, allowedEndChoices, endWithinCap, extendStep, maxRuleEnd, upcomingCount, weeklyDates } from '../dateCap';

// Thursday 8 Oct 2026; the event starts Friday 9 Oct.
const base = { today: '2026-10-08', startDate: '2026-10-09' };

describe('the 30-upcoming-dates cap', () => {
  it('says it plainly', () => {
    expect(CAP_NOTE).toBe('Up to 30 upcoming dates');
    expect(MAX_UPCOMING).toBe(30);
  });

  it('counts weekly dates on the start weekday', () => {
    expect(weeklyDates('2026-10-08', '2026-10-30', 5)).toEqual(['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
    expect(upcomingCount(base, '2026-10-30')).toBe(4);
  });

  it('offers only end choices that stay within 30 upcoming dates, the largest being exactly 30', () => {
    const choices = allowedEndChoices(base);
    expect(choices.map((c) => c.count)).toEqual([4, 8, 12, 16, 26, 30]);
    choices.forEach((c) => {
      expect(upcomingCount(base, c.until)).toBe(c.count);
      expect(endWithinCap(base, c.until)).toBe(true);
    });
    expect(choices[choices.length - 1].until).toBe('2027-04-30');
  });

  it('counts hand-added upcoming dates toward the cap', () => {
    const choices = allowedEndChoices({ ...base, otherUpcoming: 10 });
    expect(choices.map((c) => c.count)).toEqual([4, 8, 12, 16, 20]);
    expect(allowedEndChoices({ ...base, otherUpcoming: 30 })).toEqual([]);
  });

  it('refuses an end past 30 dates or before today', () => {
    expect(endWithinCap(base, '2027-04-30')).toBe(true);
    expect(endWithinCap(base, '2027-05-07')).toBe(false);
    expect(endWithinCap(base, '2026-10-01')).toBe(false);
  });

  it('counts from today for a series that started in the past', () => {
    const started = { today: '2026-10-08', startDate: '2026-01-02' };
    expect(upcomingCount(started, '2026-10-16')).toBe(2);
    expect(allowedEndChoices(started)[0]).toEqual({ count: 4, until: '2026-10-30' });
  });

  it('never offers past the server\u2019s 12-month bound', () => {
    expect(maxRuleEnd('2026-10-08')).toBe('2027-10-08');
    expect(maxRuleEnd('2028-02-29')).toBe('2029-02-28');
  });

  it('Extend adds the next batch of 8 within the cap', () => {
    expect(extendStep(base, '2026-11-27')).toEqual({ add: 8, until: '2027-01-22' });
    // 26 listed: only 4 more fit.
    const at26 = allowedEndChoices(base).find((c) => c.count === 26)!.until;
    expect(extendStep(base, at26)).toEqual({ add: 4, until: '2027-04-30' });
    // Already 30: nothing.
    expect(extendStep(base, '2027-04-30')).toBeNull();
  });

  it('Extend on a run that has no end inside the window starts from the first upcoming date', () => {
    expect(extendStep(base, null)).toEqual({ add: 8, until: '2026-11-27' });
    expect(extendStep({ ...base, otherUpcoming: 27 }, null)).toEqual({ add: 3, until: '2026-10-23' });
  });
});
