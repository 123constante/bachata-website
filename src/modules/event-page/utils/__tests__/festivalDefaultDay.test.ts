// =============================================================================
// festivalDefaultDay — locks the "open the schedule on today's tab" logic.
//
// During a live festival the schedule opens on TODAY, computed in the festival's
// OWN timezone (not the visitor's browser zone), so a visitor abroad still sees
// the correct day. Before/after the festival, or on a gap day, it falls back to
// the first day (index 0). The timezone-boundary cases are what break naive
// browser-local implementations.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { pickDefaultDayIndex } from '../festivalDefaultDay';

const DAYS = ['2026-06-12', '2026-06-13', '2026-06-14']; // Fri, Sat, Sun

describe('pickDefaultDayIndex', () => {
  it('opens on today when today is within the festival range', () => {
    const now = new Date('2026-06-14T10:00:00Z'); // Sun 14, London = 14th
    expect(pickDefaultDayIndex(DAYS, 'Europe/London', now)).toBe(2);
  });

  it('opens on the first day before the festival starts', () => {
    const now = new Date('2026-06-01T10:00:00Z');
    expect(pickDefaultDayIndex(DAYS, 'Europe/London', now)).toBe(0);
  });

  it('opens on the first day after the festival ends', () => {
    const now = new Date('2026-07-01T10:00:00Z');
    expect(pickDefaultDayIndex(DAYS, 'Europe/London', now)).toBe(0);
  });

  it('returns 0 for an empty day list', () => {
    expect(pickDefaultDayIndex([], 'Europe/London', new Date('2026-06-14T10:00:00Z'))).toBe(0);
  });

  it('returns 0 for a gap day that has no sessions', () => {
    // Festival spans Fri + Sun (Sat has no sessions); today is Sat -> first day.
    const now = new Date('2026-06-13T10:00:00Z');
    expect(pickDefaultDayIndex(['2026-06-12', '2026-06-14'], 'Europe/London', now)).toBe(0);
  });

  it('resolves "today" in the festival timezone, not the visitor zone', () => {
    // 22:30Z on the 13th sits in the 1-hour window between Madrid midnight
    // (CEST, UTC+2 -> 00:30 on the 14th) and London midnight (BST, UTC+1 ->
    // still 23:30 on the 13th) — so the same instant is a different calendar day.
    const now = new Date('2026-06-13T22:30:00Z');
    expect(pickDefaultDayIndex(DAYS, 'Europe/Madrid', now)).toBe(2); // already the 14th in Madrid
    expect(pickDefaultDayIndex(DAYS, 'Europe/London', now)).toBe(1); // still the 13th in London
  });

  it('handles a non-European festival timezone (Africa/Tunis, UTC+1)', () => {
    const now = new Date('2026-06-13T23:30:00Z'); // 00:30 on the 14th in Tunis
    expect(pickDefaultDayIndex(DAYS, 'Africa/Tunis', now)).toBe(2);
  });

  it('falls back to Europe/London when timezone is null', () => {
    const now = new Date('2026-06-14T10:00:00Z');
    expect(pickDefaultDayIndex(DAYS, null, now)).toBe(2);
  });
});
