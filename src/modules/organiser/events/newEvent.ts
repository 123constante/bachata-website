import { addDaysToKey } from '@/lib/londonDate';
import { createSeriesCommand } from '@/modules/organiser-self-serve/selfServeApi';
import { createDraft, emptyCreateForm } from '@/modules/organiser-self-serve/createModel';
import { createPayload, type OwnerCommand } from '@/modules/organiser-self-serve/seriesCommands';
import { EXTEND_BATCH, untilForCount } from './dateCap';
import { weeklyUntilCommand } from './eventModel';

/** Every new event starts the same way; the editor changes any of it. */
export const NEW_EVENT_START_TIME = '20:00';
export const NEW_EVENT_FIRST_DATE_IN_DAYS = 7;

/**
 * The create (a series.upsert on a fresh id, as the old create form sends it:
 * a weekly class draft) and the follow-up weekly rule that lists the first
 * EXTEND_BATCH dates. Name only; the rest are defaults.
 */
export function newEventCommands(name: string, today: string, organiserId: string, cityId: string | null): { create: OwnerCommand; rule: OwnerCommand } {
  const startDate = addDaysToKey(today, NEW_EVENT_FIRST_DATE_IN_DAYS);
  const form = { ...emptyCreateForm(), kind: 'weekly_class' as const, name, date: startDate, startTime: NEW_EVENT_START_TIME };
  return {
    create: createSeriesCommand(createPayload(createDraft(form), cityId), organiserId),
    rule: weeklyUntilCommand(startDate, untilForCount({ today, startDate }, EXTEND_BATCH)),
  };
}

