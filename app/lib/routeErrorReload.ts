// Reload-once guard for transient 502/503/504 route errors (deploy swap etc).
// Dependency-free on purpose: imported by root.tsx (first-load request count
// is pinned by perf-budgets).
export const RELOAD_STATUSES = [502, 503, 504];
export const RELOAD_WINDOW_MS = 60_000;

export function shouldReloadOnRouteError(
  status: number,
  pathname: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  now: number = Date.now(),
): boolean {
  if (!RELOAD_STATUSES.includes(status)) return false;
  if (!storage) return false;
  try {
    const key = 'rr5xx-reload:' + pathname;
    const last = Number(storage.getItem(key));
    if (last && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    return false;
  }
}

export function sessionStorageOrNull(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
