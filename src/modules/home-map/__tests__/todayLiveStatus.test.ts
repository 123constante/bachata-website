import { describe, it, expect } from 'vitest';
import { todayLiveStatus, isTodayRow, type MapEvent } from '../mapTypes';

// todayLiveStatus takes the caller's already-derived London day key as its third
// argument so the homepage feed can pass its pinned state.today instead of
// making every row re-derive one (an Intl.format() per row per render). These
// pin that contract: the passed key must be what decides "is this event today",
// and omitting it must keep the old derive-from-`now` behaviour.

const base: MapEvent = {
  occurrence_id: 'occ-1',
  instance_date: '2026-06-08',
  // Wall-clock, stored naive as +00 -- never tz-converted (see mapTypes).
  start_time: '2026-06-08 20:00:00+00',
  end_time: '2026-06-08 23:00:00+00',
  is_cancelled: false,
} as MapEvent;

// 19:00 London wall clock on the event's own day -- 60 min before a 20:00 start,
// i.e. inside the 90-minute "soon" window.
const NOW_BEFORE = new Date('2026-06-08T19:00:00+01:00');
// 21:00 London -- between start and end.
const NOW_DURING = new Date('2026-06-08T21:00:00+01:00');

describe('todayLiveStatus pinned-today argument', () => {
  it('uses the passed key to decide whether the event is today', () => {
    expect(todayLiveStatus(base, NOW_DURING, '2026-06-08')).toBe('on-now');
    expect(todayLiveStatus(base, NOW_BEFORE, '2026-06-08')).toBe('soon');
  });

  it('suppresses the badge when the pinned key is a different day', () => {
    // Same instant, but the caller's calendar has rolled over: the row is no
    // longer "today", so no badge -- even though the clock still sits inside
    // the event's start/end window.
    expect(todayLiveStatus(base, NOW_DURING, '2026-06-09')).toBeNull();
    expect(todayLiveStatus(base, NOW_BEFORE, '2026-06-09')).toBeNull();
  });

  it('falls back to deriving the day from `now` when no key is passed', () => {
    expect(todayLiveStatus(base, NOW_DURING)).toBe('on-now');
    expect(todayLiveStatus(base, NOW_BEFORE)).toBe('soon');
  });

  it('still returns null for a cancelled event whatever the key says', () => {
    const cancelled = { ...base, is_cancelled: true };
    expect(todayLiveStatus(cancelled, NOW_DURING, '2026-06-08')).toBeNull();
  });
});

// isTodayRow is the SINGLE definition of the day match: todayLiveStatus gates
// on it, and so does the JSX deciding whether to mount a LiveBadge at all.
// One definition so the two cannot drift -- when they were written separately,
// a mount gate could suppress a badge todayLiveStatus would have returned.
describe('isTodayRow', () => {
  it('matches the row against the passed day key', () => {
    expect(isTodayRow(base, '2026-06-08')).toBe(true);
    expect(isTodayRow(base, '2026-06-09')).toBe(false);
  });

  it('is permissive when no key is supplied (caller has no pinned day)', () => {
    expect(isTodayRow(base, null)).toBe(true);
    expect(isTodayRow(base, undefined)).toBe(true);
  });

  // NOTE: the JSX mount gates in cards.tsx (EventRow, TonightCard) call this
  // same predicate, but nothing here renders them -- there is no component-test
  // setup in this repo. So these cases pin the predicate, NOT the gates. An
  // earlier revision asserted "the gate agrees with todayLiveStatus", which was
  // a tautology: todayLiveStatus calls isTodayRow itself, so the assertion held
  // even if this function returned a constant. Removed rather than left to imply
  // coverage that does not exist.
});
