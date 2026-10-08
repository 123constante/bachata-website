import { addDaysToKey } from '@/lib/londonDate';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import { createDraft, emptyCreateForm } from '@/modules/organiser/shared/createModel';
import { addDateCommand, createPayload, type OwnerCategory, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { EXTEND_BATCH, untilForCount } from './dateCap';
import { weeklyUntilCommand } from './eventModel';
import { DEFAULT_DURATION_MINUTES, TYPE_CATEGORY, type NewEventType } from './eventType';

/** Every new event starts the same way; the editor changes any of it. */
export const NEW_EVENT_START_TIME = '20:00';
export const NEW_EVENT_FIRST_DATE_IN_DAYS = 7;

/**
 * The create (a series.upsert on a fresh id) and the schedule that follows it.
 * Every type is created 'recurring' with no rule (owners cannot create a course,
 * and a one_off can never be made weekly): a class then gets the weekly rule that
 * lists the first EXTEND_BATCH dates; a party or a workshop gets ONE date, which
 * the editor's Repeats row can make weekly later (G2, G5). The create carries the
 * type's default duration so each date has an end time (G4).
 */
export function newEventCommands(name: string, today: string, organiserId: string, cityId: string | null, type: NewEventType = 'class'): { create: OwnerCommand; schedule: OwnerCommand } {
  const startDate = addDaysToKey(today, NEW_EVENT_FIRST_DATE_IN_DAYS);
  const form = { ...emptyCreateForm(), kind: 'weekly_class' as const, name, date: startDate, startTime: NEW_EVENT_START_TIME };
  const draft = { ...createDraft(form), category: TYPE_CATEGORY[type] as OwnerCategory, durationMinutes: DEFAULT_DURATION_MINUTES[type] };
  return {
    create: createSeriesCommand(createPayload(draft, cityId), organiserId),
    schedule: type === 'class' ? weeklyUntilCommand(startDate, untilForCount({ today, startDate }, EXTEND_BATCH)) : addDateCommand(startDate),
  };
}
