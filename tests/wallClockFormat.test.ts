import { describe, expect, it } from 'vitest';
import {
  asWallClock,
  asWallClockOrNull,
  asInstant,
  asEventTimeZone,
  formatWallClockTime,
  formatWallClockDate,
  formatWallClockDateTime,
  formatWallClockLocal,
  formatWallClockLocalIntl,
  wallClockDateKey,
  wallClockExactDateKey,
  wallClockDurationMinutes,
  wallClockHour,
  wallClockTimeKey,
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

  it('tolerates a bare "HH:MM[:SS]" stamp (legacy meta_data->program path)', () => {
    expect(formatWallClockTime(asWallClock('20:30'), { hour12: false })).toBe('20:30');
    expect(formatWallClockTime(asWallClock('20:30:00'))).toBe('8:30 PM');
    expect(formatWallClockTime(asWallClock('09:00'))).toBe('9 AM');
    // A date-only value has no time part -> still null (not parsed as an hour).
    expect(formatWallClockTime(asWallClock('2026-07-15'))).toBeNull();
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

describe('wallClockExactDateKey', () => {
  it('accepts a bare date but rejects any time-suffixed stamp', () => {
    // sniffIsFestival's festival-routing count depends on this anchoring.
    expect(wallClockExactDateKey(asWallClock('2026-07-15'))).toBe('2026-07-15');
    expect(wallClockExactDateKey(BST_EVENING)).toBeNull(); // has a time part
    expect(wallClockExactDateKey(asWallClock(''))).toBeNull();
    expect(wallClockExactDateKey(null)).toBeNull();
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

  it('reads a bare "HH:MM" stamp (legacy meta_data->program path)', () => {
    expect(wallClockHour(asWallClock('20:30'))).toBe(20);
    expect(wallClockHour(asWallClock('09:00:00'))).toBe(9);
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

describe('asEventTimeZone', () => {
  it("treats 'UTC' as unspecified so the London default applies", () => {
    expect(asEventTimeZone('UTC')).toBeNull();
    expect(asEventTimeZone(null)).toBeNull();
    expect(asEventTimeZone('')).toBeNull();
    expect(asEventTimeZone('   ')).toBeNull();
  });

  it('passes real IANA zones through untouched', () => {
    expect(asEventTimeZone('Europe/London')).toBe('Europe/London');
    expect(asEventTimeZone('Europe/Madrid')).toBe('Europe/Madrid');
    expect(asEventTimeZone('Africa/Tunis')).toBe('Africa/Tunis');
  });

  it("REGRESSION: a 'UTC'-tagged London event still gets the BST correction", () => {
    // The live bug this exists for. Stored 20:30 London (BST). Taken literally,
    // 'UTC' makes wallClockToInstant the identity -> 20:30Z, an hour late, which
    // is exactly what Google/ICS were being fed. Normalised, it lands on 19:30Z.
    const tz = asEventTimeZone('UTC') ?? 'Europe/London';
    expect(wallClockToInstant(BST_EVENING, tz)?.toISOString()).toBe('2026-07-15T19:30:00.000Z');
    // Proof the raw value really was harmful (documents the failure mode):
    expect(wallClockToInstant(BST_EVENING, 'UTC')?.toISOString()).toBe('2026-07-15T20:30:00.000Z');
    // Winter is unaffected either way (GMT == UTC), which is why it hid for months.
    expect(wallClockToInstant(GMT_EVENING, tz)?.toISOString()).toBe('2026-01-15T20:30:00.000Z');
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

describe('wire-format tolerance: space vs T separator', () => {
  // Two boundaries serialise the SAME stored value two ways. jsonb RPCs
  // (event_view_p5, festival detail) emit a 'T': "2026-07-15T20:30:00+00:00".
  // ::text-cast RPCs (get_calendar_events_v2 and its organiser wrapper) emit a
  // SPACE: "2026-07-15 20:30:00+00". The readers must treat them identically,
  // or the calendar boundary silently loses every time it formats.
  const SPACE = asWallClock('2026-07-15 20:30:00+00'); // calendar RPC dialect
  const T_FULL = asWallClock('2026-07-15T20:30:00+00:00'); // organiser RPC dialect

  it('formatWallClockTime is identical for space and T forms', () => {
    expect(formatWallClockTime(SPACE)).toBe('8:30 PM');
    expect(formatWallClockTime(T_FULL)).toBe('8:30 PM');
    expect(formatWallClockTime(SPACE, { hour12: false })).toBe('20:30');
  });

  it('wallClockHour reads the stored hour from a space-separated stamp', () => {
    expect(wallClockHour(SPACE)).toBe(20);
    expect(wallClockHour(T_FULL)).toBe(20);
  });

  it('wallClockToInstant converts a space-separated stamp (BST -> 19:30Z)', () => {
    // Before the fix this returned null on the space form -> a home ItemList
    // JSON-LD startDate would VANISH rather than merely be an hour late.
    expect(wallClockToInstant(SPACE)?.getTime())
      .toBe(new Date('2026-07-15T19:30:00Z').getTime());
    expect(wallClockToInstant(SPACE)?.getTime())
      .toBe(wallClockToInstant(T_FULL)?.getTime());
  });

  it('still accepts a bare "HH:MM" (program passthrough) and rejects date-only', () => {
    expect(formatWallClockTime(asWallClock('19:30'))).toBe('7:30 PM');
    expect(wallClockHour(asWallClock('19:30'))).toBe(19);
    // A date-only value has no instant regardless of separator handling.
    expect(wallClockToInstant(asWallClock('2026-07-15'))).toBeNull();
    expect(formatWallClockTime(asWallClock('2026-07-15'))).toBeNull();
  });

  it('formatWallClockDate / DateTime / dateKey read the space form and the empty sentinel', () => {
    // Phase-3 gap fill: these readers were only exercised on the T form before.
    expect(formatWallClockDate(SPACE)).toBe('Wed 15 Jul');
    expect(formatWallClockDateTime(SPACE)).toBe('Wed 15 Jul, 8:30 PM');
    expect(wallClockDateKey(SPACE)).toBe('2026-07-15');
    // The COALESCE(...,'') sentinel is falsy -> every reader returns null.
    const EMPTY = asWallClock('');
    expect(formatWallClockDate(EMPTY)).toBeNull();
    expect(formatWallClockDateTime(EMPTY)).toBeNull();
    expect(wallClockDateKey(EMPTY)).toBeNull();
    expect(wallClockToInstant(EMPTY)).toBeNull();
  });
});

describe('asWallClockOrNull (calendar codec producer)', () => {
  it('maps null, undefined and the empty sentinel to null; brands everything else', () => {
    expect(asWallClockOrNull(null)).toBeNull();
    expect(asWallClockOrNull(undefined)).toBeNull();
    expect(asWallClockOrNull('')).toBeNull(); // COALESCE(...,'') absent-session sentinel
    expect(asWallClockOrNull(123 as unknown)).toBeNull();
    // A real stamp round-trips through the readers.
    expect(formatWallClockTime(asWallClockOrNull('2026-07-15 20:30:00+00'))).toBe('8:30 PM');
  });
});

describe('wallClockTimeKey (calendar-grid HH:MM, byte-equal to the old fmtTime)', () => {
  it('extracts zero-padded HH:MM from space, T and bare forms; null for date-only', () => {
    expect(wallClockTimeKey(asWallClock('2026-07-15 20:00:00+00'))).toBe('20:00');
    expect(wallClockTimeKey(asWallClock('2026-07-15T09:05:00+00:00'))).toBe('09:05');
    expect(wallClockTimeKey(asWallClock('20:30'))).toBe('20:30'); // program passthrough
    expect(wallClockTimeKey(asWallClock('2026-07-15'))).toBeNull(); // date-only
    expect(wallClockTimeKey(asWallClock(''))).toBeNull();
    expect(wallClockTimeKey(null)).toBeNull();
  });
});

describe('non-London real zone round-trip (Phase Q sanity: conversion is zone-driven)', () => {
  it('wallClockToInstant converts a stored 14:00 with Europe/Madrid to 13:00Z (CEST -1h)', () => {
    // Madrid is CEST (UTC+2) in July, so a 14:00 wall clock is the 12:00Z instant.
    expect(wallClockToInstant(asWallClock('2026-07-15 14:00:00+00'), 'Europe/Madrid')?.getTime())
      .toBe(new Date('2026-07-15T12:00:00Z').getTime());
    // The SAME digits under Europe/London (BST, +1) are the 13:00Z instant --
    // proof the zone, not the digits, decides the moment (the crux of Phase Q).
    expect(wallClockToInstant(asWallClock('2026-07-15 14:00:00+00'), 'Europe/London')?.getTime())
      .toBe(new Date('2026-07-15T13:00:00Z').getTime());
  });
});
