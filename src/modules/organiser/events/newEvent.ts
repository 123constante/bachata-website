import { addDaysToKey } from '@/lib/londonDate';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { createDraft, emptyCreateForm, weekdayOf } from '@/modules/organiser/shared/createModel';
import { addDateCommand, createPayload, weeklyRuleCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';

import type { NewEventFormat } from './eventType';

/** Every new event starts the same way; the editor changes any of it. */
export const NEW_EVENT_START_TIME = '20:00';
export const NEW_EVENT_FIRST_DATE_IN_DAYS = 7;
/** default_duration_minutes a create sends (G4; the server takes 1-1200), so each date has an end time. */
export const NEW_EVENT_DURATION_MINUTES = 120;

/**
 * The create (a series.upsert on a fresh id) in the chosen FORMAT, and the schedule that
 * follows it (W1). One-off: one date, as before. Recurring: the one weekly rule an owner may
 * set, on the first date's weekday (createModel's followUpCommands sends the same). No
 * category and no session: the server derives the category from the sessions, which the
 * organiser adds on the draft (W2).
 */
export function newEventCommands(name: string, today: string, organiserId: string, cityId: string | null, format: NewEventFormat): { create: OwnerCommand; schedule: OwnerCommand } {
  const startDate = addDaysToKey(today, NEW_EVENT_FIRST_DATE_IN_DAYS);
  const form = { ...emptyCreateForm(), kind: 'weekly_class' as const, name, date: startDate, startTime: NEW_EVENT_START_TIME };
  const draft = { ...createDraft(form), format, durationMinutes: NEW_EVENT_DURATION_MINUTES };
  return {
    create: createSeriesCommand(createPayload(draft, cityId), organiserId),
    schedule: format === 'recurring' ? weeklyRuleCommand(weekdayOf(startDate)) : addDateCommand(startDate),
  };
}

/** The series a duplicate name is checked against (d32): live or paused only. */
const DUPLICATE_STATUSES = new Set(['live', 'paused']);

/**
 * The organiser's live or paused event already called this name, case- and space-insensitive
 * (d32), read from the home list already loaded (no RPC). A QUIET note only: it never blocks
 * Create. Null for an empty name or no match; the first by name when several match.
 */
export function duplicateNamed(name: string, series: readonly Pick<HomeSeriesFull, 'id' | 'name' | 'lifecycle_status'>[]): { id: string; name: string } | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const hit = series
    .filter((s) => DUPLICATE_STATUSES.has(s.lifecycle_status) && s.name.trim().toLowerCase() === wanted)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0];
  return hit ? { id: hit.id, name: hit.name } : null;
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
