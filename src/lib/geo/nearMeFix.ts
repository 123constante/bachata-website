// Near me: the remembered location fix. {lat,lng,accuracy,ts} in localStorage, dropped once
// older than 30 minutes. Nothing here ever leaves the device. ASCII-only.

export const FIX_KEY = 'bc.nearMeFix.v1';
export const FIX_TTL_MS = 30 * 60 * 1000;

export type Fix = { lat: number; lng: number; accuracy: number; ts: number };

export function readFix(now: number = Date.now()): Fix | null {
  try {
    const raw = window.localStorage.getItem(FIX_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Fix>;
    if (
      typeof p.lat !== 'number' ||
      typeof p.lng !== 'number' ||
      typeof p.ts !== 'number' ||
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng)
    ) {
      return null;
    }
    if (now - p.ts > FIX_TTL_MS || p.ts > now + 60_000) {
      window.localStorage.removeItem(FIX_KEY);
      return null;
    }
    return { lat: p.lat, lng: p.lng, accuracy: typeof p.accuracy === 'number' ? p.accuracy : 0, ts: p.ts };
  } catch {
    return null;
  }
}

export function writeFix(fix: Fix | null): void {
  try {
    if (fix) window.localStorage.setItem(FIX_KEY, JSON.stringify(fix));
    else window.localStorage.removeItem(FIX_KEY);
  } catch {
    /* storage blocked: the fix is simply not remembered */
  }
}

/** Distances are approximate by nature, so the tilde is always shown. */
export function formatNearMiles(mi: number): string {
  return `~${mi < 10 ? mi.toFixed(1) : String(Math.round(mi))} mi`;
}

/** A fix rougher than ~5 km earns the "Rough location" hint. */
export const ROUGH_FIX_M = 5000;
export const isRoughFix = (accuracy: number | null | undefined): boolean =>
  typeof accuracy === 'number' && accuracy > ROUGH_FIX_M;
