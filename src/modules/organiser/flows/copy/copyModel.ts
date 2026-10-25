// "Copy as a new event" / "Copy as a new edition" (S7): the pure facts. Nothing here
// reads or writes the server. The copy is built from an ALLOW-LIST of fields, so a
// private or live-only field on the source (RSVPs, status, notes, history) can never
// ride along. Dates are London wall-clock keys (YYYY-MM-DD) and are shifted by whole
// days with addDaysToKey, never through a zone, so 2026-10-25 and 2027-03-28 are ordinary days.

import { addDaysToKey, londonDaysBetweenKeys } from '@/lib/londonDate';
import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';

export const MAX_FESTIVAL_DAYS = 10;
export const PICK_DATE_WORDS = 'Pick the new date';

export type CopyRole = 'organiser' | 'admin';
export type CopyKind = 'event' | 'festival';

/** What the copy reads. The private fields are listed so tests can prove they are never copied. */
export interface CopySource {
  kind: CopyKind;
  name: string;
  status: string; // draft | live | paused | archived ...
  venueId: string | null;
  cityId: string | null;
  startTime: string | null; // HH:MM[:SS]
  durationMinutes: number | null;
  ticketUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  programmeText: string | null;
  /** Every date the source holds, YYYY-MM-DD. */
  dates: string[];
  // Never copied:
  rsvpCount?: number;
  goingCount?: number;
  adminNotes?: string | null;
  unpublishHistory?: unknown[];
}

export interface Keep { ticket: boolean; cover: boolean }
export const KEEP_ALL: Keep = { ticket: true, cover: true };

/** The pre-fill the normal new-event flow receives. `date` is always blank; `status` is always draft. */
export interface EventPrefill {
  kind: 'event';
  name: string;
  description: string;
  venueId: string | null;
  cityId: string | null;
  startTime: string;
  durationMinutes: number | null;
  ticketUrl: string;
  coverImageUrl: string;
  programmeText: string;
  date: '';
  dateHint: typeof PICK_DATE_WORDS;
  status: 'draft';
}

export interface EditionPlan extends Omit<EventPrefill, 'kind' | 'date' | 'dateHint'> {
  kind: 'festival';
  /** The new days, in order, each keeping its gap from the first; empty until a start date is picked. */
  days: string[];
}

const HHMM = /^(\d{2}):(\d{2})/;
const hhmm = (t: string | null) => (t && HHMM.test(t) ? t.slice(0, 5) : '');

/** Postgres interval text ("02:00:00" / "1 day 02:00:00") to minutes; null when not readable. */
export function durationToMinutes(raw: string | null | undefined): number | null {
  const m = /^(?:(\d+) days? )?(\d{1,2}):(\d{2})/.exec(raw ?? '');
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
  return mins > 0 ? mins : null;
}

/** The workspace read of an event, as a copy source (dates passed in; the series row holds none). */
export function sourceFromWorkspace(s: WorkspaceSeries, dates: string[]): CopySource {
  return {
    kind: s.format === 'festival' || s.festival_id ? 'festival' : 'event',
    name: s.name,
    status: s.lifecycle_status,
    venueId: s.default_venue_id,
    cityId: null,
    startTime: s.default_local_start_time,
    durationMinutes: durationToMinutes(s.default_duration),
    ticketUrl: s.default_ticket_url,
    coverImageUrl: s.default_cover_image_url,
    description: s.default_description,
    programmeText: null,
    dates,
  };
}

function base(src: CopySource, keep: Keep) {
  return {
    name: src.name.trim(),
    description: src.description ?? '',
    venueId: src.venueId,
    cityId: src.cityId,
    startTime: hhmm(src.startTime),
    durationMinutes: src.durationMinutes,
    ticketUrl: keep.ticket ? (src.ticketUrl ?? '') : '',
    coverImageUrl: keep.cover ? (src.coverImageUrl ?? '') : '',
    programmeText: src.programmeText ?? '',
    status: 'draft' as const,
  };
}

/** A single event: everything except the date. Dates are never copied, so no past date can be. */
export function copyEvent(src: CopySource, keep: Keep = KEEP_ALL): EventPrefill {
  return { kind: 'event', ...base(src, keep), date: '', dateHint: PICK_DATE_WORDS };
}

/**
 * A festival edition: the days move by the offset between the source's first day and the
 * start the person picked, so every gap is kept. Line-ups are not part of CopySource, so
 * they cannot be copied. Days that would land before `today` are dropped (only possible
 * with a start in the past, which copyState/startProblem already refuse).
 */
export function copyEdition(src: CopySource, newStart: string | null, today: string, keep: Keep = KEEP_ALL): EditionPlan {
  const sorted = [...new Set(src.dates)].sort();
  let days: string[] = [];
  if (newStart && sorted.length > 0) {
    const offset = londonDaysBetweenKeys(sorted[0], newStart);
    days = sorted.map((d) => addDaysToKey(d, offset)).filter((d) => d >= today).slice(0, MAX_FESTIVAL_DAYS);
  }
  return { kind: 'festival', ...base(src, keep), days };
}

/** Why a picked start cannot be used; null when fine. */
export function startProblem(newStart: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newStart)) return 'Pick the new start date.';
  return newStart < today ? 'Pick a date from today on.' : null;
}

// ---- the one state -> text/controls mapping ----------------------------------------

export type CopyBlock = 'not_found' | 'nothing_copyable' | 'too_many_days' | 'busy';

export interface CopyInput {
  found: boolean;
  role: CopyRole;
  source: CopySource | null;
  /** A first tap is already opening the form (double-tap guard). */
  opening?: boolean;
}

export interface CopyView {
  label: string;
  enabled: boolean;
  /** Plain words beside a disabled button; null when enabled. */
  reason: string | null;
  block: CopyBlock | null;
}

export const COPY_LABEL = { event: 'Copy as a new event', festival: 'Copy as a new edition' } as const;

export const COPY_TEXT = {
  noEvents: 'You have no events to copy yet. Add your first event.',
  notFound: "We couldn't find that event, so there is nothing to copy. Go back to your events and pick another.",
  nothingCopyable: 'This event has no details to copy yet. Add its name and venue first, or start a new event.',
  tooManyDays: (n: number) => `A festival can run for ${MAX_FESTIVAL_DAYS} days at most, and this one has ${n}. Take some days off it first.`,
  network: "We couldn't reach the server. Check your signal and try again. Nothing was copied.",
  opening: 'Opening your copy',
  festivalWaits: 'Copying a festival edition is not switched on yet.',
  keepTicket: 'Keep the same ticket link?',
  keepCover: 'Keep the same cover?',
  keep: 'Keep',
  clear: 'Clear',
  draftNote: 'The copy is a draft. Nothing is saved until you save it.',
} as const;

/** One mapping for the list button, the event-page button and the festival confirm. */
export function copyView(i: CopyInput): CopyView {
  const label = i.source?.kind === 'festival' ? COPY_LABEL.festival : COPY_LABEL.event;
  const off = (block: CopyBlock, reason: string): CopyView => ({ label, enabled: false, reason, block });
  if (!i.found || !i.source) return off('not_found', COPY_TEXT.notFound);
  if (i.opening) return off('busy', COPY_TEXT.opening);
  const s = i.source;
  if (!s.name.trim()) return off('nothing_copyable', COPY_TEXT.nothingCopyable);
  if (s.kind === 'festival' && new Set(s.dates).size > MAX_FESTIVAL_DAYS) {
    return off('too_many_days', COPY_TEXT.tooManyDays(new Set(s.dates).size));
  }
  return { label, enabled: true, reason: null, block: null };
}

// ---- carrying the pre-fill through the normal New event flow --------------------------

/** Router state the copy button hands to the New event flow. */
export interface CopyState { copy?: EventPrefill }
export const readCopy = (state: unknown): EventPrefill | null => {
  const c = (state as CopyState | null)?.copy;
  return c && c.kind === 'event' && c.status === 'draft' && c.date === '' ? c : null;
};

/**
 * ONE upsert with the copied fields, sent right after the normal draft create. Only fields that
 * hold something are sent; the date is never in it, and neither is a status (the create made a draft).
 */
export function prefillCommands(p: EventPrefill): OwnerCommand[] {
  const payload: Record<string, unknown> = {};
  if (p.venueId) payload.default_venue_id = p.venueId;
  if (p.venueId && p.cityId) payload.default_city_id = p.cityId;
  if (p.startTime) payload.default_local_start_time = p.startTime;
  if (p.durationMinutes) payload.default_duration_minutes = p.durationMinutes;
  if (p.ticketUrl) payload.default_ticket_url = p.ticketUrl;
  if (p.coverImageUrl) payload.default_cover_image_url = p.coverImageUrl;
  if (p.description) payload.default_description = p.description;
  return Object.keys(payload).length ? [upsertCommand(payload)] : [];
}
