// Shared fixtures for the W2 event tests. Thursday 8 Oct 2026 is "today".
export const TODAY = '2026-10-08';

export function rawWorkspace(over: Record<string, unknown> = {}, occurrences?: unknown[]) {
  return {
    series: {
      series: {
        id: 's1', name: 'Friday Party', slug: 'friday-party', format: 'recurring', category: 'class',
        lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_local_start_time: '20:00:00',
        default_duration: null, default_level: null, default_ticket_url: null, default_description: 'Party night',
        default_cover_image_url: null, default_start_date: '2026-10-09', instagram_url: null, passes: null, created_at: null,
        recurrence_rule: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2026-11-27' } },
        removed_dates: [], default_music_styles: ['Bachata'], gallery: ['https://cdn.example/g1.webp'], video_urls: [],
        ...over,
      },
      program: [],
    },
    occurrences: occurrences ?? [
      { id: 'o2', occurrence_date: '2026-10-16', lifecycle_status: 'scheduled', version: 1 },
      { id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'scheduled', version: 1 },
      { id: 'o0', occurrence_date: '2026-10-02', lifecycle_status: 'scheduled', version: 1 },
    ],
  };
}

export const home = (series: Record<string, unknown>[] = [
  { id: 's1', name: 'Friday Party', lifecycle_status: 'live', default_venue_name: 'Studio One', upcoming_count: 2,
    next_dates: [{ occurrence_id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'scheduled', materialised_start_utc: null, has_own_changes: false }] },
  { id: 's2', name: 'Autumn Party', lifecycle_status: 'draft', default_venue_name: null, upcoming_count: 0, next_dates: [] },
]) => ({
  today: TODAY,
  organisers: [{ id: 'org1', name: 'Latin Nights', slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series }],
});

export const programme = {
  occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-09', version: 2, editable: true, not_editable_reason: null,
  sessions: [
    { series_item_id: 'i2', type: 'party', title: 'Party', start_time: '21:00', end_time: '23:30', level_keys: [] },
    { series_item_id: 'i1', type: 'class', title: 'Beginners', start_time: '20:00', end_time: '21:00', level_keys: ['beginner'] },
  ],
  session_people: [
    { series_item_id: 'i1', people: [{ profile_id: 'p1', display_name: 'Ana Ruiz', role: 'teaching' }, { profile_id: 'p2', display_name: 'Cleo Park', role: 'teaching' }] },
    { series_item_id: 'i2', people: [{ profile_id: 'p3', display_name: 'DJ Sol', role: 'djing' }] },
  ],
};

export const venues = [
  { id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  { id: 'v2', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
];
