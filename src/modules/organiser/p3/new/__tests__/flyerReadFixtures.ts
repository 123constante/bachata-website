import type { FlyerRead } from '../flyerReadShape';
import type { VenueOption } from '../../../shared/publicVenues';

/** The eleven reference flyers, summarised (values only; no live reader output). */
const base: FlyerRead = {
  kind: 'one_off', event_count_on_flyer: 1, title: null, organiser_text: null, dates: [], start_time: null, end_time: null,
  ends_after_midnight: false, venue_name: null, venue_address: null, sessions: [], price: null, ticket_url_visible: null, doubtful_fields: [], notes: null,
};
const d = (date_start: string | null, date_end: string | null = null, weekday_printed: number | null = null, year_printed = true, recurrence_text: string | null = null) =>
  ({ date_start, date_end, year_printed, weekday_printed, recurrence_text });
export const mk = (o: Partial<FlyerRead>): FlyerRead => ({ ...base, ...o });

export const V = (id: string, name: string): VenueOption => ({ id, name, neighbourhood: null, city_name: 'London', address: null, postcode: null });
export const VENUES: VenueOption[] = [V('v-ritz', 'The Ritz Club'), V('v-fire', 'Fire Station'), V('v-fire2', 'Fire Station Annex'), V('v-boat', 'Thames Boat')];

export const TODAY = '2026-11-08'; // a Sunday

export interface Row {
  n: string; read: FlyerRead; kind: string; firstDate: string; extra: number; venue: string | null; said: string | null;
  sessions: number; doubtful: string[]; notes: string[]; touched: boolean;
}

export const ROWS: Row[] = [
  { n: '1 weekly Saturday, full address', read: mk({ kind: 'weekly', title: 'Salsa Saturdays', dates: [d(null, null, 6)], venue_name: 'The Ritz Club', venue_address: '1 High St, London' }),
    kind: 'weekly', firstDate: '2026-11-14', extra: 0, venue: 'v-ritz', said: null, sessions: 0, doubtful: ['firstDate'], notes: ['repeats'], touched: true },
  { n: '2 Halloween one-off class+party, past, no year', read: mk({ title: 'Halloween Bash', dates: [d('2026-10-31', null, 6, false)], venue_name: 'Nowhere Hall',
    sessions: [{ type: 'class', start: '19:00', end: '20:00', label: 'Class' }, { type: 'party', start: '20:00', end: '23:30', label: 'Party' }] }),
    kind: 'class_party', firstDate: '2026-10-31', extra: 0, venue: null, said: 'Nowhere Hall', sessions: 2, doubtful: ['firstDate', 'venue'], notes: ['past_date'], touched: true },
  { n: '3 three-night multi-event, no venue', read: mk({ kind: 'multi_event', event_count_on_flyer: 3, title: 'Three Nights', dates: [d('2026-12-04')] }),
    kind: 'one_date', firstDate: '2026-12-04', extra: 0, venue: null, said: null, sessions: 0, doubtful: ['venue'], notes: ['many_events', 'no_venue'], touched: true },
  { n: '4 weekly Wednesday, 2 rooms, ends 01:00', read: mk({ kind: 'weekly', title: 'Wednesday Social', dates: [d(null, null, 3)], venue_name: 'Fire Station', ends_after_midnight: true,
    sessions: [{ type: 'class', start: '19:30', end: '21:00', label: 'Room 1' }, { type: 'party', start: '21:00', end: '01:00', label: 'Room 2' }] }),
    kind: 'weekly', firstDate: '2026-11-11', extra: 0, venue: null, said: 'Fire Station', sessions: 2, doubtful: ['firstDate', 'venue'], notes: ['repeats'], touched: true },
  { n: '5 monthly first Saturday, no venue, 10 sessions', read: mk({ kind: 'monthly', title: 'First Saturdays', dates: [d(null, null, 6, true, 'First Saturday of every month')],
    sessions: Array.from({ length: 10 }, (_, i) => ({ type: 'party' as const, start: '20:00', end: '23:00', label: `Room ${i + 1}` })), doubtful_fields: ['sessions'] }),
    kind: 'monthly', firstDate: '2026-12-05', extra: 0, venue: null, said: null, sessions: 10, doubtful: ['firstDate', 'venue', 'sessions'], notes: ['repeats', 'no_venue'], touched: true },
  { n: '6 two events + timetable', read: mk({ kind: 'multi_event', event_count_on_flyer: 2, title: 'Double Bill', dates: [d('2026-11-20')], venue_name: 'Thames Boat',
    sessions: [{ type: 'workshop', start: '14:00', end: '16:00', label: 'Workshop' }, { type: 'party', start: '20:00', end: '23:00', label: null }] }),
    kind: 'one_date', firstDate: '2026-11-20', extra: 0, venue: 'v-boat', said: null, sessions: 2, doubtful: [], notes: ['many_events'], touched: true },
  { n: '7 course, no date, no venue (not enough)', read: mk({ kind: 'course', title: 'Beginners Course' }),
    kind: 'course', firstDate: '', extra: 0, venue: null, said: null, sessions: 0, doubtful: [], notes: ['not_enough'], touched: true },
  { n: '8 boat party one-off, past', read: mk({ title: 'Boat Party', dates: [d('2026-09-12')], venue_name: 'Thames Boat' }),
    kind: 'one_date', firstDate: '2026-09-12', extra: 0, venue: 'v-boat', said: null, sessions: 0, doubtful: ['firstDate'], notes: ['past_date'], touched: true },
  { n: '9 festival 6-8 Nov, address only', read: mk({ kind: 'festival', title: 'Bachata Fest', dates: [d('2026-12-06', '2026-12-08')], venue_address: '5 Quay Road, Poole' }),
    kind: 'festival', firstDate: '2026-12-06', extra: 2, venue: null, said: '5 Quay Road, Poole', sessions: 0, doubtful: ['venue'], notes: [], touched: true },
  { n: '10 Spanish festival "6, 7 y 8 NOV 2026"', read: mk({ kind: 'festival', title: 'Festival Bachata', dates: [d('2026-11-06', '2026-11-08')], venue_name: 'Casa Baile', venue_address: 'Calle Mayor 1, Madrid' }),
    kind: 'festival', firstDate: '2026-11-06', extra: 2, venue: null, said: 'Casa Baile, Calle Mayor 1, Madrid', sessions: 0, doubtful: ['firstDate', 'venue'], notes: ['past_date'], touched: true },
  { n: '11 price-only promo (not_enough)', read: mk({ kind: 'not_enough', price: { amount_pence: 1000, currency: 'GBP' } }),
    kind: 'one_date', firstDate: '', extra: 0, venue: null, said: null, sessions: 0, doubtful: ['prices'], notes: ['not_enough'], touched: true },
];
