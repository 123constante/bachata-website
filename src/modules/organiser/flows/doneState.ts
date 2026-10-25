import type { NavigateFunction } from 'react-router-dom';
import { sanitizeReturnTo } from '@/lib/authRouting';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';

/**
 * What the shared Done screen shows (plan 4.3 #4 as amended by D49/D51): the
 * D29 confirmation line and "Back to Home"; `next` adds ONE second button
 * (D61: Cancel's Done passes the put-back route). There is no Undo.
 */
export interface DoneState {
  title: string;
  message: string;
  seriesId: string | null;
  next?: string;
  /** The `next` button's words; defaults to NEXT_LABEL (Cancel's put-back; Team's removal says "Add them back", C26b). */
  nextLabel?: string;
  /** "It's live" (invite W2): the role pages to offer a link into, teacher first. */
  offer?: OfferRole[];
  /** W2 walk fix 10: the sanitised returnTo the editor was opened with; Done's primary goes back there. */
  back?: string;
}

export type OfferRole = 'teacher' | 'dj';
const OFFER_ROLES: readonly OfferRole[] = ['teacher', 'dj'];

/** The second button's words. R1 has one `next` (D61, Cancel -> put it back). */
export const NEXT_LABEL = 'Put it back';

/** The way back to the event a screen was opened from; the name once the event has loaded. */
/** Done's way back when the returnTo is an organiser screen that is not an event. */
export const GO_BACK_LABEL = 'Go back';

export const backToEventLabel = (name: string | null | undefined): string => `Back to ${name?.trim() || 'your event'}`;

/** The event a returnTo points at: One event (and its sub-screens) or the Go live flow (`?series=`). */
export function returnToSeriesId(returnTo: string | null): string | null {
  if (!returnTo) return null;
  const own = returnTo.match(/^\/account\/o\/events\/([^/?#]+)/);
  if (own) return decodeURIComponent(own[1]);
  if (/^\/account\/o\/go-live(?:[?#]|$)/.test(returnTo)) return new URLSearchParams(returnTo.split('?')[1]?.split('#')[0] ?? '').get('series');
  return null;
}

export const withReturnTo = (to: string, back: string) => `${to}${to.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(back)}`;

/** The screen's own `?returnTo=`, sanitised (an external or `//` one is null, and so is Done itself). */
export const readReturnTo = (search: string): string | null => sanitizeReturnTo(new URLSearchParams(search).get('returnTo'), { exclude: ORG_PATHS.done });

/** A link onward from a screen opened with a returnTo keeps it, so the editor it opens still comes back. */
export const keepReturnTo = (to: string, search: string): string => {
  const back = readReturnTo(search);
  return back ? withReturnTo(to, back) : to;
};

/**
 * Every flow ends on Done. `returnTo` (the editor's sanitised `?returnTo=`, W2 walk
 * fix 10): Done's primary goes back there instead of Home. Without one, unchanged.
 */
export function goDone(navigate: NavigateFunction | ((to: string, opts: { state: DoneState }) => void), state: DoneState, returnTo?: string | null): void {
  const back = sanitizeReturnTo(returnTo ?? null, { exclude: ORG_PATHS.done });
  navigate(ORG_PATHS.done, { state: back ? { ...state, back } : state });
}

/** Router state -> DoneState, or null (a reload, a stale link): the screen then goes Home. */
export function readDoneState(raw: unknown): DoneState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.title !== 'string' || typeof s.message !== 'string') return null;
  const back = typeof s.back === 'string' ? sanitizeReturnTo(s.back, { exclude: ORG_PATHS.done }) : null;
  return {
    title: s.title,
    message: s.message,
    seriesId: typeof s.seriesId === 'string' ? s.seriesId : null,
    ...(typeof s.next === 'string' && s.next ? { next: s.next } : {}),
    ...(typeof s.nextLabel === 'string' && s.nextLabel ? { nextLabel: s.nextLabel } : {}),
    ...(Array.isArray(s.offer) && s.offer.some((r) => OFFER_ROLES.includes(r))
      ? { offer: OFFER_ROLES.filter((r) => (s.offer as unknown[]).includes(r)) } : {}),
    ...(back ? { back } : {}),
  };
}
