import { describe, expect, it } from 'vitest';
import {
  londonDateKey,
  londonTodayKey,
  londonDaysFromToday,
  londonDaysFromTodayForKey,
  londonDaysBetweenKeys,
  weekdayOfKey,
  addDaysToKey,
  londonDayRangeUtc,
  londonWallClockToInstant,
  isRealDateKey,
  clampRangeEndKey,
  formatKeyRange,
  dateKeyInTz,
} from '@/lib/londonDate';

// All helpers must be independent of the machine timezone (they compute on
// the London calendar via Intl/UTC only). CI runs this file under a TZ
// matrix (Europe/London, America/New_York, Australia/Sydney) to prove it —
// every expectation below is an absolute value, not a relative one.

// 2026-07-02 is a Thursday. BST (UTC+1) runs 29 Mar to 25 Oct 2026.
const BST_MORNING = new Date('2026-07-02T06:27:00Z'); // 07:27 London
const BST_AFTER_LONDON_MIDNIGHT = new Date('2026-07-01T23:30:00Z'); // 00:30 London, 2 Jul
const GMT_EVENING = new Date('2026-01-15T23:30:00Z'); // 23:30 London, 15 Jan

describe('londonDateKey / londonTodayKey', () => {
  it('uses the London calendar, not UTC, during BST', () => {
    expect(londonDateKey(BST_AFTER_LONDON_MIDNIGHT)).toBe('2026-07-02');
    expect(londonTodayKey(BST_AFTER_LONDON_MIDNIGHT)).toBe('2026-07-02');
  });

  it('matches UTC during GMT', () => {
    expect(londonDateKey(GMT_EVENING)).toBe('2026-01-15');
  });
});

describe('londonDaysFromTodayForKey', () => {
  it('is 0 for today, 1 for tomorrow, negative for the past', () => {
    expect(londonDaysFromTodayForKey('2026-07-02', BST_MORNING)).toBe(0);
    expect(londonDaysFromTodayForKey('2026-07-03', BST_MORNING)).toBe(1);
    expect(londonDaysFromTodayForKey('2026-07-01', BST_MORNING)).toBe(-1);
    expect(londonDaysFromTodayForKey('2026-07-09', BST_MORNING)).toBe(7);
  });

  it('treats the 00:00\u201301:00 London BST window as the new day (UTC date is still yesterday)', () => {
    // The regression that produced "in -1 days": a UTC-date-based diff says 1 here.
    expect(londonDaysFromTodayForKey('2026-07-02', BST_AFTER_LONDON_MIDNIGHT)).toBe(0);
    expect(londonDaysFromTodayForKey('2026-07-01', BST_AFTER_LONDON_MIDNIGHT)).toBe(-1);
  });

  it('crosses the GMT/BST transition without drift', () => {
    const beforeTransition = new Date('2026-03-28T12:00:00Z'); // GMT Saturday
    expect(londonDaysFromTodayForKey('2026-03-29', beforeTransition)).toBe(1); // 23h day
    expect(londonDaysFromTodayForKey('2026-04-04', beforeTransition)).toBe(7);
  });
});

describe('londonDaysFromToday (instant variant)', () => {
  it('measures both instants on the London calendar', () => {
    // 23:30 UTC on 1 Jul is already 2 Jul in London — same London day as BST_MORNING.
    expect(londonDaysFromToday(BST_AFTER_LONDON_MIDNIGHT, BST_MORNING)).toBe(0);
  });
});

describe('weekdayOfKey', () => {
  it('returns the calendar weekday regardless of machine timezone', () => {
    expect(weekdayOfKey('2026-07-02')).toBe(4); // Thursday
    expect(weekdayOfKey('2026-07-03')).toBe(5); // Friday
    expect(weekdayOfKey('2026-07-05')).toBe(0); // Sunday
  });
});

describe('addDaysToKey', () => {
  it('handles month, year and DST boundaries', () => {
    expect(addDaysToKey('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-28', 1)).toBe('2026-03-29'); // into the 23h spring-forward day
    expect(addDaysToKey('2026-07-02', 28)).toBe('2026-07-30');
    expect(addDaysToKey('2026-07-02', -1)).toBe('2026-07-01');
  });
});

describe('londonDayRangeUtc', () => {
  it('maps a BST London day to a UTC range starting at 23:00Z the day before', () => {
    const { start, end } = londonDayRangeUtc('2026-07-02');
    expect(start.toISOString()).toBe('2026-07-01T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-02T23:00:00.000Z');
  });

  it('maps a GMT London day to plain UTC midnights', () => {
    const { start, end } = londonDayRangeUtc('2026-01-15');
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-16T00:00:00.000Z');
  });

  it('gives the spring-forward day 23 hours and the fall-back day 25', () => {
    const spring = londonDayRangeUtc('2026-03-29');
    expect(spring.start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(spring.end.toISOString()).toBe('2026-03-29T23:00:00.000Z');

    const fall = londonDayRangeUtc('2026-10-25');
    expect(fall.start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(fall.end.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('spans multi-day windows half-open', () => {
    const { start, end } = londonDayRangeUtc('2026-07-02', 28);
    expect(start.toISOString()).toBe('2026-07-01T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-29T23:00:00.000Z'); // start of 30 Jul, London
  });
});

describe('londonDaysBetweenKeys', () => {
  it('diffs two calendar keys', () => {
    expect(londonDaysBetweenKeys('2026-07-02', '2026-07-02')).toBe(0);
    expect(londonDaysBetweenKeys('2026-07-02', '2026-07-01')).toBe(-1);
    expect(londonDaysBetweenKeys('2026-07-02', '2026-08-01')).toBe(30);
  });
});

describe('londonWallClockToInstant', () => {
  it('shifts a BST wall-clock-as-Z string back to the true instant', () => {
    // 20:00 on the London clock during BST actually happens at 19:00Z.
    expect(londonWallClockToInstant('2026-07-02 20:00:00+00')?.toISOString()).toBe(
      '2026-07-02T19:00:00.000Z',
    );
  });

  it('is identity during GMT', () => {
    expect(londonWallClockToInstant('2026-01-15 20:00:00')?.toISOString()).toBe(
      '2026-01-15T20:00:00.000Z',
    );
  });

  it('returns null for empty/invalid input', () => {
    expect(londonWallClockToInstant(null)).toBeNull();
    expect(londonWallClockToInstant('not a date')).toBeNull();
  });
});

describe('key-derivation input hardening (regression: BACHATA-WEBSITE-2W)', () => {
  // A runtime with incomplete Intl/ICU data can feed a malformed key into the
  // key-based helpers. That used to propagate NaN → `new Date(NaN)` and throw
  // `RangeError: Invalid time value` during render. The safeKeyParts boundary
  // must degrade to a valid range instead of ever throwing.
  const hostile = ['', 'not-a-date', '2026-7-2', '2026-13-40', undefined, null] as unknown as string[];

  it('londonDayRangeUtc never throws and always yields valid Dates', () => {
    for (const key of hostile) {
      expect(() => londonDayRangeUtc(key, 7)).not.toThrow();
      const { start, end } = londonDayRangeUtc(key, 7);
      expect(Number.isNaN(start.getTime())).toBe(false);
      expect(Number.isNaN(end.getTime())).toBe(false);
      // The half-open window still spans the requested number of days.
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    }
  });

  it('addDaysToKey / weekdayOfKey / londonDaysBetweenKeys never emit Invalid Date', () => {
    for (const key of hostile) {
      expect(() => addDaysToKey(key, 1)).not.toThrow();
      expect(addDaysToKey(key, 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(() => weekdayOfKey(key)).not.toThrow();
      expect(Number.isNaN(weekdayOfKey(key))).toBe(false);
      expect(() => londonDaysBetweenKeys(key, key)).not.toThrow();
    }
  });

  it('still computes correctly for well-formed keys (guard is transparent)', () => {
    const { start } = londonDayRangeUtc('2026-01-15');
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(addDaysToKey('2026-07-31', 1)).toBe('2026-08-01');
  });
});

describe('isRealDateKey', () => {
  it('accepts real calendar keys, including leap days', () => {
    expect(isRealDateKey('2027-03-26')).toBe(true);
    expect(isRealDateKey('2028-02-29')).toBe(true); // 2028 is a leap year
  });

  it('rejects malformed shapes and impossible calendar dates', () => {
    expect(isRealDateKey('not-a-date')).toBe(false);
    expect(isRealDateKey('2027-13-05')).toBe(false); // 13th month
    expect(isRealDateKey('2027-02-30')).toBe(false); // rolls into March
    expect(isRealDateKey('2027-02-29')).toBe(false); // 2027 is not a leap year
    expect(isRealDateKey('2027-03-28T00:00:00')).toBe(false); // timestamp, not a key
  });
});

describe('clampRangeEndKey', () => {
  it('keeps a valid forward end key', () => {
    expect(clampRangeEndKey('2027-03-26', '2027-03-29')).toBe('2027-03-29');
  });

  it('collapses missing, reversed or unreal end keys to the start day', () => {
    expect(clampRangeEndKey('2027-03-26', null)).toBe('2027-03-26');
    expect(clampRangeEndKey('2027-03-26', '2027-03-20')).toBe('2027-03-26');
    expect(clampRangeEndKey('2027-03-26', '2027-13-05')).toBe('2027-03-26');
  });
});

describe('formatKeyRange', () => {
  it('renders the long (hero) style across same-month, cross-month and cross-year spans', () => {
    expect(formatKeyRange('2027-03-26', '2027-03-29', 'long')).toBe('Fri 26 \u2013 Mon 29 March 2027');
    expect(formatKeyRange('2026-02-28', '2026-03-02', 'long')).toBe(
      'Sat 28 February \u2013 Mon 2 March 2026',
    );
    expect(formatKeyRange('2026-12-30', '2027-01-02', 'long')).toBe(
      'Wed 30 December 2026 \u2013 Sat 2 January 2027',
    );
  });

  it('renders the short (share) style with the month on both sides', () => {
    expect(formatKeyRange('2027-03-26', '2027-03-29', 'short')).toBe('26 Mar \u2013 29 Mar 2027');
    expect(formatKeyRange('2026-12-30', '2027-01-02', 'short')).toBe('30 Dec 2026 \u2013 2 Jan 2027');
  });

  it('collapses single days, missing ends and bad end keys to one date', () => {
    expect(formatKeyRange('2026-05-24', '2026-05-24', 'long')).toBe('Sun 24 May 2026');
    expect(formatKeyRange('2026-05-24', null, 'short')).toBe('24 May 2026');
    expect(formatKeyRange('2026-05-24', '2026-05-20', 'long')).toBe('Sun 24 May 2026');
  });

  it('returns null for a missing or unreal start key', () => {
    expect(formatKeyRange(null, '2027-03-29', 'long')).toBeNull();
    expect(formatKeyRange('2027-02-30', '2027-03-01', 'long')).toBeNull();
  });
});

describe('dateKeyInTz timezone fallback', () => {
  // 22:30Z on 13 Jun 2026: London (BST, +1) is still the 13th, Sydney (+10) is
  // already the 14th, New York (-4) is the 13th. Under the TZ matrix in this
  // file's header, the Sydney leg is what makes the missing-tz case a REAL
  // regression test rather than a tautology -- on a London runner, "fell back
  // to London" and "used the runtime zone" are indistinguishable, which is
  // exactly how the original defect passed review.
  const instant = new Date('2026-06-13T22:30:00Z');

  it('resolves a real zone on that zone calendar', () => {
    expect(dateKeyInTz(instant, 'Europe/London')).toBe('2026-06-13');
    expect(dateKeyInTz(instant, 'Australia/Sydney')).toBe('2026-06-14');
  });

  it('falls back to London for an INVALID zone (Intl throws, catch fires)', () => {
    // `null` and `''` belong HERE, not with the undefined case below: both
    // stringify to something Intl rejects, so they throw RangeError exactly like
    // 'Not/AZone' and are caught by the same catch. Grouping them with `undefined`
    // overstated that test's reach 3x -- two of its three legs passed even without
    // the normalisation they claimed to cover.
    expect(dateKeyInTz(instant, 'Not/AZone')).toBe('2026-06-13');
    expect(dateKeyInTz(instant, null as unknown as string)).toBe('2026-06-13');
    expect(dateKeyInTz(instant, '')).toBe('2026-06-13');
  });

  it('falls back to London for an UNDEFINED zone (Intl does NOT throw)', () => {
    // The one leg the catch cannot save, and so the only one that actually
    // exercises the `timeZone || LONDON_TZ` normalisation:
    // `new Intl.DateTimeFormat('en-CA', { timeZone: undefined })` resolves to the
    // RUNTIME zone silently. Without the normalisation a Sydney visitor would get
    // 2026-06-14 -- today on their own browser calendar, from the module whose
    // entire job is to stop that.
    //
    // No call site can currently deliver `undefined` (both useTodayKey callers
    // default it), so this guards the `strict: false` gap in the signature rather
    // than a defect that shipped.
    expect(dateKeyInTz(instant, undefined as unknown as string)).toBe('2026-06-13');
  });
});
