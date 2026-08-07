// =============================================================================
// festivalDefaultDay — locks the "open the schedule on today's tab" logic.
//
// During a live festival the schedule opens on TODAY, computed in the festival's
// OWN timezone (not the visitor's browser zone), so a visitor abroad still sees
// the correct day. Before/after the festival, or on a gap day, it falls back to
// the first day (index 0). The timezone-boundary cases are what break naive
// browser-local implementations.
//
// pickDefaultDayIndex now TAKES the key rather than reading a clock, so these
// tests resolve it via `dateKeyInTz(now, tz)` — the same call `useTodayKey(tz)`
// makes.
//
// COVERAGE CAVEAT, stated so nobody reads more into a green run than is there:
// resolving the key in the festival's zone now happens in PRODUCTION at
// `FestivalDetail.tsx` (`useTodayKey(eventTz)`), and no test in this repo covers
// that wiring. The `keyFor` helper below is this file's own copy of it. Swap the
// production call to the visitor's browser zone and all of these still pass while
// a Sydney visitor opens the wrong day on a London festival. What these lock is
// the SELECTION rule given a key; the tz-boundary cases document the contract the
// caller has to keep, they do not enforce it.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { dateKeyInTz } from '@/lib/londonDate';
import { pickDefaultDayIndex } from '../festivalDefaultDay';

const DAYS = ['2026-06-12', '2026-06-13', '2026-06-14']; // Fri, Sat, Sun

/** What the page feeds in: today's key on the festival's own calendar. */
const keyFor = (now: Date, tz: string | null) => dateKeyInTz(now, tz ?? 'Europe/London');

describe('pickDefaultDayIndex', () => {
  it('opens on today when today is within the festival range', () => {
    const now = new Date('2026-06-14T10:00:00Z'); // Sun 14, London = 14th
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Europe/London'))).toBe(2);
  });

  it('opens on the first day before the festival starts', () => {
    const now = new Date('2026-06-01T10:00:00Z');
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Europe/London'))).toBe(0);
  });

  it('opens on the first day after the festival ends', () => {
    const now = new Date('2026-07-01T10:00:00Z');
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Europe/London'))).toBe(0);
  });

  it('returns 0 for an empty day list', () => {
    expect(pickDefaultDayIndex([], keyFor(new Date('2026-06-14T10:00:00Z'), 'Europe/London'))).toBe(0);
  });

  it('returns 0 for a gap day that has no sessions', () => {
    // Festival spans Fri + Sun (Sat has no sessions); today is Sat -> first day.
    const now = new Date('2026-06-13T10:00:00Z');
    expect(pickDefaultDayIndex(['2026-06-12', '2026-06-14'], keyFor(now, 'Europe/London'))).toBe(0);
  });

  it('resolves "today" in the festival timezone, not the visitor zone', () => {
    // 22:30Z on the 13th sits in the 1-hour window between Madrid midnight
    // (CEST, UTC+2 -> 00:30 on the 14th) and London midnight (BST, UTC+1 ->
    // still 23:30 on the 13th) — so the same instant is a different calendar day.
    const now = new Date('2026-06-13T22:30:00Z');
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Europe/Madrid'))).toBe(2); // already the 14th in Madrid
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Europe/London'))).toBe(1); // still the 13th in London
  });

  it('handles a non-European festival timezone (Africa/Tunis, UTC+1)', () => {
    const now = new Date('2026-06-13T23:30:00Z'); // 00:30 on the 14th in Tunis
    expect(pickDefaultDayIndex(DAYS, keyFor(now, 'Africa/Tunis'))).toBe(2);
  });

  // DELIBERATELY NOT HERE: a "falls back to Europe/London when timezone is null"
  // case. pickDefaultDayIndex no longer takes a timezone, so any such test would
  // apply the `?? 'Europe/London'` in `keyFor` above and assert its own helper --
  // vacuous, and green even if the real fallback were deleted. The two places
  // that fallback actually lives are covered where they live: `dateKeyInTz(d, null)`
  // in tests/londonDate.test.ts (under the CI TZ matrix), and `eventTz`'s
  // `?? "Europe/London"` in FestivalDetail.tsx, which is part of the untested
  // wiring called out in the caveat at the top of this file.

  it('falls back to the first day when no today key is available', () => {
    expect(pickDefaultDayIndex(DAYS, null)).toBe(0);
    expect(pickDefaultDayIndex(DAYS, undefined)).toBe(0);
    expect(pickDefaultDayIndex(DAYS, '')).toBe(0);
  });

  // A degraded-Intl runtime yields a MALFORMED key, not an empty one — it is
  // truthy and would pass a `!todayKey` guard, so the validator has to be
  // isRealDateKey. Unreal calendar dates must not match a real session day.
  it('falls back to the first day for a malformed or unreal today key', () => {
    expect(pickDefaultDayIndex(DAYS, '2026-13-45')).toBe(0);
    expect(pickDefaultDayIndex(DAYS, '2026-02-30')).toBe(0);
    expect(pickDefaultDayIndex(DAYS, 'not-a-date')).toBe(0);
    // Guard stays honest in the other direction: a real key still selects.
    expect(pickDefaultDayIndex(DAYS, '2026-06-13')).toBe(1);
  });
});
