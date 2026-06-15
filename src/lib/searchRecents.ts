// Recent search terms for the omnibox + overlay discovery state. localStorage,
// newest-first, max 5. Extracted from HeaderSearch so the overlay and the
// omnibox share one store (key unchanged: bc_omnibox_recent_v1).
const RECENTS_KEY = 'bc_omnibox_recent_v1';
const MAX_RECENTS = 5;

export function readRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}

export function pushRecent(term: string): void {
  if (typeof window === 'undefined') return;
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const cur = readRecents().filter((x) => x.toLowerCase() !== t.toLowerCase());
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([t, ...cur].slice(0, MAX_RECENTS)));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function clearRecents(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RECENTS_KEY);
  } catch {
    /* ignore */
  }
}
