/** Raw rows in the shape admin_list_pending_review_v1 returns (types.ts), submitter_email included on purpose. */
export const CITY = { city_id: 'c-bristol', city_name: 'Bristol', city_slug: 'bristol' };
const LONG = 'The Annual Bristol Bachata Sensual and Dominican Social Weekender Warm-Up Series with Guest Teachers from Around Europe';
const weekly = (start: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10));
export const agoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

interface Opts { type?: 'organiser' | 'series'; ago?: number; orgs?: string[]; dates?: string[]; count?: number; venue?: string | null; pmin?: number | null; pmax?: number | null; flyer?: boolean }
export const row = (id: string, name: string, o: Opts = {}) => ({
  target_type: o.type ?? 'organiser',
  target_id: id,
  name,
  city_id: CITY.city_id,
  city_name: CITY.city_name,
  lifecycle_status: 'pending_review',
  submitted_at: agoIso(o.ago ?? 1),
  submitter_email: 'someone.private@example.com',
  public_slug: `slug-${id}`,
  organiser_names: o.orgs ?? [name],
  next_occurrence_dates: o.dates ?? [],
  future_occurrence_count: o.count ?? 0,
  venue_name: o.venue ?? null,
  price_min: o.pmin ?? null,
  price_max: o.pmax ?? null,
  price_currency: 'GBP',
  has_flyer: o.flyer ?? false,
});

export const SHAPES = {
  series13: row('s1', 'Thursday Bachata at The Lantern', { type: 'series', ago: 9, orgs: ['Lantern Social'], dates: weekly('2026-10-29', 3), count: 13, venue: 'The Lantern Rooms', pmin: 8, pmax: 8, flyer: true }),
  organiserBare: row('o2', 'Harbourside Dance Collective', { ago: 6 }),
  freeNoFlyer: row('s3', 'Sunday Social Sensual', { type: 'series', ago: 5, orgs: ['Marlow Dance'], dates: weekly('2026-11-01', 3), count: 8, venue: 'Old Fire Station Hall', pmin: 0, pmax: 0, flyer: false }),
  longName: row('s4', LONG, { type: 'series', ago: 4, orgs: ['Westbound Events', 'Guest Teachers Ltd'], dates: ['2026-11-14', '2026-11-15'], count: 2, venue: 'Clifton Assembly Rooms', pmin: 5, pmax: 12, flyer: true }),
  one: row('s9', 'Bachata Fundamentals Workshop', { type: 'series', ago: 1, orgs: ['Harbour Studio'], dates: ['2026-11-08'], count: 1, venue: 'Harbour Studio', pmin: 15, pmax: 15 }),
  today: row('o12', 'Southville Salsa and Bachata', { ago: 0 }),
};
export const twelve = () => [
  SHAPES.series13, SHAPES.organiserBare, SHAPES.freeNoFlyer, SHAPES.longName,
  row('o5', 'Bristol Bachata Beginners', { ago: 3 }), row('s6', 'Tuesday Improvers Class', { type: 'series', ago: 3, dates: weekly('2026-11-03', 3), count: 6, pmin: 10, pmax: 10 }),
  row('o7', 'Moonlight Moderna Crew', { ago: 2 }), row('s8', 'Friday Latin Night', { type: 'series', ago: 2, dates: weekly('2026-10-30', 3), count: 12, pmin: 0, pmax: 0, flyer: true }),
  SHAPES.one, row('o10', 'Redcliffe Sensual', { ago: 1 }), row('s11', 'Saturday Daytime Social', { type: 'series', ago: 0, dates: weekly('2026-11-07', 3), count: 4, pmin: 6, pmax: 9, flyer: true }), SHAPES.today,
];
// The RPC returns NEWEST first.
export const newestFirst = (rows: ReturnType<typeof row>[]) => [...rows].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
export const hundred = () => Array.from({ length: 100 }, (_, i) => row(`h${i}`, `Organiser ${i}`, { ago: 1 + (i % 5) }));
