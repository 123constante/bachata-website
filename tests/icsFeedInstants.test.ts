import { describe, it, expect } from 'vitest';
import { asWallClock, wallClockToInstant } from '../src/lib/time/wallClock';

// The /api/ics/calendar feed turns a stored wall clock into the true UTC instant
// external calendar apps subscribe to (DTSTART). get_public_events_list_v2 emits
// starts_at as the London wall clock RE-TAGGED '+00' (verified live: a 19:30
// event arrives as "2026-07-20T19:30:00+00:00"), so reading it as an instant
// would put every BST event in subscribers' calendars an hour late.
//
// The route previously carried its own copy of the offset probe; it now delegates
// to wallClockToInstant. These pin the composed DTSTART value so that delegation
// (and any future change to it) stays honest.

// Same transform as the route's compact().
const compact = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const dtstart = (raw: string | null, tz: string | null): string | null => {
  const instant = wallClockToInstant(raw === null ? null : asWallClock(raw), tz ?? undefined);
  return instant ? compact(instant) : null;
};

describe('ICS DTSTART from a stored wall clock', () => {
  it('shifts a British Summer Time wall clock back an hour (real wire values)', () => {
    // 2026-07-19/20 are BST (UTC+1): 14:00 London is 13:00Z.
    expect(dtstart('2026-07-19T14:00:00+00:00', 'Europe/London')).toBe('20260719T130000Z');
    expect(dtstart('2026-07-19T18:30:00+00:00', 'Europe/London')).toBe('20260719T173000Z');
    expect(dtstart('2026-07-20T19:30:00+00:00', 'Europe/London')).toBe('20260720T183000Z');
  });

  it('leaves a GMT (winter) wall clock unshifted', () => {
    // January is GMT (UTC+0): the wall clock IS the instant.
    expect(dtstart('2026-01-15T19:30:00+00:00', 'Europe/London')).toBe('20260115T193000Z');
  });

  it('uses the event timezone, not London, for a foreign city', () => {
    // Africa/Tunis is UTC+1 in July: 18:00 local is 17:00Z.
    expect(dtstart('2026-07-20T18:00:00+00:00', 'Africa/Tunis')).toBe('20260720T170000Z');
  });

  it('falls back to Europe/London when the timezone is absent', () => {
    expect(dtstart('2026-07-20T19:30:00+00:00', null)).toBe('20260720T183000Z');
  });

  it('treats the UTC sentinel as London rather than taking it literally', () => {
    // asEventTimeZone maps a mis-tagged 'UTC' to null at the codec, so the
    // London default applies; taking 'UTC' literally would emit 19:30Z (1h late).
    expect(dtstart('2026-07-20T19:30:00+00:00', 'Europe/London')).toBe('20260720T183000Z');
  });

  it('also parses the space-separated wire form (the old inline copy returned null)', () => {
    // A null here meant a VEVENT shipped with no DTSTART at all.
    expect(dtstart('2026-07-20 19:30:00+00', 'Europe/London')).toBe('20260720T183000Z');
  });

  it('returns null for a missing or date-only value (no instant to emit)', () => {
    expect(dtstart(null, 'Europe/London')).toBeNull();
    expect(dtstart('2026-07-20', 'Europe/London')).toBeNull();
  });
});
