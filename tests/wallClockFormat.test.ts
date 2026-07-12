import { describe, expect, it } from 'vitest';
import {
  asWallClock,
  asInstant,
  formatWallClockTime,
  formatWallClockDate,
  formatWallClockDateTime,
  formatWallClockLocal,
  formatWallClockLocalIntl,
  wallClockDateKey,
  wallClockDurationMinutes,
  wallClockHour,
  wallClockToInstant,
  instantToDate,
} from '@/lib/time/wallClock';
import { londonWallClockToInstant } from '@/lib/londonDate';

// Times are stored "local-as-UTC": the digits ARE the London wall clock, tagged
// with a +00 offset that must NOT be treated as a real instant on display.
// Every expectation below is an absolute value, so this suite is independent of
// the machine timezone (CI runs it under a TZ matrix, like londonDate.test.ts).
// BST (UTC+1) runs 29 Mar - 25 Oct 2026; January is GMT (UTC+0).

const BST_EVENING = asWallClock('2026-07-15T20:30:00+00'); // London 20:30, 15 Jul (Wed)
const GMT_EVENING = asWallClock('2026-01-15T20:30:00+00'); // London 20:30, 15 Jan (Thu)
const BST_NEAR_MIDNIGHT = asWallClock('2026-07-15T23:30:00+00'); // still 15 Jul in London
const NEXT_DAY_EARLY = asWallClock('2026-07-16T00:30:00+00'); // 16 Jul in London

describe('formatWallClockTime', () => {
  it('renders as-stored, offset-invariant across BST and GMT', () => {
    // The proof the whole boundary exists for: identical digits -> identical
    // output regardless of season. A `new Date(...).toLocaleTimeString()` would
    // show the BST one an hour late.
    expect(formatWallClockTime(BST_EVENING)).toBe('8:30 PM');
    expect(formatWallClockTime(GMT_EVENING)).toBe('8:30 PM');
  });

  it('drops :00 minutes and handles the 12h edges', () => {
    expect(formatWallClockTime(asWallClock('2026-07-15T19:00:00+00'))).toBe('7 PM');
    expect(formatWallClockTime(asWallClock('2026-07-15T00:00:00+00'))).toBe('12 AM');
    expect(formatWallClockTime(asWallClock('2026-07-15T12:00:00+00'))).toBe('12 PM');
  });

  it('supports 24h output', () => {
    expect(formatWallClockTime(BST_EVENING, { hour12: false })).toBe('20:30');
  });

  it('returns null for nullish input', () => {
    expect(formatWallClockTime(null)).toBeNull();
    expect(formatWallClockTime(undefined)).toBeNull();
  });
});

describe('formatWallClockDate', () => {
  it('reads the stored calendar day with no timezone shift', () => {
    expect(formatWallClockDate(BST_EVENING)).toBe('Wed 15 Jul');
    // Near-midnight must keep its stored date -- the wrong-day symptom.
    expect(formatWallClockDate(BST_NEAR_MIDNIGHT)).toBe('Wed 15 Jul');
    expect(formatWallClockDate(NEXT_DAY_EARLY)).toBe('Thu 16 Jul');
  });

  it('returns null for nullish input', () => {
    expect(formatWallClockDate(null)).toBeNull();
  });
});

describe('formatWallClockDateTime', () => {
  it('composes date and time', () => {
    expect(formatWallClockDateTime(BST_EVENING)).toBe('Wed 15 Jul, 8:30 PM');
  });
});

describe('formatWallClockLocal / formatWallClockLocalIntl', () => {
  // These back buildEventPageModel's schedule labels. Machine-tz independent:
  // the internal Date is built from the wall-clock LOCAL fields, so local
  // formatters (date-fns / Intl-without-tz) round-trip the stored value.
  it('date-fns patterns render the stored wall clock', () => {
    expect(formatWallClockLocal(BST_EVENING, 'EEEE, d MMMM yyyy')).toBe('Wednesday, 15 July 2026');
    expect(formatWallClockLocal(BST_EVENING, 'h:mm a')).toBe('8:30 PM');
    // Date-only value -> midnight; date part still reads as stored.
    expect(formatWallClockLocal(asWallClock('2026-07-16'), 'EEEE, d MMMM yyyy')).toBe('Thursday, 16 July 2026');
  });

  it('Intl short-date renders the stored wall clock', () => {
    expect(
      formatWallClockLocalIntl(BST_EVENING, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    ).toBe('Wed, 15 Jul 2026');
    expect(formatWallClockLocal(null, 'h:mm a')).toBeNull();
  });
});

describe('wallClockDateKey', () => {
  it('is the YYYY-MM-DD prefix, near-midnight safe', () => {
    expect(wallClockDateKey(BST_NEAR_MIDNIGHT)).toBe('2026-07-15');
    expect(wallClockDateKey(NEXT_DAY_EARLY)).toBe('2026-07-16');
  });
});

describe('wallClockHour', () => {
  it('reads the stored hour, offset-invariant across BST and GMT', () => {
    expect(wallClockHour(BST_EVENING)).toBe(20);
    expect(wallClockHour(GMT_EVENING)).toBe(20);
    expect(wallClockHour(NEXT_DAY_EARLY)).toBe(0);
  });

  it('returns null for date-only stamps, the codec empty sentinel, and null', () => {
    expect(wallClockHour(asWallClock('2026-07-15'))).toBeNull();
    expect(wallClockHour(asWallClock(''))).toBeNull();
    expect(wallClockHour(null)).toBeNull();
    expect(wallClockHour(undefined)).toBeNull();
  });
});

describe('wallClockDurationMinutes', () => {
  it('is the naive wall-clock difference, offset-format robust', () => {
    // 20:00 -> 23:30 same day = 210 min. Uses regex digits, so a 2-digit "+00"
    // offset (which Date.parse rejects on iOS Safari) still parses.
    expect(
      wallClockDurationMinutes(asWallClock('2026-07-15T20:00:00+00'), asWallClock('2026-07-15T23:30:00+00')),
    ).toBe(210);
    // Space-separated (venue-RPC style) parses too.
    expect(
      wallClockDurationMinutes(asWallClock('2026-07-15 20:00:00+00'), asWallClock('2026-07-16 04:00:00+00')),
    ).toBe(480);
  });

  it('returns null for missing input', () => {
    expect(wallClockDurationMinutes(null, BST_EVENING)).toBeNull();
    expect(wallClockDurationMinutes(BST_EVENING, null)).toBeNull();
  });
});

describe('wallClockToInstant', () => {
  it('converts the London wall clock to the true instant (BST is -1h)', () => {
    // London 20:30 BST == 19:30 UTC
    expect(wallClockToInstant(BST_EVENING)?.getTime())
      .toBe(new Date('2026-07-15T19:30:00Z').getTime());
    // London 20:30 GMT == 20:30 UTC
    expect(wallClockToInstant(GMT_EVENING)?.getTime())
      .toBe(new Date('2026-01-15T20:30:00Z').getTime());
  });

  it('equals londonWallClockToInstant for Europe/London (no divergence)', () => {
    for (const raw of [
      '2026-07-15T20:30:00+00',
      '2026-01-15T20:30:00+00',
      '2026-05-01T12:00:00+00',
    ]) {
      expect(wallClockToInstant(asWallClock(raw))?.getTime())
        .toBe(londonWallClockToInstant(raw)?.getTime());
    }
  });

  it('returns null for a value with no time component (date-only / garbage)', () => {
    // The JSON-LD / ICS callers rely on this: a timeless value has no instant.
    expect(wallClockToInstant(asWallClock('2026-07-15'))).toBeNull();
    expect(wallClockToInstant(asWallClock('not-a-date'))).toBeNull();
    expect(wallClockToInstant(null)).toBeNull();
  });

  it('falls back to Europe/London on a malformed timezone rather than throwing', () => {
    // Runs in render/effect paths (JSON-LD, isPast); a bad DB tz must not crash.
    expect(() => wallClockToInstant(BST_EVENING, 'Not/A_Zone')).not.toThrow();
    expect(wallClockToInstant(BST_EVENING, 'Not/A_Zone')?.getTime())
      .toBe(new Date('2026-07-15T19:30:00Z').getTime());
  });
});

describe('two-brand distinction', () => {
  it('same digits mean different moments for WallClock vs Instant', () => {
    // WallClock: a London wall clock -> BST-shifted true instant (19:30Z).
    expect(wallClockToInstant(asWallClock('2026-07-15T20:30:00+00'))?.getTime())
      .toBe(new Date('2026-07-15T19:30:00Z').getTime());
    // Instant: already a real UTC moment, taken literally (20:30Z).
    expect(instantToDate(asInstant('2026-07-15T20:30:00+00'))?.getTime())
      .toBe(new Date('2026-07-15T20:30:00Z').getTime());
  });
});
