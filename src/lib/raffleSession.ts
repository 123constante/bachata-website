// =============================================================================
// raffleSession — shared client-side raffle helpers used by BOTH raffle
// surfaces (the bento RaffleBlock tile and the festival "Lucky Reels" band).
//
//   - getRaffleSessionId(): stable per-browser session id for submissions.
//   - raffleEnteredKey():   sessionStorage key recording "this browser entered
//                           event X" — the single source of truth for the
//                           already-entered state across surfaces.
//   - tryVibrate():         best-effort haptic that never throws.
//
// Mirrors lib/viewerSession.ts convention (bcal_* prefix, crypto.randomUUID
// with graceful fallback).
// =============================================================================

const STORAGE_KEY = 'bcal_raffle_session';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return r()+r()+'-'+r()+'-4'+r().slice(1)+'-'+(8+Math.floor(Math.random()*4)).toString(16)+r().slice(1)+'-'+r()+r()+r();
}

export function getRaffleSessionId(): string {
  if (typeof window === 'undefined') return generateUuid();
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 0) return existing;
    const fresh = generateUuid();
    window.sessionStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return generateUuid();
  }
}

/** sessionStorage key recording that THIS browser entered a given event's
 *  raffle. Shared by every raffle surface so "already entered" stays in sync —
 *  do NOT inline this literal anywhere. Returns null when eventId is absent. */
export const raffleEnteredKey = (eventId: string | null | undefined): string | null =>
  eventId ? `bcal_raffle_entered_${eventId}` : null;

/** Best-effort haptic feedback. No-ops where unsupported and never throws
 *  (some browsers throw on vibrate() inside cross-origin iframes). */
export const tryVibrate = (pattern: number | number[]): void => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* no-op */ }
};
