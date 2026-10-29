/**
 * Every URL in the P3 organiser area (flag organiserP3). A separate base from
 * the R1 area (/account/o), so nothing there changes while P3 is built.
 */
import { ORG_PATHS } from '../../shell/paths';

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
  /** W4a: the screens the You hub pushes (back = You). */
  youSwitch: `${P3_BASE}/you/switch`,
  youPage: `${P3_BASE}/you/page`,
  youTeam: `${P3_BASE}/you/team`,
  youTeamAdd: `${P3_BASE}/you/team/add`,
  youTeamAddFor: (name: string) => `${P3_BASE}/you/team/add?q=${encodeURIComponent(name)}`,
  youTeamPerson: (userId: string) => `${P3_BASE}/you/team/${encodeURIComponent(userId)}`,
  youHandover: `${P3_BASE}/you/handover`,
  youHandoverTo: (userId: string) => `${P3_BASE}/you/handover/${encodeURIComponent(userId)}`,
  youWelcome: (organiserId: string) => `${P3_BASE}/you/welcome?o=${encodeURIComponent(organiserId)}`,
  /** Welcome (no page yet) and Add a page: find, claim or ask to join, or create (W4b). */
  youAdd: `${P3_BASE}/you/add`,
  /** W4b build 2: the onboarding person screens 10-20 (full screen, no tab bar); `o` = the page About is for. */
  youDetails: `${P3_BASE}/you/details`,
  youDetailsFor: (organiserId: string) => `${P3_BASE}/you/details?o=${encodeURIComponent(organiserId)}`,
  /** W4b build 2 slices 2+3: the whole onboarding (Welcome, page screens, person screens, Review, Live); `o` = the page, `at` = a step. */
  start: `${P3_BASE}/start`,
  /** Done after a team change or a page save, in P3's frame (W4a fix 1). */
  youDone: `${P3_BASE}/you/done`,
  /** One event's Name and details (W3a). */
  eventDetails: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/details`,
  /** One event's Prices (W3a). */
  eventPrices: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/prices`,
  /** One event's History, read only (W3b-1). */
  eventHistory: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/history`,
} as const;

/**
 * Where an accepted invite lands (review 1080 F5, owner decision 2026-10-28): P3's Welcome when
 * organiserP3 AND organiserSelfServe are on, else R1's, unchanged. The ONE answer for any caller.
 */
export const acceptedInviteLanding = (organiserId: string, flags: { organiserP3: boolean; organiserSelfServe: boolean }): string =>
  flags.organiserP3 && flags.organiserSelfServe ? P3_PATHS.youWelcome(organiserId) : ORG_PATHS.welcome(organiserId);

export type P3Tab = 'home' | 'events' | 'stats' | 'you';
export const P3_TABS: readonly P3Tab[] = ['home', 'events', 'stats', 'you'];
