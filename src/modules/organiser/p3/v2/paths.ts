import { P3_BASE, P3_PATHS } from '../shell/paths';

/** Organiser shell V2's tabs (flag organiserShellV2). Events also holds Team; the rest act on the chosen event. */
export type V2Tab = 'events' | 'tickets' | 'guests' | 'raffle';

export const V2_PATHS = {
  events: P3_PATHS.events,
  tickets: `${P3_BASE}/tickets`,
  guests: `${P3_BASE}/guests`,
  raffle: `${P3_BASE}/raffle`,
} as const;

export const V2_TAB_WORD: Record<V2Tab, string> = { events: 'Events', tickets: 'Tickets', guests: 'Guest list', raffle: 'Raffle' };

export const V2_TABS: readonly { id: V2Tab; path: string }[] = (['events', 'tickets', 'guests', 'raffle'] as const).map((id) => ({ id, path: V2_PATHS[id] }));

/** Which tab a URL sits under. Anything not a V2 tab (an event page, Team, You) belongs to Events. */
export function v2TabOf(pathname: string): V2Tab {
  for (const t of ['tickets', 'guests', 'raffle'] as const) {
    if (pathname === V2_PATHS[t] || pathname.startsWith(`${V2_PATHS[t]}/`)) return t;
  }
  return 'events';
}
