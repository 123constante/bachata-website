// Recent searches for the homePolish full-screen search. Per-device convenience only
// (localStorage, every access guarded): a private window or blocked storage just shows none.

const KEY = 'bc.recentSearches.v1';
const MAX = 8;

export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Newest first, case-insensitive de-dupe, capped. Returns the new list. */
export function pushRecent(term: string): string[] {
  const t = term.trim();
  if (t.length < 2) return readRecent();
  const next = [t, ...readRecent().filter((s) => s.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the list just is not remembered */
  }
  return next;
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
