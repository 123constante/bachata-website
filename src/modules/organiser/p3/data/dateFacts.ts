import { isRuleDate, weeklyRule, type DateDetail, type WorkspaceDate } from '../../shared/seriesModel';
import { hasOwnTime } from '../../flows/change/changeModel';
import type { EventWorkspace } from '../../events/eventModel';
import { dateMarks, kindOf, type DateFacts, type IsoDate } from '../model';
import { mainWeekday, onPatternCadence, repeatShape, type RepeatShape } from '../model/repeat';

/**
 * One stored date as the date rules (model/dates.ts) read it. Its own file so the event
 * page (eventPage.ts) and the date screens (dates.ts) share it without an import cycle.
 */

/** The date has its own Where / About / Ticket link / photo (a cancellation reason is not one). */
export function ownDetailsOf(d: WorkspaceDate, detail?: DateDetail | null): boolean {
  if (detail) {
    return !!(detail.venueOverride || detail.descriptionOverride || detail.ticketUrlOverride || detail.coverImageOverride)
      || detail.titleOverride !== null || detail.galleryOverride !== null || detail.passesOverride !== null;
  }
  return d.has_override && d.lifecycle_status !== 'cancelled';
}

const SHAPES = new WeakMap<EventWorkspace, RepeatShape>();

/** How the series repeats (model repeatShape) from every stored date and every break: ONE read for the Repeats row, the sheet and Skip. */
export function repeatShapeOf(ws: EventWorkspace): RepeatShape {
  let shape = SHAPES.get(ws);
  if (!shape) {
    shape = repeatShape({
      format: ws.series.format,
      rule: ws.series.recurrence_rule,
      dates: [...ws.dates.map((d) => d.occurrence_date), ...ws.series.removed_dates],
    });
    SHAPES.set(ws, shape);
  }
  return shape;
}

/**
 * The stored weekly rule's cadence, else (no rule stored) the weekly pattern its dates show;
 * null when there is neither (dateMarks and skip then do not judge the day).
 */
function ruleDateOf(ws: EventWorkspace, date: IsoDate): boolean | null {
  // isRuleDate only knows a rule that runs every week; every 2-4 weeks cannot be judged here.
  const rule = weeklyRule(ws.series.recurrence_rule);
  if (rule) return rule.interval === 1 ? isRuleDate(date, ws.series) : null;
  const shape = repeatShapeOf(ws);
  return shape.from === 'dates' ? onPatternCadence(shape.pattern, date) : null;
}

export function dateFactsOf(ws: EventWorkspace, d: WorkspaceDate, detail?: DateDetail | null): DateFacts {
  return {
    date: d.occurrence_date,
    state: d.lifecycle_status === 'cancelled' ? 'cancelled' : 'scheduled',
    ruleDate: ruleDateOf(ws, d.occurrence_date),
    ownTime: hasOwnTime(d, ws.series.default_local_start_time),
    ownDetails: ownDetailsOf(d, detail),
  };
}

/**
 * A break: a tombstone in removed_dates, not a stored date (shown whatever the rule). A move or a
 * removed added date leaves one too, so with no rule stored a tombstone off the weekday most dates
 * run on is not offered back (the server would restore it with no cadence to check).
 */
export function breakFactsOf(ws: EventWorkspace, date: IsoDate): DateFacts {
  let ruleDate = ruleDateOf(ws, date);
  if (ruleDate === null && ws.series.recurrence_rule == null) {
    const main = mainWeekday(ws.dates.map((d) => d.occurrence_date));
    if (main !== null && new Date(`${date}T12:00:00Z`).getUTCDay() !== main) ruleDate = false;
  }
  return { date, state: 'skip', ruleDate, ownTime: false, ownDetails: false };
}

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
