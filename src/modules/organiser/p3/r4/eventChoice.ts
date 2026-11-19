/**
 * Organiser area: which event the tabs act on.
 * Pure rules, so the default and the refresh rule are unit-tested on their own.
 *
 * The choice rides in the URL (`?e=<seriesId>`), so a refresh or a shared link keeps it;
 * a copy in sessionStorage covers a bare tab URL in the same visit. An id that is not one
 * of the page's events is ignored (never shown as "chosen").
 */
export const EVENT_PARAM = 'e';
export const EVENT_STORE_KEY = 'p3v2-event';

/** The few fields of a P3 row the rule reads (P3Row satisfies it). */
export interface ChoiceRow {
  id: string;
  name: string;
  lifecycle: string;
  next: { date: string } | null;
}

/**
 * The organiser's next event: the soonest coming date (today counts) among live events,
 * then any event with a coming date, then the first live event, then the first event.
 * Ties break on name, then id, so the answer never depends on list order.
 */
export function defaultEventId(rows: readonly ChoiceRow[], today: string): string | null {
  if (!rows.length) return null;
  const byName = (a: ChoiceRow, b: ChoiceRow) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const coming = rows.filter((r) => r.next && r.next.date >= today);
  const soonest = (list: ChoiceRow[]) =>
    [...list].sort((a, b) => (a.next!.date < b.next!.date ? -1 : a.next!.date > b.next!.date ? 1 : byName(a, b)))[0];
  const liveComing = coming.filter((r) => r.lifecycle === 'live');
  if (liveComing.length) return soonest(liveComing).id;
  if (coming.length) return soonest(coming).id;
  const live = rows.filter((r) => r.lifecycle === 'live').sort(byName);
  if (live.length) return live[0].id;
  return [...rows].sort(byName)[0].id;
}

/** The event the tabs act on: the URL's, else the one kept this visit, else the default. Only ids on the list count. */
export function resolveEventId(i: { urlId: string | null; storedId: string | null; rows: readonly ChoiceRow[]; today: string }): string | null {
  const known = (id: string | null) => !!id && i.rows.some((r) => r.id === id);
  if (known(i.urlId)) return i.urlId;
  if (known(i.storedId)) return i.storedId;
  return defaultEventId(i.rows, i.today);
}

export function readStoredEvent(): string | null {
  try {
    return window.sessionStorage.getItem(EVENT_STORE_KEY);
  } catch {
    return null;
  }
}

export function storeEvent(id: string): void {
  try {
    window.sessionStorage.setItem(EVENT_STORE_KEY, id);
  } catch {
    /* private mode: the ?e= link still carries the choice */
  }
}
