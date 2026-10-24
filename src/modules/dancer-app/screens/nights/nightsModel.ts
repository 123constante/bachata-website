import { addDaysToKey, londonDaysBetweenKeys } from '@/lib/londonDate';
import { GOING_COPY, goingNightStatus, nightLine, type GoingNightStatus, type MyGoing, type MyGoingNight } from '@/modules/going';

/**
 * ONE mapper for get_my_going_v1 (the going module's useMyGoing). Home, Nights
 * and /account/attendance all go through mapMyGoing, so the same night reads
 * the same everywhere. Going is ONE night (an occurrence); there is no
 * "Interested" any more. Upcoming vs past is the RPC's own split (past = the
 * night has ended), never a client clock.
 *
 * `seriesId` is the event's public id (public_event_id): the level vote is keyed
 * by it, never by the occurrence date. `starts_at_local` is a London wall clock
 * with no zone: it is rendered through the module's nightLine, never new Date().
 */
export type Night = {
  occurrenceId: string;
  /** public_event_id; null = the night has no public event (no link, no vote). */
  seriesId: string | null;
  name: string;
  /** London-calendar YYYY-MM-DD, or null when the night has no date. */
  date: string | null;
  venue: string | null;
  /** "Thursday 29 Oct \u00B7 9 PM" from starts_at_local as stored; null when unreadable. */
  when: string | null;
  /** live / ended / cancelled / not_live (the module's night status). */
  status: GoingNightStatus;
  /** Where "See event" goes (leaves the app); null = no public event. */
  href: string | null;
  past: boolean;
  /** The event (series) is live: only a listed night is the hero, nudged or voted on. */
  listed: boolean;
};

export type MappedNights = { upcoming: Night[]; past: Night[] };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}/;

export const mapMyNight = (n: MyGoingNight, past: boolean): Night => {
  const listed = n.event_lifecycle === 'live';
  const status: GoingNightStatus = past
    ? (n.is_cancelled ? 'cancelled' : 'ended')
    // The RPC already says it has not ended: no clock here (now = null never calls a night ended).
    : goingNightStatus({ startsAtLocal: n.starts_at_local, isCancelled: n.is_cancelled, eventLive: listed }, null);
  return {
    occurrenceId: n.occurrence_id,
    seriesId: n.public_event_id,
    name: n.event_title?.trim() || 'Untitled event',
    date: n.occurrence_date && DATE_KEY.test(n.occurrence_date) ? n.occurrence_date.slice(0, 10) : null,
    venue: n.venue_name?.trim() || null,
    when: nightLine(n.starts_at_local),
    status,
    href: n.public_event_id ? `/event/${n.public_event_id}` : null,
    past,
    listed,
  };
};

/**
 * The RPC's lists, in the RPC's order (upcoming soonest first, past most recent
 * first). THE one rule for "Nights you went to" (Nights screen and
 * /account/attendance both read it): a cancelled past night is left out --
 * nobody went to it -- so it is never listed, voted on or nudged. An upcoming
 * cancelled night stays, tagged Cancelled, so the person can see it is off.
 */
export const mapMyGoing = (mine: MyGoing | undefined): MappedNights => ({
  upcoming: (mine?.upcoming ?? []).map((n) => mapMyNight(n, false)),
  past: (mine?.past ?? []).filter((n) => !n.is_cancelled).map((n) => mapMyNight(n, true)),
});

/** The tag on a row: Going / Went / Cancelled (module words, one mapping). */
export const statusLabel = (n: Pick<Night, 'status' | 'past'>): string => {
  if (n.status === 'cancelled') return GOING_COPY.tagCancelled;
  return n.past ? GOING_COPY.tagWent : GOING_COPY.tagGoing;
};

/** The night's lifecycle in the module's words; null for an ordinary night. */
export const nightNote = (n: Pick<Night, 'status' | 'past'>): string | null => {
  if (n.status === 'cancelled') return GOING_COPY.cancelled;
  if (n.status === 'not_live' && !n.past) return GOING_COPY.notLive;
  return null;
};

/** The hero: the next upcoming night that is going ahead (not cancelled, event live). */
export const nextNight = (upcoming: readonly Night[]): Night | null =>
  upcoming.find((n) => n.date !== null && n.status === 'live') ?? null;

/**
 * THE upcoming going count (Home tile and the strip's Going cell read only this):
 * every upcoming night the person is going to that is not cancelled.
 */
export const goingUpcomingCount = (upcoming: readonly Night[]): number =>
  upcoming.filter((n) => n.status !== 'cancelled').length;

/** Kept name for older callers: the same count. */
export const countCommitted = goingUpcomingCount;

export const NUDGE_WINDOW_DAYS = 7;

/**
 * Past nights the person went to within the last 7 days, most recent first, one
 * per series, the event still listed. Whether the series is already rated is read
 * per series by the nudge (useSeriesLevelRating).
 */
export const nudgeCandidates = (past: readonly Night[], todayKey: string): Night[] => {
  const seen = new Set<string>();
  const out: Night[] = [];
  for (const n of past) {
    if (n.status !== 'ended' || !n.listed || n.seriesId === null || n.date === null || seen.has(n.seriesId)) continue;
    const ago = londonDaysBetweenKeys(n.date, todayKey);
    if (ago < 1 || ago > NUDGE_WINDOW_DAYS) continue;
    seen.add(n.seriesId);
    out.push(n);
  }
  return out;
};

// The pure date / path helpers live in nightsDates.ts (no going import, so the /app/*
// first load can read them while the going switch is off); re-exported here so every
// caller of the one nights mapping keeps one import.
export * from './nightsDates';
export { addDaysToKey };
