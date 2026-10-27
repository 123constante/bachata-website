import { isRuleDate, type DateDetail, type WorkspaceDate } from '../../shared/seriesModel';
import { hasOwnTime } from '../../flows/change/changeModel';
import type { EventWorkspace } from '../../events/eventModel';
import { dateMarks, kindOf, type DateFacts, type IsoDate } from '../model';

/**
 * One stored date as the date rules (model/dates.ts) read it. Its own file so the event
 * page (eventPage.ts) and the date screens (dates.ts) share it without an import cycle.
 */

/** The date has its own Where / About / Ticket link / photo (a cancellation reason is not one). */
export function ownDetailsOf(d: WorkspaceDate, detail?: DateDetail | null): boolean {
  if (detail) return !!(detail.venueOverride || detail.descriptionOverride || detail.ticketUrlOverride || detail.coverImageOverride);
  return d.has_override && d.lifecycle_status !== 'cancelled';
}

export function dateFactsOf(ws: EventWorkspace, d: WorkspaceDate, detail?: DateDetail | null): DateFacts {
  return {
    date: d.occurrence_date,
    state: d.lifecycle_status === 'cancelled' ? 'cancelled' : 'scheduled',
    ruleDate: isRuleDate(d.occurrence_date, ws.series),
    ownTime: hasOwnTime(d, ws.series.default_local_start_time),
    ownDetails: ownDetailsOf(d, detail),
  };
}

/** A break: a tombstone on the weekly rule's cadence (removed_dates), not a stored date. */
export const breakFactsOf = (ws: EventWorkspace, date: IsoDate): DateFacts =>
  ({ date, state: 'skip', ruleDate: isRuleDate(date, ws.series), ownTime: false, ownDetails: false });

const ruleMode = (rule: unknown): string | null =>
  rule && typeof rule === 'object' && typeof (rule as { mode?: unknown }).mode === 'string' ? (rule as { mode: string }).mode : null;

/** The date's tags through the ONE mapping (model dateMarks). */
export function marksOf(ws: EventWorkspace, d: WorkspaceDate, facts: DateFacts, today: IsoDate) {
  return dateMarks(kindOf(ws.series.format, ruleMode(ws.series.recurrence_rule)), facts, {
    today,
    hasOverride: d.has_override,
    sessionChanges: d.session_overrides_count > 0 || d.added_sessions_count > 0,
  });
}
