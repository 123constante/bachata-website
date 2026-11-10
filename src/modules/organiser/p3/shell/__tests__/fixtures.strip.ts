/** Slice 1a fixtures: organiser_home_v1 shapes for the strip and switcher matrices (prod-shaped: live, draft, paused, ended; 0, 1, many events). */
import type { HomeOrganiser, OrganiserHome } from '@/modules/organiser/shared/selfServeApi';

export const TODAY = '2026-11-09';

type S = { lifecycle?: string; cover?: boolean; upcoming?: number; cancelled?: number; format?: string };
let n = 0;
export function series(o: S = {}) {
  n += 1;
  const upcoming = o.upcoming ?? 1;
  return {
    id: `s${n}`, name: `Event ${n}`, slug: null, format: o.format ?? 'one_off', category: 'party',
    lifecycle_status: o.lifecycle ?? 'live', default_local_start_time: '20:00',
    default_cover_image_url: o.cover === false ? null : 'https://x.example/c.jpg', created_at: '2026-10-01T00:00:00Z',
    upcoming_count: upcoming, cancelled_upcoming_count: o.cancelled ?? 0,
    next_dates: upcoming ? [{ occurrence_date: '2026-11-20', lifecycle_status: 'scheduled', venue_name: 'Hall', has_own_changes: false }] : [],
    latest_decision: null,
  };
}
/** Caught up: live, a cover, a date coming up. */
export const caughtUp = () => series();
/** Two to-dos: no photo, still a draft. */
export const twoTodos = () => series({ lifecycle: 'draft', cover: false });

export function page(id: string, name: string, role: string, list: ReturnType<typeof series>[] = [], lifecycle_status = 'live'): HomeOrganiser {
  return { id, name, slug: null, avatar_url: null, city_id: null, lifecycle_status, role: role as HomeOrganiser['role'], latest_decision: null, series: list as never, team: [] };
}
export const home = (...organisers: HomeOrganiser[]): OrganiserHome => ({ today: TODAY, organisers });
