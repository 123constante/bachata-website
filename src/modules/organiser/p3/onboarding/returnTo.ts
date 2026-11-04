// Slice R (brief fix-join-first-batch): a refused event write remembers the EVENT it came from, so the checklist
// can end with "Back to your event". Only ever an in-app P3 event page: anything else (missing, off-site, another
// area, a malformed id) is null and the checklist ends with "Go to Home". The refused edit is never replayed.
import { P3_BASE, P3_PATHS } from '../shell/paths';

const EVENT_PATH = new RegExp(`^${P3_BASE}/events/([A-Za-z0-9_-]{1,64})(?:/[a-z]+)?/?$`);

/** The event page a screen path belongs to (/account/p3/events/<id>[/details|/prices|/dates]), else null. */
export function eventReturnFrom(path: string | null | undefined): string | null {
  if (typeof path !== 'string') return null;
  const m = EVENT_PATH.exec(path);
  return m ? P3_PATHS.event(m[1]) : null;
}

/** `href` (a P3 start link) carrying `back`, when there is a valid event to go back to. */
export function withBack(href: string, at: string | null | undefined): string {
  const back = eventReturnFrom(at);
  if (!back) return href;
  return `${href}${href.includes('?') ? '&' : '?'}back=${encodeURIComponent(back)}`;
}

export const BACK_TO_EVENT = 'Back to your event';
export const GO_TO_HOME = 'Go to Home';

/**
 * The checklist's exit words (brief fix-gate-lost-edit): with a valid event to go back to, the exit is always
 * "Back to your event" (left or not: the refused edit is waiting there, kept by keptDraft.ts); "Go to Home" only
 * when there is no valid event. `left` is kept for the call sites; the rule no longer depends on it.
 */
export const finishLabel = (back: string | null, _left?: number): string => (back ? BACK_TO_EVENT : GO_TO_HOME);

/**
 * Whether the checklist shows "Back to your event" as a SECOND button: things are still left, there is a valid
 * event, and the primary is not already that (it is Go live / Try again / Sign in again).
 */
export const backAsSecondary = (back: string | null, left: number, primaryLabel: string): boolean =>
  !!back && left > 0 && primaryLabel !== BACK_TO_EVENT;
