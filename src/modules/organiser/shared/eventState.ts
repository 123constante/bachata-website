// How an event's state reads on EVERY organiser screen (F4): one lifecycle word
// and tag tone, what its organiser can still change, and the one repeat rule the
// owner screens can edit. Pure (no client import).
//
// The locks mirror the server, read with pg_get_functiondef (SELECT only) on
// 2026-10-08, so the UI never offers a control the server refuses:
//  - apply_aggregate_write_p5 (ADR-019): on an ENDED series an owner's
//    series.upsert, add/remove/skip/unskip date, occurrence.set_time,
//    occurrence.cancel and occurrence.set_override are admin-only, and
//    series.set_recurrence is refused too.
//  - _owner_lifecycle_transition_allowed_p5: 'ended' is never an owner source or
//    target, and nothing leaves 'archived' (draft/rejected/live/paused -> archived
//    only). So an organiser cannot resume an ended or archived event.
//  - organiser_set_occurrence_programme_v1: refused on an ended or archived series,
//    on a cancelled date and on a past date (London today).
//  - occurrence.cancel / set_override / set_time and add/remove date stop at
//    London today for an owner ('... on a past date is admin-only').
//  - series.set_recurrence needs format = 'recurring'.

import { calendarDate } from './homeModel';
import { weeklyRule, type WeeklyRule } from './seriesModel';

export type LifecycleTone = 'live' | 'draft' | 'party' | 'neutral';

/** The lifecycle words (the same words selfServeApi.LIFECYCLE_LABEL holds; a test pins them equal). */
export const LIFECYCLE_WORD: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  live: 'Live',
  rejected: 'Changes needed',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
};

const TONE: Record<string, LifecycleTone> = {
  live: 'live', draft: 'draft', pending_review: 'draft', rejected: 'draft', paused: 'neutral', ended: 'neutral', archived: 'neutral',
};

export interface Tag { tone: LifecycleTone; label: string }

/** The tag an event shows (Events list, event editor, Home rows, date page). */
export const lifecycleTag = (status: string): Tag => ({ tone: TONE[status] ?? 'draft', label: LIFECYCLE_WORD[status] ?? 'Draft' });

/** The tag one date shows: a cancelled date says so; otherwise its event's tag. */
export const dateTag = (seriesStatus: string, dateStatus: string): Tag =>
  dateStatus === 'cancelled' ? { tone: 'neutral', label: 'Cancelled' } : lifecycleTag(seriesStatus);

export const TEAM = 'the Bachata Calendar team';

/** An ended or archived event: closed history its organiser cannot change or reopen. */
export const isClosed = (status: string) => status === 'ended' || status === 'archived';

/** Why the organiser cannot change this event at all; null when they can. */
export function eventLock(status: string): string | null {
  if (status === 'ended') return `This event has ended, so it can't be changed here. To run it again, ask ${TEAM}.`;
  if (status === 'archived') return `This event is archived, so it can't be changed here. To bring it back, ask ${TEAM}.`;
  return null;
}

/** 'Ended on Sat 5 Sep' ('... 2025' in another year; null when the event has not ended or has no end date). */
export const endedOnLabel = (status: string, endedOn: string | null | undefined, today: string) =>
  status === 'ended' && endedOn ? `Ended on ${calendarDate(endedOn, today)}` : null;

/**
 * Why nothing on ONE date can be changed by its organiser (venue, cancel,
 * un-cancel, break, schedule); null when the date is open to changes.
 */
export function dateLock(seriesStatus: string, date: string, today: string): string | null {
  const past = date < today;
  if (past && isClosed(seriesStatus)) {
    return `This date has already happened and the event ${seriesStatus === 'ended' ? 'has ended' : 'is archived'}, so it can't be changed here.`;
  }
  if (isClosed(seriesStatus)) return eventLock(seriesStatus);
  if (past) return 'This date has already happened, so it can no longer be changed.';
  return null;
}

/**
 * The repeat rule the owner screens can edit: a recurring event, every week, on
 * one weekday (any end). Anything else (monthly, custom dates, every 2 weeks,
 * several weekdays, no rule, a course or festival) is shown, not changed.
 */
export function ownerWeeklyRule(series: { format: string | null; recurrence_rule: unknown }): WeeklyRule | null {
  if (series.format !== 'recurring') return null;
  const rule = weeklyRule(series.recurrence_rule);
  return rule && rule.interval === 1 && rule.weekdays.length === 1 ? rule : null;
}
