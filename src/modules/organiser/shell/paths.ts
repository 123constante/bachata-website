/**
 * Every URL in the organiser area (R1 table, plan 4.1 as amended by D44).
 * Build links with these, never by hand: shell/__tests__/noHandBuiltLinks.test.ts
 * fails on a '/account/o' literal anywhere else in the module.
 */
export const ORG_BASE = '/account/o';

export type NewEventFormat = 'one_off' | 'recurring';

const id = encodeURIComponent;
const changeDate = (seriesId: string, occurrenceId: string) => `${ORG_BASE}/change/${id(seriesId)}/${id(occurrenceId)}`;

export const ORG_PATHS = {
  home: ORG_BASE,
  switch: `${ORG_BASE}/switch`,

  change: `${ORG_BASE}/change`,
  changeEvent: (seriesId: string) => `${ORG_BASE}/change/${id(seriesId)}`,
  changeDate,
  changeTime: (seriesId: string, occurrenceId: string) => `${changeDate(seriesId, occurrenceId)}/time`,
  changeVenue: (seriesId: string, occurrenceId: string) => `${changeDate(seriesId, occurrenceId)}/venue`,
  changeDay: (seriesId: string, occurrenceId: string) => `${changeDate(seriesId, occurrenceId)}/day`,

  add: `${ORG_BASE}/add`,
  addEvent: (seriesId: string) => `${ORG_BASE}/add/${id(seriesId)}`,
  /** `date` is the ISO day (London wall clock). */
  addDate: (seriesId: string, date: string) => `${ORG_BASE}/add/${id(seriesId)}/${id(date)}`,

  cancel: `${ORG_BASE}/cancel`,
  cancelEvent: (seriesId: string) => `${ORG_BASE}/cancel/${id(seriesId)}`,
  cancelDate: (seriesId: string, occurrenceId: string) => `${ORG_BASE}/cancel/${id(seriesId)}/${id(occurrenceId)}`,

  /** New event (D44): the format rides in the URL; the server draft is created at the name step. */
  newWhat: `${ORG_BASE}/new/what`,
  newName: (format: NewEventFormat) => `${ORG_BASE}/new/name?format=${id(format)}`,
  newVenue: (seriesId: string) => `${ORG_BASE}/new/${id(seriesId)}/venue`,
  newDate: (seriesId: string) => `${ORG_BASE}/new/${id(seriesId)}/date`,
  newTime: (seriesId: string) => `${ORG_BASE}/new/${id(seriesId)}/time`,
  newCover: (seriesId: string) => `${ORG_BASE}/new/${id(seriesId)}/cover`,

  events: `${ORG_BASE}/events`,
  event: (seriesId: string) => `${ORG_BASE}/events/${id(seriesId)}`,
  eventDetails: (seriesId: string) => `${ORG_BASE}/events/${id(seriesId)}/details`,

  team: `${ORG_BASE}/team`,
  teamAdd: `${ORG_BASE}/team/add`,
  teamPerson: (userId: string) => `${ORG_BASE}/team/${id(userId)}`,
  handover: `${ORG_BASE}/handover`,
  handoverTo: (userId: string) => `${ORG_BASE}/handover/${id(userId)}`,

  page: `${ORG_BASE}/page`,
  more: `${ORG_BASE}/more`,
  cover: (seriesId: string) => `${ORG_BASE}/cover/${id(seriesId)}`,
  done: `${ORG_BASE}/done`,

  // Deprecated: main's three keys, kept on main's URLs so the screens and tests
  // that still use them keep working; OrganiserRoutes redirects each (replace)
  // to its R1 path (legacyPaths.ts moduleLegacyPath). Each goes when the slice
  // that rewrites its last caller lands (S1, S2, S4, S5, S7).
  /** @deprecated use `newWhat` (redirects there). */
  newEvent: `${ORG_BASE}/events/new`,
  /** @deprecated use `changeDate` (redirects there). */
  date: (seriesId: string, occurrenceId: string) => `${ORG_BASE}/events/${id(seriesId)}/dates/${id(occurrenceId)}`,
  /** @deprecated use `page` (redirects there). */
  profile: `${ORG_BASE}/profile`,
} as const;
