import { addDaysToKey } from '@/lib/londonDate';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { weekdayOf } from '@/modules/organiser/shared/createModel';
import {
  createDraftPayload, lifecycleCommand, upsertCommand, weeklyRuleCommand, type OwnerCommand, type OwnerFormat,
} from '@/modules/organiser/shared/seriesCommands';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import type { NewEventFormat } from '@/modules/organiser/shell/paths';

/**
 * New event, one question per screen (plan 4.5, D44, D54, D55). Pure: every
 * screen sends exactly the command(s) built here, so a table test can pin
 * each step to its command kind.
 */

/** Exactly the two creatable formats (R3-1). Course and festival are never created in R1. */
export const NEW_FORMATS: ReadonlyArray<{ format: NewEventFormat; label: string }> = [
  { format: 'recurring', label: 'Weekly night' },
  { format: 'one_off', label: 'One night' },
];

export function parseFormat(raw: string | null | undefined): NewEventFormat | null {
  return NEW_FORMATS.some((f) => f.format === raw) ? (raw as NewEventFormat) : null;
}

/** C20: the one create. `organiser_ids` is attached by createSeriesCommand. */
export const draftCommand = (name: string, format: OwnerFormat, organiserId: string): OwnerCommand =>
  createSeriesCommand(createDraftPayload(name, format), organiserId);

/** C21: ONE upsert. The city rides along when known (a series with no city cannot go live). */
export const venueCommands = (venueId: string, cityId: string | null): OwnerCommand[] => [
  upsertCommand({ default_venue_id: venueId, ...(cityId ? { default_city_id: cityId } : {}) }),
];

/** C22: ONE upsert; a weekly night then ONE set_recurrence on that weekday (D55). A one night sends nothing more. */
export function dateCommands(format: NewEventFormat, date: string): OwnerCommand[] {
  const first = upsertCommand({ default_start_date: date });
  return format === 'recurring' ? [first, weeklyRuleCommand(weekdayOf(date))] : [first];
}

/** C22b: ONE upsert. */
export const timeCommands = (time: string): OwnerCommand[] => [upsertCommand({ default_local_start_time: time })];

/** C23: ONE upsert (the picture is already uploaded). */
export const coverCommands = (url: string): OwnerCommand[] => [upsertCommand({ default_cover_image_url: url })];

/** C23 -> C24: ONE lifecycle command; the server gates on readiness, a cover and a scheduled date (A1b). */
export const liveCommands = (): OwnerCommand[] => [lifecycleCommand('live')];

/** The next 30 days from today, soonest first (C22). */
export function firstDateChoices(today: string, days = 30): Array<{ date: string; label: string }> {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysToKey(today, i);
    return { date, label: dayLabel(date) };
  });
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (value: string): boolean => HHMM.test(value);

/** Why a step button is off (shown beside it, never silent); null when it can go. */
export const nameBlock = (name: string): string | null => (name.trim() ? null : 'Type a name to go on.');
export const timeBlock = (time: string): string | null => (isTime(time) ? null : 'Pick a start time to go on.');

/** C24 "Live - Friday 23 October, 20:00". */
export const liveMessage = (date: string | null, time: string | null): string =>
  date && time ? `Live - ${dayLabel(date)}, ${time.slice(0, 5)}` : 'Live';

/** The question on each step. */
export const STEP_TITLE = {
  what: 'What are you listing?',
  name: 'What is it called?',
  venue: 'Where is it?',
  date: 'When is the first one?',
  time: 'What time does it start?',
  cover: 'Add a photo',
} as const;
