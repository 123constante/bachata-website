import { describe, it, expect } from 'vitest';
import { freshnessHeat } from '../mapTypes';

// Pins the "Livelier" calibration (Ricky, 2026-06-08): the News freshness stamp
// colours by age via these brackets. The colour -> hex mapping lives in
// cards.tsx FRESHNESS_HEAT; this only guards the time boundaries.
//   now   (green, pulsing)  < 1 hr
//   fresh (teal)            < 8 hr
//   warm  (amber)           < 24 hr
//   cool  (muted)           < 4 days
//   stale (faint)           >= 4 days

const NOW = Date.parse('2026-06-08T12:00:00Z');
const at = (mins: number) => new Date(NOW - mins * 60000).toISOString();

describe('freshnessHeat', () => {
  it('buckets each age band', () => {
    expect(freshnessHeat(at(0), NOW)).toBe('now');
    expect(freshnessHeat(at(30), NOW)).toBe('now');
    expect(freshnessHeat(at(120), NOW)).toBe('fresh'); // 2h
    expect(freshnessHeat(at(7 * 60), NOW)).toBe('fresh'); // 7h
    expect(freshnessHeat(at(12 * 60), NOW)).toBe('warm'); // 12h
    expect(freshnessHeat(at(20 * 60), NOW)).toBe('warm'); // 20h
    expect(freshnessHeat(at(34 * 60), NOW)).toBe('cool'); // 1d 10h
    expect(freshnessHeat(at(3 * 1440), NOW)).toBe('cool'); // 3d
    expect(freshnessHeat(at(4 * 1440), NOW)).toBe('stale'); // 4d
    expect(freshnessHeat(at(20 * 1440), NOW)).toBe('stale');
  });

  it('is half-open on each boundary (lower band wins at the edge)', () => {
    expect(freshnessHeat(at(59), NOW)).toBe('now');
    expect(freshnessHeat(at(60), NOW)).toBe('fresh');
    expect(freshnessHeat(at(479), NOW)).toBe('fresh');
    expect(freshnessHeat(at(480), NOW)).toBe('warm');
    expect(freshnessHeat(at(1439), NOW)).toBe('warm');
    expect(freshnessHeat(at(1440), NOW)).toBe('cool');
    expect(freshnessHeat(at(5759), NOW)).toBe('cool');
    expect(freshnessHeat(at(5760), NOW)).toBe('stale');
  });

  it('treats missing / unparseable instants as stale, and future as now', () => {
    expect(freshnessHeat(null, NOW)).toBe('stale');
    expect(freshnessHeat('not-a-date', NOW)).toBe('stale');
    expect(freshnessHeat(at(-10), NOW)).toBe('now'); // clamped to 0
  });
});
