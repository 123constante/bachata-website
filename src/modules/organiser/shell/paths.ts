/** Every URL in the new organiser area. Build links with these, never by hand. */
export const ORG_BASE = '/account/o';

export const ORG_PATHS = {
  home: ORG_BASE,
  events: `${ORG_BASE}/events`,
  newEvent: `${ORG_BASE}/events/new`,
  event: (seriesId: string) => `${ORG_BASE}/events/${encodeURIComponent(seriesId)}`,
  date: (seriesId: string, occurrenceId: string) =>
    `${ORG_BASE}/events/${encodeURIComponent(seriesId)}/dates/${encodeURIComponent(occurrenceId)}`,
  team: `${ORG_BASE}/team`,
  profile: `${ORG_BASE}/profile`,
} as const;
