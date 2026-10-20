// How a series' life reads on EVERY organiser screen (W3, owner decision d31): the
// status tag, the Events-list section and the row's line come from here, never from
// a second copy. Display only: the stored lifecycle_status never changes and no job
// runs. Pure (no client import).
//
// "Upcoming" is any date from London today on, cancelled ones included: the same set
// organiser_home_v1 counts as upcoming_count (read with pg_get_functiondef, SELECT
// only, 2026-10-14) and upcomingDates() returns in the editor (the workspace lists
// the NEWEST 100 dates, so a series over 100 dates still carries its upcoming ones).

import { isClosed, lifecycleTag, type Tag } from './eventState';

/** A live one-off, course or festival whose dates have all passed. */
export const FINISHED = 'Finished';
/** A live repeating series with no date listed from today on. */
export const NOTHING_COMING_UP = 'Nothing coming up';
/**
 * What the person can do about NOTHING_COMING_UP. The editor's When group says how:
 * Extend on a weekly rule, else (dates listed one by one) ask the team. The list read
 * carries no rule, so the row names no control, only where the answer is.
 */
export const ADD_DATES_NOTE = 'Open it to see how to add dates.';

export type LifeSection = 'current' | 'past';

export interface Life {
  /** The Events list section: current (Upcoming / Live) or the collapsed Past. */
  section: LifeSection;
  /** The status tag (list row, editor header). */
  tag: Tag;
  /** What the row says the person can do, or null when the row's usual line stands. */
  note: string | null;
}

export interface LifeInput {
  lifecycle_status: string;
  format: string | null;
}

/**
 * The one mapping. Only a LIVE series reads Finished / Nothing coming up: a draft,
 * a series in review or with changes needed, and a paused one keep their own word
 * (the organiser has a step to take there); ended and archived are already history.
 */
export function seriesLife(series: LifeInput, upcomingCount: number): Life {
  const status = series.lifecycle_status;
  if (isClosed(status)) return { section: 'past', tag: lifecycleTag(status), note: null };
  if (status === 'live' && upcomingCount <= 0) {
    return series.format === 'recurring'
      ? { section: 'past', tag: { tone: 'neutral', label: NOTHING_COMING_UP }, note: ADD_DATES_NOTE }
      : { section: 'past', tag: { tone: 'neutral', label: FINISHED }, note: null };
  }
  return { section: 'current', tag: lifecycleTag(status), note: null };
}


/**
 * S-FEEDBACK 5: Finished / Nothing coming up. The event screen then offers only See it live
 * (no Pause, no End); adding a date brings the full set back. The SAME mapping as the tag,
 * so the two cannot disagree. Draft, paused, ended and archived are never "nothing coming up".
 */
export const nothingComingUp = (series: LifeInput, upcomingCount: number): boolean =>
  !isClosed(series.lifecycle_status) && seriesLife(series, upcomingCount).section === 'past';
