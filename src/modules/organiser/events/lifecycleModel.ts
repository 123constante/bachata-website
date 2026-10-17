// The event as a whole (P-SERIES, PARITY-GAP C28a/C28b/C30b/C38): what a draft
// still needs before it can go live, and which lifecycle rows One event shows.
// Pure; the ONE mapping the lifecycle card and the parity matrix both read.

import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { publicEventPath } from '@/modules/organiser/shared/editorGuards';
import type { EventWorkspace } from './eventModel';

/** Going live from a draft waits on the admin A1 migration; plain words, no jargon. */
export const A1_REASON = 'Needs the next platform update';
export const SEE_LIVE_DRAFT_REASON = 'Dancers can see it once it is live.';

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
  if (!coming && !(s.default_start_date && s.default_start_date >= today)) missing.push('a date from today on');
  if (!s.default_cover_image_url) missing.push('a cover picture');
  return missing;
}

const list = (items: string[]) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Why Go live is off, or null when it can be pressed. */
export function goLiveReason(ws: EventWorkspace, today: string, a1 = A1_APPLIED): string | null {
  const missing = goLiveMissing(ws, today);
  // The venue and the cover are set on Details; the card links there (LifecycleActions).
  const add = missing.length ? `add ${list(missing)} in Details` : null;
  if (!a1) return add ? `${A1_REASON}. Before then, ${add}.` : `${A1_REASON}.`;
  return add ? `To go live, ${add}.` : null;
}

/** `toDetails`: what is missing is set on Details, so the card offers the way there. */
export type LifecycleRow = { reason: string | null; toDetails?: boolean } | null;

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
    return { goLive: { reason: goLiveReason(ws, today, a1), toDetails: goLiveMissing(ws, today).length > 0 }, discard: { reason: null }, seeLive: { href: null, reason: SEE_LIVE_DRAFT_REASON } };
  }
  if (status === 'live') return { goLive: null, discard: null, seeLive: { href: publicEventPath(ws.series), reason: null } };
  return { goLive: null, discard: null, seeLive: null };
}
