import { addDaysToKey } from '@/lib/londonDate';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import { createDraft, emptyCreateForm } from '@/modules/organiser/shared/createModel';
import { buildPayload, newSession, type Programme, type WireSession } from '@/modules/organiser/shared/programmeModel';
import { endTime } from '@/modules/organiser/shared/seriesModel';
import { addDateCommand, createPayload, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';

import { DEFAULT_DURATION_MINUTES, SEED_SESSION, type NewEventType } from './eventType';

/** Every new event starts the same way; the editor changes any of it. */
export const NEW_EVENT_START_TIME = '20:00';
export const NEW_EVENT_FIRST_DATE_IN_DAYS = 7;

/**
 * The create (a series.upsert on a fresh id) and the schedule that follows it.
 * Every type is created 'recurring' with no rule (owners cannot create a course,
 * and a one_off can never be made weekly) and gets ONE date, which the editor's
 * Repeats row can make weekly later (G2, G5). One date for every chip (FIX-6 F-e):
 * the chip seeds one session, so it lists only the date that session goes on; a
 * class that listed 8 weekly dates left dates 2-8 with no session. The add_date
 * reply names that date, so the seed needs no read of the date list (F-g). The
 * create carries the type's default duration so each date has an end time (G4).
 * No category: the server derives it from the sessions, and seedSessions adds the
 * first one.
 */
export function newEventCommands(name: string, today: string, organiserId: string, cityId: string | null, type: NewEventType = 'class'): { create: OwnerCommand; schedule: OwnerCommand } {
  const startDate = addDaysToKey(today, NEW_EVENT_FIRST_DATE_IN_DAYS);
  const form = { ...emptyCreateForm(), kind: 'weekly_class' as const, name, date: startDate, startTime: NEW_EVENT_START_TIME };
  const draft = { ...createDraft(form), durationMinutes: DEFAULT_DURATION_MINUTES[type] };
  return {
    create: createSeriesCommand(createPayload(draft, cityId), organiserId),
    schedule: addDateCommand(startDate),
  };
}

/**
 * The date series.add_date listed (_cmd_series_add_date_p5 answers {occurrence_id}; a replay
 * under the same key answers the stored reply, so a retry names the same date). Null when the
 * reply does not carry it.
 */
export function listedOccurrenceId(reply: { data?: Record<string, unknown> } | null | undefined): string | null {
  const id = reply?.data?.occurrence_id;
  return typeof id === 'string' && id !== '' ? id : null;
}


/**
 * The date the create listed (listedOccurrenceId) gets its complete programme with the chip's session added, for
 * organiser_set_occurrence_programme_v1. Null when the date already holds a
 * session: a Create pressed again after a lost reply must never add a second one.
 */
export function seedSessions(programme: Programme, type: NewEventType): WireSession[] | null {
  if (programme.sessions.length > 0) return null;
  const seed = SEED_SESSION[type];
  const end = endTime(NEW_EVENT_START_TIME, DEFAULT_DURATION_MINUTES[type]) ?? '';
  return buildPayload([{ ...newSession(seed.type), title: seed.title, start: NEW_EVENT_START_TIME, end }]);
}

/**
 * Whether a failed create may open the New event form again (FIX-4 F1). Only when nothing can
 * have been saved: the server refused (a coded error) the FIRST send. A coded error on a resend
 * (JWT expiry, a timeout, a serialisation failure) says nothing about the earlier send, which may
 * have saved the event; the server replays a stored create under its key without comparing the
 * payload, so an edited resend would rename it. A retry can never reopen: the page clears the
 * sent create only on this rule's true branch, so after any unconfirmed send it stays set and
 * every later press has `firstSend === false`.
 */
export function reopensAfterFailedCreate(f: { refused: boolean; firstSend: boolean }): boolean {
  return f.refused && f.firstSend;
}
