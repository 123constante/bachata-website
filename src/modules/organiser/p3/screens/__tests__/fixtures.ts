import type { OrganiserHome } from '../../../shared/selfServeApi';
import type { HomeSeriesRow } from '../../data/home';
import type { ViewsStats } from '../../data/stats';

/**
 * organiser_home_v1 series rows in every shape CONTRACT.md section 1 lists, as the
 * RPC sends them (read-only survey, prod stsdtacfauprzrdebmzg, 25 Oct 2026: formats
 * recurring / one_off / course / festival; categories party / class / workshop / null;
 * lifecycles live / paused / ended / draft; next_dates are SCHEDULED only, at most 3;
 * upcoming_count up to 57 (a live series has 131 dates in all); a draft with no time,
 * no cover and no venue). Names are stand-ins, never real organisers.
 */
export const TODAY = '2026-10-25';

const date = (d: string, start: string | null, extra: Partial<HomeSeriesRow['next_dates'][number]> = {}) => ({
  occurrence_id: `o-${d}`,
  occurrence_date: d,
  lifecycle_status: 'scheduled',
  materialised_start_utc: start ? `${d}T${start}:00+00:00` : null,
  has_own_changes: false,
  venue_name: null,
  ...extra,
});

const series = (id: string, over: Partial<HomeSeriesRow>): HomeSeriesRow => ({
  id,
  name: `Event ${id}`,
  slug: null,
  format: 'recurring',
  category: 'party',
  lifecycle_status: 'live',
  default_local_start_time: '20:00:00',
  default_cover_image_url: 'https://example.test/c.jpg',
  default_venue_name: 'Studio One',
  created_at: '2026-01-01T00:00:00Z',
  upcoming_count: 0,
  cancelled_upcoming_count: 0,
  next_dates: [],
  latest_decision: null,
  ...over,
});

export const SHAPES = {
  weekly: series('weekly', { name: 'Sensual Fridays', upcoming_count: 52, next_dates: [date('2026-10-30', '20:00'), date('2026-11-06', '20:00'), date('2026-11-13', '20:00')] }),
  /** the series with 131 dates: home_v1 still sends 3, the count is the server's */
  over100: series('over100', { name: 'Long Runner', upcoming_count: 57, next_dates: [date('2026-10-27', '21:00'), date('2026-11-03', '21:00'), date('2026-11-10', '21:00')] }),
  /** a monthly rule reads as weekly here (no rule mode in home_v1) */
  monthly: series('monthly', { name: 'First Saturdays', upcoming_count: 12, next_dates: [date('2026-11-07', '21:00')] }),
  oneoff: series('oneoff', { name: 'Halloween Party', format: 'one_off', upcoming_count: 1, next_dates: [date('2026-10-31', '21:00')] }),
  oneoffPast: series('oneoffPast', { name: 'Summer Boat Party', format: 'one_off', upcoming_count: 0 }),
  course: series('course', { name: 'Sensual Wednesdays', format: 'course', category: 'class', default_local_start_time: '19:00:00', upcoming_count: 3, next_dates: [date('2026-10-28', '19:00'), date('2026-11-04', '19:00'), date('2026-11-11', '19:00')] }),
  courseDone: series('courseDone', { name: 'Sensual Wednesdays', format: 'course', category: 'class', default_local_start_time: '19:00:00', upcoming_count: 0 }),
  festival: series('festival', { name: 'Bachata Weekender', format: 'festival', upcoming_count: 1, next_dates: [date('2026-11-20', '18:00')] }),
  /** every upcoming date cancelled: home_v1 sends none of them */
  allCancelled: series('allCancelled', { name: 'Thursday Social', upcoming_count: 0, cancelled_upcoming_count: 4 }),
  /** next date moved to 9pm and different from usual */
  moved: series('moved', { name: 'Sunday Social', upcoming_count: 20, next_dates: [date('2026-11-01', '21:00', { has_own_changes: true, venue_name: 'Other Hall' }), date('2026-11-08', '20:00')] }),
  /** no start time anywhere (223 prod items have none) */
  noTime: series('noTime', { name: 'Late Social', default_local_start_time: null, upcoming_count: 5, next_dates: [date('2026-10-29', null)] }),
  paused: series('paused', { name: 'Hidden Tuesdays', lifecycle_status: 'paused', upcoming_count: 51, next_dates: [date('2026-10-26', '20:00')] }),
  ended: series('ended', { name: 'Old Mondays', lifecycle_status: 'ended', upcoming_count: 0 }),
  draft: series('draft', { name: '', category: null, lifecycle_status: 'draft', default_local_start_time: null, default_cover_image_url: null, default_venue_name: null, upcoming_count: 0 }),
  tonight: series('tonight', { name: 'Tonight Social', upcoming_count: 8, next_dates: [date(TODAY, '20:30'), date('2026-11-01', '20:30')] }),
} satisfies Record<string, HomeSeriesRow>;

export type ShapeKey = keyof typeof SHAPES;
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

export function homeOf(rows: HomeSeriesRow[], today = TODAY): OrganiserHome {
  return {
    today,
    organisers: [{ id: 'org', name: 'Org', slug: null, avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: rows as never }],
  } as OrganiserHome;
}

export function statsOf(entries: Array<[string, string, number]>, from = '2026-09-26', to = TODAY): ViewsStats {
  return {
    from,
    to,
    series: entries.map(([id, name, total]) => ({ seriesId: id, name, total, byDay: total ? [{ day: to, count: total }] : [] })),
  };
}
