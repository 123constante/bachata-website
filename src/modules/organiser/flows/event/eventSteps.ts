// The steps of one event (C42-C44) and the details edit view (C37). Each is a
// URL: the event's own route plus one query key (the same way Cancel's put
// back rides on its confirm route), so no new route is needed in the shell.
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import type { DetailField } from '@/modules/organiser/events/eventModel';

export type EventStepName = 'pause' | 'resume' | 'end' | 'day' | 'stop';
export const EVENT_STEPS: readonly EventStepName[] = ['pause', 'resume', 'end', 'day', 'stop'];
export const STEP_PARAM = 'do';
export const EDIT_PARAM = 'edit';

export const eventStepPath = (seriesId: string, step: EventStepName) => `${ORG_PATHS.event(seriesId)}?${STEP_PARAM}=${step}`;
export const detailEditPath = (seriesId: string, field: DetailField) => `${ORG_PATHS.eventDetails(seriesId)}?${EDIT_PARAM}=${field}`;

export const readStep = (raw: string | null): EventStepName | null =>
  EVENT_STEPS.find((s) => s === raw) ?? null;

/** R3-1: a live course must keep its schedule (the server refuses stop_repeating). */
export const COURSE_STOP_REASON = 'A course keeps its weeks';
export const PATTERN_REASON = 'Only a weekly event changes its day here';

export const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A row of the event screen: null = not shown; `reason` set = shown disabled with it. */
export type ActionRow = { reason: string | null } | null;

interface SeriesFacts { lifecycle_status: string; format: string | null; recurrence_rule: unknown }

const hasRule = (rule: unknown) => !!rule && typeof rule === 'object';

/**
 * Which of the five rows an event shows, and why one cannot work. Pause only
 * when live, Resume only when paused, End only when live or paused (a draft is
 * archived, never ended); ended and archived events show none.
 */
export function eventActions(s: SeriesFacts): Record<EventStepName, ActionRow> {
  const closed = s.lifecycle_status === 'ended' || s.lifecycle_status === 'archived';
  const running = s.lifecycle_status === 'live' || s.lifecycle_status === 'paused';
  const repeats = !closed && (s.format === 'recurring' || s.format === 'course') && hasRule(s.recurrence_rule);
  return {
    pause: s.lifecycle_status === 'live' ? { reason: null } : null,
    resume: s.lifecycle_status === 'paused' ? { reason: null } : null,
    end: running ? { reason: null } : null,
    day: !repeats ? null : s.format === 'course' ? { reason: COURSE_STOP_REASON } : ownerWeeklyRule(s) ? { reason: null } : { reason: PATTERN_REASON },
    stop: !repeats ? null : s.format === 'course' ? { reason: COURSE_STOP_REASON } : { reason: null },
  };
}

export const ACTION_LABEL: Record<EventStepName, string> = {
  pause: 'Pause',
  resume: 'Resume',
  end: 'End',
  day: 'Change the day',
  stop: 'Stop repeating',
};

/** "2 coming dates come off. Past dates stay." -- what series.end_run does (S5 measured the server body). */
export function endLine(coming: number): string {
  if (coming <= 0) return 'Past dates stay.';
  return `${coming} coming ${coming === 1 ? 'date comes' : 'dates come'} off. Past dates stay.`;
}
