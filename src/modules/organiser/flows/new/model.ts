import { addDaysToKey } from '@/lib/londonDate';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { weekdayOf } from '@/modules/organiser/shared/createModel';
import {
  createDraftPayload, lifecycleCommand, upsertCommand, weeklyRuleCommand, type OwnerCommand, type OwnerFormat,
} from '@/modules/organiser/shared/seriesCommands';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import type { NewEventFormat } from '@/modules/organiser/shell/paths';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { NO_SESSION_REASON } from '@/modules/organiser/events/lifecycleModel';
import { goLiveLabel, profileFieldsLeft, profileRowLabel, showsProfileRow, type GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';

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

/** C20: the one create. The organiser key is attached by createSeriesCommand. */
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

/**
 * C23 -> C24: ONE lifecycle command; the server gates on readiness, a cover and a
 * scheduled date (A1b). Until admin A1 is on prod (an owner's draft -> live is
 * refused there, PARITY-GAP C28a) the wizard sends NOTHING and says it saved a draft.
 */
export const liveCommands = (a1 = A1_APPLIED): OwnerCommand[] => (a1 ? [lifecycleCommand('live')] : []);

/** Why the last step's button is off: no photo yet (it does not promise going live while A1 waits). */
export const coverStepReason = (hasCover: boolean, a1 = A1_APPLIED): string | null =>
  hasCover ? null : a1 ? 'Choose a photo to go live.' : 'Choose a photo first.';

/** The wizard has no session step: say what to do instead (the empty state names the way out). */
export const NO_SESSION_NEW_REASON = `${NO_SESSION_REASON} Save as draft, then add a session from the event.`;
export const CHECKING_REASON = 'One moment, checking your event.';

/** The server said not ready but listed nothing this step can name. */
export const NOT_READY_REASON = 'Something on the event is not ready yet. Save as draft, then open the event to see what is left.';

/** The last step's server answer (D91): loading, could not be read, or the answer itself. */
export type ServerCheck = { status: 'pending' } | { status: 'error' } | { status: 'ready'; check: GoLiveCheck };

/**
 * Why the last step's button is off: no photo, then the SAME server answer the
 * event card reads (series_go_live_check_v1, D91), a missing session first
 * (#885's reason). A check that could not be read never blocks: the server still
 * refuses a series that is not ready, and that refusal is shown.
 */
export function finishReason(hasCover: boolean, server: ServerCheck, a1 = A1_APPLIED): string | null {
  const cover = coverStepReason(hasCover, a1);
  if (cover) return cover;
  if (!a1) return null;
  if (server.status === 'pending') return CHECKING_REASON;
  if (server.status === 'error' || server.check.ready) return null;
  const { check } = server;
  if (check.eventMissing.some((i) => i.code === 'session')) return NO_SESSION_NEW_REASON;
  const first = check.eventMissing[0];
  if (first) return `${goLiveLabel(first.code)} first.`;
  if (showsProfileRow(check)) return `${profileRowLabel(profileFieldsLeft(check))} first.`;
  return NOT_READY_REASON;
}

/**
 * "Save as draft and leave": with A1 on, always; with A1 off only while the main
 * button is off (no photo), since that button then saves the draft itself.
 */
export const offerLeave = (hasCover: boolean, a1 = A1_APPLIED): boolean => a1 || !hasCover;

/** The last step's button: Go live, or Save as draft while going live waits on A1. */
export const finishLabel = (a1 = A1_APPLIED): string => (a1 ? 'Go live' : 'Save as draft');

/** Said on the last step and on Done while going live waits on A1 (plain words, no jargon). */
export const DRAFT_ONLY_NOTE = 'Going live needs the next platform update. Your event is saved as a draft until then; go live from the event.';
export const DRAFT_SAVED_MESSAGE = 'Saved as a draft. Going live needs the next platform update.';

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
