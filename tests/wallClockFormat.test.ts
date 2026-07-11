import { describe, expect, it } from 'vitest';
import {
  asWallClock,
  asInstant,
  formatWallClockTime,
  formatWallClockDate,
  formatWallClockDateTime,
  wallClockDateKey,
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

describe('wallClockDateKey', () => {
  it('is the YYYY-MM-DD prefix, near-midnight safe', () => {
    expect(wallClockDateKey(BST_NEAR_MIDNIGHT)).toBe('2026-07-15');
    expect(wallClockDateKey(NEXT_DAY_EARLY)).toBe('2026-07-16');
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
