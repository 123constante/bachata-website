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

/** The checklist's final words: back to the event only when nothing is left AND there is a valid event. */
export const finishLabel = (back: string | null, left: number): string => (back && left === 0 ? BACK_TO_EVENT : GO_TO_HOME);
