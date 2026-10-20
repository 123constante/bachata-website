// Change a date (S2, boards C2-C6): the pure facts the six steps show. Dates
// are London wall-clock keys throughout (dateList.ts); nothing is converted
// through a zone, so a date moved across 25 October keeps its time.

import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import { isListedSeries, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import { comingDates, comingDays, dayLabel, moreDatesCount, type DateRow, type DayRow } from '@/modules/organiser/shared/dateList';
import { dateLock, eventLock } from '@/modules/organiser/shared/eventState';
import type { SeriesWorkspace, WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { addDaysToKey } from '@/lib/londonDate';

/** Every listed series of the login, across its pages (a series shared by two pages is listed once). */
function allSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const seen = new Set<string>();
  return (home?.organisers ?? []).flatMap((o) => o.series ?? []).filter((s) => {
    if (!isListedSeries(s) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** C2: the login's LIVE series with at least one coming scheduled date. */
export function changeableSeries(home: OrganiserHome | undefined): HomeSeriesFull[] {
  const today = home?.today ?? '';
  return allSeries(home).filter((s) => s.lifecycle_status === 'live' && comingDates(s, today, 1).length > 0);
}

export const findSeries = (home: OrganiserHome | undefined, seriesId: string): HomeSeriesFull | null =>
  allSeries(home).find((s) => s.id === seriesId) ?? null;

/**
 * The series with every date the workspace read holds (home_v1 lists only the
 * first three): the same comingDates / comingDays rules, over the full list.
 */
function withWorkspaceDates(series: HomeSeriesFull, ws: SeriesWorkspace | undefined): HomeSeriesFull {
  if (!ws) return series;
  return {
    ...series,
    next_dates: ws.dates.map((d) => ({
      occurrence_id: d.id,
      occurrence_date: d.occurrence_date,
      lifecycle_status: d.lifecycle_status,
      materialised_start_utc: d.materialised_start_utc,
      has_own_changes: d.has_override,
    })),
  };
}

/** C3: coming scheduled dates, soonest first. */
export const changeDates = (series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string): DateRow[] =>
  comingDates(withWorkspaceDates(series, ws), today);

/**
 * C3 in full: the first 14 coming dates, every coming date (the workspace read
 * holds them all; 30 of 67 live series had more than 14 on 2026-10-16, max
 * 59), and how many the "N more" row stands for.
 */
export function changeDateList(series: HomeSeriesFull, ws: SeriesWorkspace | undefined, today: string) {
  const full = withWorkspaceDates(series, ws);
  const all = comingDates(full, today, Number.POSITIVE_INFINITY);
  const first = changeDates(series, ws, today);
  return { first, all, more: moreDatesCount({ ...full, upcoming_count: all.length }, first) };
}

/**
 * Why no date of this event can be changed here (an ended/archived event:
 * eventLock verbatim; a paused or not-yet-live one), null for a live event.
 */
export function seriesLock(status: string): string | null {
  if (status === 'live') return null;
  return eventLock(status) ?? `This event is ${status === 'paused' ? 'paused' : 'not live'}, so its dates can't be changed here.`;
}

export type DateGate =
  | { kind: 'ok'; date: WorkspaceDate }
  | { kind: 'refused'; text: string }
  | { kind: 'missing' };

/**
 * May this date be changed? A past date (or a closed event) is refused with
 * eventState.ts's dateLock text verbatim (the C34 stale-link refusal); a
 * cancelled date is put back from Cancel, not changed here.
 */
export function dateGate(ws: SeriesWorkspace, occurrenceId: string, today: string): DateGate {
  const date = ws.dates.find((d) => d.id === occurrenceId);
  if (!date) return { kind: 'missing' };
  const lock = dateLock(ws.series.lifecycle_status, date.occurrence_date, today);
  if (lock) return { kind: 'refused', text: lock };
  if (date.lifecycle_status === 'cancelled') return { kind: 'refused', text: 'Cancelled' };
  return { kind: 'ok', date };
}

// The D29 confirmation lines (Done, no Undo: D49).
export const timeDoneMessage = (time: string) => `Moved to ${time}`;
export const venueDoneMessage = (date: string) => `Different venue - ${dayLabel(date)}`;

// ---- Change time with its sessions (PARITY-GAP C19 + C61) -------------------

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMinutes = (mins: number): string => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** A start before 08:00 is the night of the date (the 08:00 boundary of src/lib/programDayRollover.ts). */
const NIGHT_ENDS = 8 * 60;
const onTheNight = (mins: number) => (mins < NIGHT_ENDS ? mins + 1440 : mins);

/** Minutes of a start on its night (00:30 sorts after 23:00), for ordering; null when not HH:MM. */
export const nightStart = (hhmm: string): number | null => {
  const m = toMinutes(hhmm);
  return m === null ? null : onTheNight(m);
};
/** Minutes of an end on the night of a start: never at or before it (02:00 after 21:00 is the same night). */
const nightEnd = (startN: number, end: number) => {
  let e = onTheNight(end);
  while (e <= startN) e += 1440;
  return e;
};

/** A typed end at or before the start it lands on, on the night's clock (02:00 after 21:00 is fine): the reason, else null. */
export function endProblem(start: string, end: string): string | null {
  const s = nightStart(start);
  const e = nightStart(end);
  if (s === null || e === null) return null;
  return e <= s ? 'The end must be after the start' : null;
}

/**
 * The move from the date's start to a new start, in minutes: 23:00 -> 01:00
 * is 2 h later (the same night), 21:00 -> 08:00 is 13 h earlier (the
 * morning). set_time adds new - current to every session and the times wrap,
 * so the new times are the same either way; this only picks the words. Null
 * while either time is not HH:MM.
 */
export function timeDelta(current: string, next: string): number | null {
  const a = toMinutes(current);
  const b = toMinutes(next);
  if (a === null || b === null) return null;
  return onTheNight(b) - onTheNight(a);
}

/** "1 h", "30 min", "1 h 30 min". */
export function durationWords(mins: number): string {
  const m = Math.abs(mins);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h ? `${h} h` : '', r ? `${r} min` : ''].filter(Boolean).join(' ') || '0 min';
}

/** The line under the preview: what occurrence.set_time does to EVERY session (ST, M21:2367-2396). */
export const deltaLine = (mins: number) =>
  `Every session moves ${durationWords(mins)} ${mins < 0 ? 'earlier' : 'later'}`;

export interface TimedSession { key: string; name: string; kind: string; start: string; end: string }
export interface PreviewSession extends TimedSession { newStart: string; newEnd: string }

/**
 * The live preview of set_time: every session moved by the same delta the
 * server applies; a typed end replaces only the last-ending session's end
 * (M21:2397-2411). Sessions stay in start order.
 */
export function previewTimes(sessions: TimedSession[], delta: number, end: string | null): PreviewSession[] {
  const moved = sessions.map((s) => {
    const st = toMinutes(s.start);
    const en = toMinutes(s.end);
    return { ...s, newStart: st === null ? s.start : fromMinutes(st + delta), newEnd: en === null ? s.end : fromMinutes(en + delta) };
  });
  const last = lastEnding(sessions);
  if (end && last) return moved.map((s) => (s.key === last.key ? { ...s, newEnd: end } : s));
  return moved;
}

/** The session that ends last (an end before its start runs past midnight). */
export function lastEnding<T extends { start: string; end: string }>(sessions: T[]): T | null {
  let best: T | null = null;
  let bestEnd = -1;
  for (const s of sessions) {
    const st = nightStart(s.start);
    const en = toMinutes(s.end);
    if (st === null || en === null) continue;
    // The night's clock (08:00 rollover): an after-party 00:30-04:00 ends after a party 21:00-00:00.
    const abs = nightEnd(st, en);
    if (abs > bestEnd) { best = s; bestEnd = abs; }
  }
  return best;
}

/**
 * The session(s) prod set_time gives a typed end: the plain-clock max(eff_end),
 * midnight ignored (_cmd_occurrence_set_time_p5, read 2026-10-17). On a class
 * 20:00-21:00 + party 21:00-02:00 night that is the CLASS (21:00 > 02:00).
 */
export function serverEndTargets<T extends { start: string; end: string }>(sessions: T[]): T[] {
  const ends = sessions.map((s) => toMinutes(s.end)).filter((m): m is number => m !== null);
  if (!ends.length) return [];
  const max = Math.max(...ends);
  return sessions.filter((s) => toMinutes(s.end) === max);
}

/**
 * F-PAR decision 1: the end box is offered only where the server's end target
 * is the one session the night ends with (or there is one session). Otherwise
 * the preview could not match what the server writes, so the screen sends the
 * organiser to one session's time instead (END_GUARD). The server quirk itself
 * is queued as an admin defect.
 */
export function endBoxShown<T extends { key: string; start: string; end: string }>(sessions: T[]): boolean {
  if (sessions.length < 2) return true;
  const last = lastEnding(sessions);
  const targets = serverEndTargets(sessions);
  return !!last && targets.length === 1 && targets[0].key === last.key;
}
export const END_GUARD = 'To change when the night ends, change one session\u2019s time';

/**
 * Does this date run at its own time? Its start (the date's own, local-as-Z)
 * differs from the series' usual start. Prod 2026-10-17, 1,540 coming dates
 * of live series: no date without a time change differs; 1 end-only change
 * does not show (no read exposes it). Null facts never show a reset.
 */
export function hasOwnTime(date: { materialised_start_utc: string | null }, usualStart: string | null): boolean {
  const own = date.materialised_start_utc?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
  const usual = usualStart?.slice(0, 5) ?? null;
  return !!own && !!usual && /^\d{2}:\d{2}$/.test(usual) && own !== usual;
}

// ---- One date's note / picture / ticket link (C26) and copy (C60) ------------

export type DetailField = 'note' | 'ticket' | 'picture';
export const DETAIL_KEY = { note: 'description', ticket: 'ticket_url', picture: 'cover_image_url' } as const;
export const DETAIL_LABEL: Record<DetailField, string> = {
  note: 'Note for this date only',
  ticket: 'Ticket link for this date only',
  picture: 'Picture for this date only',
};
export const DETAIL_DONE: Record<DetailField, string> = { note: 'Note changed', ticket: 'Ticket link changed', picture: 'Picture changed' };
export const isDetailField = (v: string | undefined): v is DetailField => v === 'note' || v === 'ticket' || v === 'picture';

/** A typed ticket link the server will take: http(s) only, else the reason. */
export function ticketProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v) ? null : 'Start the link with https://';
}

/** The four one-date changes a date can hand to another (the owner override keys; the city rides with the venue). */
export interface DateOwnChanges {
  venueOverride: string | null;
  descriptionOverride: string | null;
  coverImageOverride: string | null;
  ticketUrlOverride: string | null;
}

export const COPY_NONE = 'This date has no changes of its own to copy';
/** After the read: the date's own changes are none of the four a date can copy (a time change, a cancellation). */
export const COPY_NONE_KEYS = 'This date has no venue, note, picture or ticket link of its own to copy';

/**
 * C60: the set_override patches that copy the source date's own changes onto
 * the target, ONE patch per changed key, nothing for a key the target already
 * holds. The venue patch is completed with its city by the caller
 * (venueOverridePatch). Empty = nothing to send.
 */
export function copyPatches(source: DateOwnChanges, target: DateOwnChanges): { key: 'venue_id' | 'description' | 'cover_image_url' | 'ticket_url'; value: string }[] {
  const pairs = [
    ['venue_id', source.venueOverride, target.venueOverride],
    ['description', source.descriptionOverride, target.descriptionOverride],
    ['cover_image_url', source.coverImageOverride, target.coverImageOverride],
    ['ticket_url', source.ticketUrlOverride, target.ticketUrlOverride],
  ] as const;
  return pairs.filter(([, s, t]) => !!s && s !== t).map(([key, s]) => ({ key, value: s as string }));
}

/**
 * The Copy list (INT3): dates it can copy from first, newest first, then the
 * dates with nothing of their own (shown disabled with the reason), newest first.
 */
export function copySources<T extends { id: string; occurrence_date: string; has_override: boolean }>(dates: T[], targetId: string): T[] {
  const newest = (a: T, b: T) => b.occurrence_date.localeCompare(a.occurrence_date);
  const others = dates.filter((d) => d.id !== targetId);
  return [...others.filter((d) => d.has_override).sort(newest), ...others.filter((d) => !d.has_override).sort(newest)];
}

export const hasOwnChanges = (d: DateOwnChanges) =>
  !!(d.venueOverride || d.descriptionOverride || d.coverImageOverride || d.ticketUrlOverride);

// ---- A festival's time (F-PAR-final N2) ---------------------------------------

/**
 * occurrence.set_time refuses a festival ("per-date time is not supported for
 * festivals"; the server's test is format = 'festival' OR festival_id set).
 * ONE wording for Which date, Change what and Time.
 */
export const FESTIVAL_TIME = 'Festival times are set for the whole festival, not one date.';

export const isFestival = (series: { format: string | null; festival_id?: string | null }) =>
  series.format === 'festival' || !!series.festival_id;

/** The way on from FESTIVAL_TIME: this date's sessions when they can change here, else who to ask. */
export const festivalTimeNext = (sessionsEditable: boolean) =>
  sessionsEditable
    ? 'Change a session\u2019s time in this date\u2019s sessions.'
    : 'Ask the Bachata Calendar team to change it for you.';

// ---- Several dates at once (C58: admin_bulk_occurrence_command_p5) -----------

/** The repeat modes bulk_shift refuses ("convert to custom dates first", prod fn line 217). */
export function shiftRefusal(recurrenceRule: unknown): string | null {
  const mode = (recurrenceRule as { mode?: unknown } | null)?.mode;
  return mode === 'weekly' || mode === 'monthly'
    ? 'Dates of a repeating event can\u2019t be moved together. Change the repeat instead.'
    : null;
}

/**
 * "N done, M not changed": the server changes only scheduled, coming dates of
 * this event and skips the rest silently (prod fn lines 138-143), so a
 * requested date missing from affected_ids was not changed, and why.
 */
export function bulkResult(requested: string[], affected: string[]) {
  const done = new Set(affected);
  const refused = requested.filter((id) => !done.has(id));
  return { done: requested.length - refused.length, refused, line: `${requested.length - refused.length} done, ${refused.length} not changed` };
}
export const BULK_REFUSED_REASON = 'Not changed: it was already cancelled or has passed';

/** The server refuses the WHOLE call when a shift lands a date before today (PAR-A S1); said before the send. */
export const PICK_PAST = 'That would move a ticked date before today. Pick fewer days or other dates.';
export function shiftPastProblem(dates: string[], shiftDays: number, today: string): string | null {
  return dates.some((d) => addDaysToKey(d, shiftDays) < today) ? PICK_PAST : null;
}

const listWords = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** PAR-A S3: a copy refused partway: "<keys> copied, <rest> not copied: <reason>". */
export const copyHalfDone = (done: string[], rest: string[], reason: string) =>
  `${listWords(done)} copied, ${listWords(rest)} not copied: ${reason}`;
