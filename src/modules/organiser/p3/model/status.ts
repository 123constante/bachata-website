import { addDaysToKey } from '@/lib/londonDate';
import { fullDate } from '../../shared/dateWords';
import { seriesLife } from '../../shared/lifeLabel';
import { L } from './labels';
import type { IsoDate, P3Kind } from './types';

/** The status tag on an event (C3 `status`). `warn` = live but nothing coming up; `review` = in review / changes needed. */
export type P3StatusKey = 'live' | 'hidden' | 'finished' | 'draft' | 'review' | 'warn' | 'removed';

export interface P3Status {
  key: P3StatusKey;
  label: string;
  /** seriesLife's section: current, or past (finished, nothing coming up, ended). */
  past: boolean;
}

/**
 * THE status tag for an event on every P3 screen. The FACT comes from the one organiser
 * mapping, shared/lifeLabel.ts `seriesLife` (so P3 and the current area never disagree
 * on what state an event is in); only the WORDS are C3's where the owner renamed them
 * (Hide not Pause, C3 B3; "All classes done" for a course, C3 S18; Finished).
 * `upcoming` is organiser_home_v1's upcoming_count, the input seriesLife takes.
 * C3's "Cancelled tonight" is not here: home_v1 lists only scheduled dates.
 */
export function statusOf(lifecycle: string, format: string | null, kind: P3Kind, upcoming: number): P3Status {
  const life = seriesLife({ lifecycle_status: lifecycle, format }, upcoming);
  const past = life.section === 'past';
  if (lifecycle === 'archived') return { key: 'removed', label: L.removedTag, past };
  if (lifecycle === 'ended') return { key: 'finished', label: L.finished, past };
  if (lifecycle === 'paused') return { key: 'hidden', label: L.hidden, past };
  if (lifecycle === 'draft') return { key: 'draft', label: L.draftTag, past };
  if (lifecycle !== 'live') return { key: 'review', label: life.tag.label, past };
  if (!past) return { key: 'live', label: L.live, past };
  // live with nothing from today on: a repeating series can take more dates; anything else has run its course
  if (format === 'recurring') return { key: 'warn', label: life.tag.label, past };
  return { key: 'finished', label: kind === 'course' ? L.allDone : L.finished, past };
}

/** Before 5pm a date today is "Today", not "Tonight" (daytime classes and workshops). */
const EVENING_FROM = '17:00';

/**
 * 'Tonight' (or 'Today' for a start before 5pm), 'Tomorrow', or 'Friday 30 October'
 * (with the year when it is not this year). An unknown today ('') never guesses.
 */
export function dayWord(date: IsoDate, today: IsoDate, start?: string | null): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return fullDate(date, today);
  if (date === today) return start && start.slice(0, 5) < EVENING_FROM ? L.today : L.tonight;
  if (date === addDaysToKey(today, 1)) return L.tomorrow;
  return fullDate(date, today);
}

/** The tag of an event that was removed (archived), for the page that opens in place of it. */
export const removedStatus = (): P3Status => statusOf('archived', null, 'custom', 0);
