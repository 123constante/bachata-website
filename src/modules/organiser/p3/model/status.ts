import { addDaysToKey } from '@/lib/londonDate';
import { fullDate } from '../../shared/dateWords';
import { seriesLife } from '../../shared/lifeLabel';
import { L } from './labels';
import type { IsoDate, P3Kind } from './types';

/** The status tag on an event (C3 `status`). `warn` = live but nothing coming up; `review` = in review / changes needed. */
export type P3StatusKey = 'live' | 'hidden' | 'finished' | 'draft' | 'review' | 'warn';

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
  if (lifecycle === 'ended' || lifecycle === 'archived') return { key: 'finished', label: L.finished, past };
  if (lifecycle === 'paused') return { key: 'hidden', label: L.hidden, past };
  if (lifecycle === 'draft') return { key: 'draft', label: L.draftTag, past };
  if (lifecycle !== 'live') return { key: 'review', label: life.tag.label, past };
  if (!past) return { key: 'live', label: L.live, past };
  // live with nothing from today on: a repeating series can take more dates; anything else has run its course
  if (format === 'recurring') return { key: 'warn', label: life.tag.label, past };
  return { key: 'finished', label: kind === 'course' ? L.allDone : L.finished, past };
}

/** The one control Home's "Nothing coming up" card shows: Events, or New event. */
export type NextUpAction = 'events' | 'new';

export interface NextUpAdvice {
  copy: string;
  action: NextUpAction;
}

/**
 * FIXLIST F-16: why Home has no Next up, and the ONE control that works for it. Read from
 * statusOf (lifecycle x a date coming x format), so the words never offer dates to an event
 * tagged Finished and never name a control that is not on the card.
 */
export function nextUpAdviceOf(rows: ReadonlyArray<{ lifecycle: string; status: P3Status }>): NextUpAdvice {
  // a live weekly event with nothing coming up can take more dates (its event page has Add a date)
  if (rows.some((r) => r.status.key === 'warn')) {
    return { copy: 'Your weekly event has no dates coming up. Open it in Events and add dates; the next one shows here.', action: 'events' };
  }
  if (rows.some((r) => r.lifecycle === 'draft')) {
    return { copy: 'Nothing is live yet. Open a draft in Events and put it live; its next date shows here.', action: 'events' };
  }
  if (rows.some((r) => r.lifecycle === 'paused')) {
    return { copy: 'Your events are hidden. Open one in Events and show it again; its next date shows here.', action: 'events' };
  }
  if (rows.some((r) => r.status.key === 'review')) {
    return { copy: 'Your event is waiting for a check. Its next date shows here once it is live; Events shows where it stands.', action: 'events' };
  }
  // live, but a one-off or a course whose dates have all passed: it cannot take new dates
  if (rows.some((r) => r.lifecycle === 'live')) {
    return { copy: 'Your events have all happened, and a one-off or a course cannot take new dates. Open Events to see them or add a new event there.', action: 'events' };
  }
  return { copy: 'Nothing is on the calendar right now. Add an event and its next date shows here.', action: 'new' };
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
