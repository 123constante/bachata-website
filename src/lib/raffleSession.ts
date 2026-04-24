// =============================================================================
// raffleSession — stable per-browser session id for raffle submissions.
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
