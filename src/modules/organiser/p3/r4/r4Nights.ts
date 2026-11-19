import { buildEvents, type Night, type Seat } from '../events/eventsModel';
import type { EventChoice } from './EventChoice';

const seatOf = (page: EventChoice['page']): Seat => (page?.role === 'owner' || page?.role === 'manager' ? page.role : 'contributor');

/** The chosen event's coming dated nights (soonest first), as the Events tab builds them. A draft or hidden series with a date counts: it still has a night to work on. */
export function nightsOfChoice(c: Pick<EventChoice, 'event' | 'today' | 'page'>): Night[] {
  if (!c.event) return [];
  const m = buildEvents({ rows: [c.event], today: c.today, seat: seatOf(c.page), query: '', filter: 'all', shown: 1000, showPast: false });
  return m.nights.filter((n) => n.date && (n.status === 'live' || n.status === 'cancelled' || n.status === 'draft' || n.status === 'hidden'));
}
