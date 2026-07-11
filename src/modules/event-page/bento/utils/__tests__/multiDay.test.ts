import { describe, it, expect } from 'vitest';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { isMultiDay, buildDateLabel } from '@/modules/event-page/bento/utils/multiDay';
import { asWallClock } from '@/lib/time/wallClock';

// Minimal occurrence factory. Times are local-as-UTC (naive wall-clock tagged
// +00), matching the DB convention; isMultiDay/buildDateLabel read only
// startsAt/endsAt/localDate.
const occ = (startsAt: string | null, endsAt: string | null): EventPageSnapshotOccurrence =>
  ({
    occurrenceId: 'occ',
    startsAt: startsAt ? asWallClock(startsAt) : null,
    endsAt: endsAt ? asWallClock(endsAt) : null,
    localDate: startsAt ? asWallClock(startsAt.slice(0, 10)) : null,
    timezone: 'Europe/London',
    isCancelled: false,
  } as EventPageSnapshotOccurrence);

describe('isMultiDay', () => {
  it('a 6h Friday night (19:00 -> 01:00 next day) is NOT multi-day', () => {
    // The Sensual Fridays post-fix shape — crosses midnight but is one night.
    const o = occ('2026-06-05T19:00:00+00:00', '2026-06-06T01:00:00+00:00');
    expect(isMultiDay(o)).toBe(false);
    const label = buildDateLabel(o);
    expect(label?.isMultiDay).toBe(false);
    expect(label?.endDay).toBeNull();
  });

  it('a start+24h span IS flagged multi-day (>20h) — regression guard: we rely on the DB storing the real span, not a client cap', () => {
    // The pre-fix corruption that produced the "-> SATURDAY 6" tail.
    const o = occ('2026-06-05T20:00:00+00:00', '2026-06-06T20:00:00+00:00');
    expect(isMultiDay(o)).toBe(true);
  });

  it('a genuine 2-day weekender IS multi-day with distinct start/end parts', () => {
    const o = occ('2026-06-19T18:00:00+00:00', '2026-06-21T03:00:00+00:00');
    expect(isMultiDay(o)).toBe(true);
    const label = buildDateLabel(o);
    expect(label?.isMultiDay).toBe(true);
    expect(label?.startDay).toBe('19');
    expect(label?.endDay).toBe('21');
  });

  it('threshold boundary: exactly 20h is NOT multi-day, 20h+1min IS', () => {
    expect(isMultiDay(occ('2026-06-05T00:00:00+00:00', '2026-06-05T20:00:00+00:00'))).toBe(false);
    expect(isMultiDay(occ('2026-06-05T00:00:00+00:00', '2026-06-05T20:01:00+00:00'))).toBe(true);
  });

  it('null / missing endsAt is single-day', () => {
    expect(isMultiDay(null)).toBe(false);
    expect(isMultiDay(occ('2026-06-05T19:00:00+00:00', null))).toBe(false);
  });
});