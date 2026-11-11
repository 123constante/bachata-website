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

/** sessionStorage key recording that THIS browser joined the ONE general raffle
 *  pool (per device). Shared by the tile and /raffles -- do NOT inline. */
export const rafflePoolJoinedKey = 'bcal_raffle_pool_joined';

// No anon read of "am I in the pool" exists on the server (raffle_my_wins_v1 is
// authenticated and about wins), so the durable mark is localStorage (per device);
// sessionStorage is the fallback where localStorage is blocked.
export function isRafflePoolJoined(): boolean {
  if (typeof window === 'undefined') return false;
  try { if (window.localStorage.getItem(rafflePoolJoinedKey) === '1') return true; } catch { /* fall through */ }
  try { return window.sessionStorage.getItem(rafflePoolJoinedKey) === '1'; } catch { return false; }
}

export function markRafflePoolJoined(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(rafflePoolJoinedKey, '1'); } catch { /* no-op */ }
  try { window.sessionStorage.setItem(rafflePoolJoinedKey, '1'); } catch { /* no-op */ }
}

/** Best-effort haptic feedback. No-ops where unsupported and never throws
 *  (some browsers throw on vibrate() inside cross-origin iframes). */
export const tryVibrate = (pattern: number | number[]): void => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* no-op */ }
};
