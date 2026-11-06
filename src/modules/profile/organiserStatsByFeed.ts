import { MAX_ORGANISER_STATS, organiserStats, type OrganiserStat, type OrganiserStatNight } from './organiserStats';

/**
 * The organiser page's stats when a nights feed may have FAILED (fix round 1,
 * review MED-3). organiserStats() is the one mapping; this decides which of its
 * answers a working feed alone can prove, so one blip never discards them all:
 *
 * - both feeds ok: organiserStats() as is.
 * - a feed failed: only the stats that need nothing from it are kept; the
 *   failed feed's own headline stat is a marked dash (never 0, never a number
 *   from half the data):
 *   - future failed: "Next night" is a dash. "Last night" is dropped (it only
 *     means "nothing upcoming", which is now unknowable); "Every week" needs
 *     both feeds and is dropped.
 *   - past failed: "Nights hosted" is a dash. "Every week" and the estimated
 *     "Running" (earliest listed night) are dropped; a real founded year stays.
 * - The events feed is the join source for both lists, so it failing fails both.
 *
 * Order stays the mapping's (next/last, ..., hosted, ..., running since), at
 * most MAX_ORGANISER_STATS.
 */
export interface ShownOrganiserStat extends OrganiserStat {
  /** The stat's feed failed: the value is FAILED_STAT_VALUE, not data. */
  failed?: boolean;
}

/** En dash: what a failed feed's stat shows in place of a value. */
export const FAILED_STAT_VALUE = '–';

export interface StatsByFeedInput {
  now: Date;
  upcoming: OrganiserStatNight[];
  past: OrganiserStatNight[];
  upcomingFailed: boolean;
  pastFailed: boolean;
  foundedYear: number | null;
}

const dash = (key: 'next_night' | 'nights_hosted'): ShownOrganiserStat => ({
  key,
  value: FAILED_STAT_VALUE,
  label: key === 'next_night' ? 'Next night' : 'Nights hosted',
  failed: true,
});

const ORDER: Record<string, number> = {
  next_night: 0, last_night: 0, tickets_sold: 1, dancers_came: 2, nights_hosted: 3, weekly_rhythm: 4, running_since: 5, venues: 6,
};

export function organiserStatsByFeed(i: StatsByFeedInput): ShownOrganiserStat[] {
  const nights = [
    ...(i.upcomingFailed ? [] : i.upcoming.map((n) => ({ ...n, isPast: false }))),
    ...(i.pastFailed ? [] : i.past.map((n) => ({ ...n, isPast: true }))),
  ];
  const all = organiserStats({ now: i.now, nights, foundedYear: i.foundedYear, ticketsSold: null, dancersCame: null });
  if (!i.upcomingFailed && !i.pastFailed) return all;
  // The mapping caps at three, so a stat it dropped for room may be needed once the
  // failed feed's stats are gone: read each survivor from its own call.
  const kept: ShownOrganiserStat[] = all.filter((s) =>
    (s.key === 'next_night' && !i.upcomingFailed) || (s.key === 'nights_hosted' && !i.pastFailed));
  // Only a real founded year: an estimated "Running" reads the earliest night, maybe in the failed feed.
  const founded = organiserStats({ now: i.now, nights: [], foundedYear: i.foundedYear }).find((s) => s.key === 'running_since');
  if (founded) kept.push(founded);
  if (i.upcomingFailed) kept.push(dash('next_night'));
  if (i.pastFailed) kept.push(dash('nights_hosted'));
  return kept.sort((a, b) => ORDER[a.key] - ORDER[b.key]).slice(0, MAX_ORGANISER_STATS);
}
