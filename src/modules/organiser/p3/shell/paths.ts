/**
 * Every URL in the P3 organiser area (flag organiserP3). A separate base from
 * the R1 area (/account/o), so nothing there changes while P3 is built.
 */
export const P3_BASE = '/account/p3';

export const P3_PATHS = {
  home: P3_BASE,
  events: `${P3_BASE}/events`,
  stats: `${P3_BASE}/stats`,
  you: `${P3_BASE}/you`,
  /** One event's page (W2a). */
  event: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}`,
  /** One event's All dates (W2b). */
  eventDates: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/dates`,
  /** One event's Name and details (W3a). */
  eventDetails: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/details`,
  /** One event's Prices (W3a). */
  eventPrices: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/prices`,
  /** One event's History, read only (W3b-1). */
  eventHistory: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/history`,
} as const;

export type P3Tab = 'home' | 'events' | 'stats' | 'you';
export const P3_TABS: readonly P3Tab[] = ['home', 'events', 'stats', 'you'];
