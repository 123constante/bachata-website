/**
 * Every URL in the P3 organiser area (flag organiserP3). A separate base from
 * the R1 area (/account/o), so nothing there changes while P3 is built.
 */
import { ORG_PATHS, type NewEventFormat } from '../../shell/paths';

export const P3_BASE = '/account/p3';

const createUrl = (organiserId: string | null | undefined) => (organiserId ? `${P3_BASE}/create?o=${encodeURIComponent(organiserId)}` : `${P3_BASE}/create`);
const createStepUrl = (at: 'page' | 'form', kind: string, organiserId: string | null | undefined) =>
  `${P3_BASE}/create?at=${at}&kind=${encodeURIComponent(kind)}${organiserId ? `&o=${encodeURIComponent(organiserId)}` : ''}`;
/**
 * R1's two creatable formats as P3 kinds (review 1 F9); anything else is the kind picker.
 * `recurring -> weekly` is the best mapping available (review r1 F6): R1 had only these two
 * formats, so a monthly intent never reached its URL and cannot be told apart here.
 */
const FORMAT_KIND: Record<string, string> = { one_off: 'one_date', recurring: 'weekly' };

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
  /** One event's door scanner (ticketing): full screen, no tab bar. */
  eventDoor: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/door`,
  /** One event's History, read only (W3b-1). */
  eventHistory: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/history`,
  /** One event's co-organiser pages (R1 SeriesOrganisers in P3's frame). */
  eventOrganisers: (seriesId: string) => `${P3_BASE}/events/${encodeURIComponent(seriesId)}/organisers`,
  /**
   * New event (p3-create slice 1): the kind first, then the page (2+ pages only), then the form.
   * `o` = the page, `kind` = the kind picked, `at` = the step after the kind (page | form).
   */
  create: `${P3_BASE}/create`,
  createFor: createUrl,
  createStep: createStepUrl,
  /** The old new/name?format= link: that kind's form (the page asked there when 2+ pages and none named), page kept. */
  createForFormat: (format: string | null | undefined, organiserId: string | null | undefined = null) =>
    (format && FORMAT_KIND[format] ? createStepUrl('form', FORMAT_KIND[format], organiserId) : createUrl(organiserId)),
  /** The interim bridge's URLs (#1202, R1's steps in P3's frame): each now redirects (P3Routes), the first two to New event, a draft's steps to its event page. */
  newWhat: `${P3_BASE}/new/what`,
  newWhatFor: (organiserId: string | null | undefined) => (organiserId ? `${P3_BASE}/new/what?o=${encodeURIComponent(organiserId)}` : `${P3_BASE}/new/what`),
  newName: (format: NewEventFormat) => `${P3_BASE}/new/name?format=${encodeURIComponent(format)}`,
  newVenue: (seriesId: string) => `${P3_BASE}/new/${encodeURIComponent(seriesId)}/venue`,
  newDate: (seriesId: string) => `${P3_BASE}/new/${encodeURIComponent(seriesId)}/date`,
  newTime: (seriesId: string) => `${P3_BASE}/new/${encodeURIComponent(seriesId)}/time`,
  newCover: (seriesId: string) => `${P3_BASE}/new/${encodeURIComponent(seriesId)}/cover`,
  /** Account (R1 More) and Help, pushed from You (back = You, Help's back = Account). */
  youAccount: `${P3_BASE}/you/account`,
  youHelp: `${P3_BASE}/you/help`,
} as const;

/** Onboarding's Review for a page (where Home's Continue and the editor's "To finish" line go). */
export const p3StartReview = (organiserId: string | null): string =>
  organiserId ? `${P3_PATHS.start}?o=${encodeURIComponent(organiserId)}&at=review` : P3_PATHS.start;

/**
 * Where an accepted invite lands. F-05 (brief p3-wt-land, A-team-29): the button says "Open your
 * organiser home", so while organiserP3 AND organiserSelfServe are on it opens P3's Home for that
 * page (`?o=`); else R1's Welcome, unchanged. The ONE answer for any caller.
 */
export const acceptedInviteLanding = (organiserId: string, flags: { organiserP3: boolean; organiserSelfServe: boolean }): string =>
  flags.organiserP3 && flags.organiserSelfServe ? `${P3_PATHS.home}?o=${encodeURIComponent(organiserId)}` : ORG_PATHS.welcome(organiserId);

export type P3Tab = 'home' | 'events' | 'stats' | 'you';
export const P3_TABS: readonly P3Tab[] = ['home', 'events', 'stats', 'you'];
