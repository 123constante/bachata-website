// The event as a whole (P-SERIES, PARITY-GAP C28a/C28b/C30b/C38): what a draft
// still needs before it can go live, and which lifecycle rows One event shows.
// Pure; the ONE mapping the lifecycle card and the parity matrix both read.

import { isCancelledDate, upcomingDates, type SeriesWorkspace } from '@/modules/organiser/shared/seriesModel';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { publicEventPath } from '@/modules/organiser/shared/editorGuards';
import { FLYER_WORD } from '@/modules/organiser/shared/flyerLabel';
import type { EventWorkspace } from './eventModel';
import { FESTIVAL_REASON } from './programmeSeriesModel';

/** Going live from a draft waits on the admin A1 migration; plain words, no jargon. */
export const A1_REASON = 'Needs the next platform update';
export const SEE_LIVE_DRAFT_REASON = 'Dancers can see it once it is live.';
/** PAR-B B1: a draft with nothing missing, waiting only on A1. The ONE ready sentence. */
export const GO_LIVE_READY = 'Your event is ready. Go live switches on here after the next platform update.';
/** The one missing item that is not set on Details: a date is added with Add a date (PAR-B S7). */
export const MISSING_DATE = 'a date from today on';

/** The one missing item that is set on the programme: a session (owner 2026-10-20). */
export const MISSING_SESSION = 'at least one session';
export const NO_SESSION_REASON = 'Add at least one session first.';

/**
 * Does a session sit on a date that is still to come and listed? The series
 * programme runs on every such date; else a session added to one date counts.
 * ONE rule for both Go live buttons (this card and the New event last step).
 */
export function hasUpcomingSession(ws: Pick<SeriesWorkspace, 'hasSessions' | 'dates'>, today: string): boolean {
  const listed = ws.dates.filter((d) => d.occurrence_date >= today && !isCancelledDate(d));
  return ws.hasSessions ? listed.length > 0 : listed.some((d) => d.added_sessions_count > 0);
}

/**
 * What a draft still needs, in the order the organiser fixes it. The server's
 * readiness (event_publish_readiness_v1) checks name, venue, city and a start
 * date; it does not check a cover or a date still to come, which the go-live
 * gate (A1b) also needs, so those are added here.
 */
export function goLiveMissing(ws: EventWorkspace, today: string): string[] {
  const s = ws.series;
  const missing: string[] = [];
  if (!s.name.trim()) missing.push('a name');
  // The city rides with the venue (Details sends both), so a venue stands for both.
  if (!s.default_venue_id) missing.push('a venue');
  const coming = upcomingDates(ws.dates, today).some((d) => d.lifecycle_status === 'scheduled');
  if (!coming && !(s.default_start_date && s.default_start_date >= today)) missing.push(MISSING_DATE);
  if (!s.default_cover_image_url) missing.push(`a ${FLYER_WORD}`);
  // A session sits on a date, so the date comes first: no session is asked for while a date is missing.
  if (!missing.includes(MISSING_DATE) && !hasUpcomingSession(ws, today)) missing.push(MISSING_SESSION);
  return missing;
}

const list = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Why Go live is off, or null when it can be pressed. Each reason names where to do it. */
export function goLiveReason(ws: EventWorkspace, today: string, a1 = A1_APPLIED): string | null {
  const missing = goLiveMissing(ws, today);
  // Name, venue and cover are set on Details; a date is added with Add a date. The card links to each (LifecycleActions).
  const details = missing.filter((m) => m !== MISSING_DATE && m !== MISSING_SESSION);
  const parts = [
    details.length ? `add ${list(details)} in Details` : null,
    missing.includes(MISSING_DATE) ? `add ${MISSING_DATE} with Add a date` : null,
  ].filter((p): p is string => !!p);
  const add = parts.length ? parts.join(', and ') : null;
  const session = missing.includes(MISSING_SESSION);
  // A festival's programme is a day tree the platform team edits: say that, not "add a session".
  const sessionText = ws.series.format === 'festival' ? FESTIVAL_REASON : NO_SESSION_REASON;
  const tail = [add ? `${add}.` : null, session ? sessionText : null].filter(Boolean).join(' ');
  // "Before then, " joins mid-sentence, so a tail that starts with a sentence starts lower case.
  if (!a1) return tail ? `${A1_REASON}. Before then, ${tail.charAt(0).toLowerCase()}${tail.slice(1)}` : GO_LIVE_READY;
  if (!add) return session ? sessionText : null;
  return `To go live, ${add}.${session ? ` ${sessionText}` : ''}`;
}

/**
 * `toDetails`: something missing is set on Details, so the card offers Open Details.
 * `toAddDate`: no date from today on, so the card offers Add a date.
 * `toProgramme`: no session, so the card offers the programme screen.
 */
export type LifecycleRow = { reason: string | null; toDetails?: boolean; toAddDate?: boolean; toProgramme?: boolean } | null;

export interface LifecycleRows {
  goLive: LifecycleRow;
  discard: LifecycleRow;
  /** The public page: `href` when it can be opened, else the reason. */
  seeLive: { href: string | null; reason: string | null } | null;
}

/**
 * Draft: Go live (off with its reason until A1 and readiness allow it), Discard
 * (set_lifecycle archived, draft -> archived is an owner transition on prod) and
 * See it live off. Live: See it live. Paused, ended, archived: none of the three.
 */
export function lifecycleRows(ws: EventWorkspace, today: string, a1 = A1_APPLIED): LifecycleRows {
  const status = ws.series.lifecycle_status;
  if (status === 'draft') {
    const missing = goLiveMissing(ws, today);
    return {
      goLive: { reason: goLiveReason(ws, today, a1), toDetails: missing.some((m) => m !== MISSING_DATE && m !== MISSING_SESSION), toAddDate: missing.includes(MISSING_DATE), toProgramme: missing.includes(MISSING_SESSION) && ws.series.format !== 'festival' },
      discard: { reason: null },
      seeLive: { href: null, reason: SEE_LIVE_DRAFT_REASON },
    };
  }
  if (status === 'live') return { goLive: null, discard: null, seeLive: { href: publicEventPath(ws.series), reason: null } };
  return { goLive: null, discard: null, seeLive: null };
}
