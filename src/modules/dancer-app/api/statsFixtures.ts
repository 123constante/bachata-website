import type { MyDancerStats, MyProfileViews } from './types';
import { FAKE_PROFILE_ID } from './fixtures';

/**
 * Named shapes of my_dancer_stats_v1 / my_profile_views_v1 for tests (counts only, invented).
 * `error` is not a payload: the fake backend fails the read with that code.
 */
export type StatsFixture = { stats: MyDancerStats; views: MyProfileViews } | { error: 'unknown' | 'no_profile' | 'area_closed' };

const baseStats: MyDancerStats = {
  profile_id: FAKE_PROFILE_ID,
  member_since: '2026-09-01T10:00:00Z',
  nights_going_upcoming: 0,
  nights_went: 0,
  interested_upcoming: 0,
  level_votes: 0,
  views_30_days: 0,
  views_total: 0,
};
const baseViews: MyProfileViews = { profile_id: FAKE_PROFILE_ID, total: 0, last_7_days: 0, last_30_days: 0, previous_30_days: 0, last_viewed_at: null };

export const STATS_SHAPES = {
  zero: { stats: baseStats, views: baseViews },
  normal: {
    stats: { ...baseStats, nights_going_upcoming: 3, nights_went: 12, interested_upcoming: 2, level_votes: 4, views_30_days: 18, views_total: 40 },
    views: { ...baseViews, total: 40, last_7_days: 6, last_30_days: 18, previous_30_days: 9, last_viewed_at: '2026-10-16T20:00:00Z' },
  },
  one: {
    stats: { ...baseStats, nights_going_upcoming: 1, nights_went: 1, interested_upcoming: 1, level_votes: 1, views_30_days: 1, views_total: 1 },
    views: { ...baseViews, total: 1, last_7_days: 1, last_30_days: 1, last_viewed_at: '2026-10-16T20:00:00Z' },
  },
  huge: {
    stats: { ...baseStats, nights_going_upcoming: 150, nights_went: 2400, interested_upcoming: 99, level_votes: 321, views_30_days: 123456, views_total: 9876543 },
    views: { ...baseViews, total: 9876543, last_7_days: 54321, last_30_days: 123456, previous_30_days: 100000, last_viewed_at: '2026-10-17T09:00:00Z' },
  },
  /**
   * F7 shapes (prod has 138 cancelled occurrences and ended series): my_dancer_stats_v1 counts
   * scheduled occurrences only, so these numbers differ from a count of the attendance list.
   * cancelledNight: Going to one night that was cancelled (not counted); went 2 so the strip shows cells.
   */
  cancelledNight: { stats: { ...baseStats, nights_went: 2 }, views: baseViews },
  /** endedSeries: Going to a still-scheduled night of a series that is no longer listed (counted). */
  endedSeries: { stats: { ...baseStats, nights_going_upcoming: 1 }, views: baseViews },
  /** over999: more Going nights than the attendance list returns (its API cap is 100 rows). */
  over999: { stats: { ...baseStats, nights_going_upcoming: 1500, interested_upcoming: 3 }, views: baseViews },
  error: { error: 'unknown' },
  noProfile: { error: 'no_profile' },
  areaClosed: { error: 'area_closed' },
} as const satisfies Record<string, StatsFixture>;

export type StatsShapeName = keyof typeof STATS_SHAPES;
export const STATS_SHAPE_NAMES = Object.keys(STATS_SHAPES) as StatsShapeName[];
