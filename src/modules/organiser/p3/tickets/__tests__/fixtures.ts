import type { HomeOrganiser, OrganiserHome } from '../../../shared/selfServeApi';
import type { Order, StripeRow, TicketType, TypeSales } from '../../../tickets/ticketModel';

/*
 * Ticketing shapes for the W-T matrix, from the read-only prod survey (stsdtacfauprzrdebmzg,
 * 27 Oct 2026, counts only): 51 pages with a team, 50 with NO Stripe row, 1 with one row
 * (charges on), 0 with two; 1 series with ticket types, it has 2 (one free, one paid), both
 * PAUSED, live series, no sales window, no occurrence; orders: 1 paid (free, qty > 1) and
 * 1 refunded; 0 disputed, 0 pending, 0 partial refunds, 0 with no buyer name; at most 2
 * orders a series. The shapes prod has not reached yet (selling, sold out, closed, a
 * started Stripe row, disputed, > 2 orders, a past event, a contributor) are built
 * from the same columns so the screens meet them before prod does. Names are stand-ins.
 */

export const TODAY = '2026-10-27';
export const SERIES = 'ser-1';
export const ORG = 'org-1';

export const series = (over: Partial<HomeOrganiser['series'][number]> = {}): HomeOrganiser['series'][number] => ({
  id: SERIES,
  name: 'Sunday Social',
  slug: null,
  format: 'recurring',
  category: 'party',
  lifecycle_status: 'live',
  default_local_start_time: '19:00:00',
  default_cover_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  upcoming_count: 5,
  cancelled_upcoming_count: 0,
  next_dates: [{ occurrence_id: 'o1', occurrence_date: '2026-11-01', lifecycle_status: 'scheduled', materialised_start_utc: '2026-11-01T19:00:00+00:00', has_own_changes: false }] as never,
  latest_decision: null,
  ...over,
});

export const org = (over: Partial<HomeOrganiser> = {}, s = series()): HomeOrganiser => ({
  id: ORG,
  name: 'Salsa Soho Socials',
  slug: null,
  avatar_url: null,
  city_id: null,
  lifecycle_status: 'live',
  role: 'owner',
  latest_decision: null,
  series: [s],
  ...over,
});

export const home = (o: HomeOrganiser | null = org()): OrganiserHome => ({ today: TODAY, organisers: o ? [o] : [] }) as unknown as OrganiserHome;

export const type = (id: string, over: Partial<TicketType> = {}): TicketType => ({
  id,
  seriesId: SERIES,
  occurrenceId: null,
  name: `Type ${id}`,
  pricePence: 1200,
  capacity: 40,
  reserved: 0,
  salesOpenAt: null,
  salesCloseAt: null,
  status: 'on_sale',
  manualSoldOut: false,
  ...over,
});

export const sales = (t: TicketType, over: Partial<TypeSales> = {}): TypeSales => ({
  id: t.id,
  seriesId: t.seriesId,
  name: t.name,
  status: t.status,
  pricePence: t.pricePence,
  capacity: t.capacity,
  reserved: t.reserved,
  ticketsSold: t.reserved,
  ordersPaid: t.reserved > 0 ? 1 : 0,
  ordersPending: 0,
  ordersRefunded: 0,
  ordersDisputed: 0,
  grossPence: t.reserved * t.pricePence,
  bookingFeesPence: 0,
  refundedPence: 0,
  ...over,
});

export const order = (id: string, typeId: string, over: Partial<Order> = {}): Order => ({
  id,
  typeId,
  buyerName: `Buyer ${id}`,
  quantity: 2,
  subtotalPence: 2400,
  bookingFeePence: 100,
  totalPence: 2500,
  refundedPence: 0,
  status: 'paid',
  paidAt: '2026-10-27T10:00:00Z',
  ...over,
});

export const STRIPE: Record<'none' | 'started' | 'connected', StripeRow | null> = {
  none: null,
  started: { charges_enabled: false, payouts_enabled: false, details_submitted: true },
  connected: { charges_enabled: true, payouts_enabled: true, details_submitted: true },
};

export interface Shape {
  types: TicketType[];
  orders: Order[];
  /** Sales summary rows, or 'refused' (not_authorised). */
  sales: TypeSales[] | 'refused';
  stripe: 'none' | 'started' | 'connected';
  role: string;
  lifecycle: string;
}

const free = type('t-free', { name: 'Door', pricePence: 0, status: 'paused', reserved: 2, capacity: 30 });
const paid = type('t-paid', { name: 'Standard', pricePence: 1000, status: 'paused', capacity: 20 });
const survey: Shape = {
  types: [free, paid],
  orders: [
    order('o-free', 't-free', { buyerName: 'Jo', quantity: 2, subtotalPence: 0, bookingFeePence: 0, totalPence: 0 }),
    order('o-ref', 't-paid', { buyerName: 'Ana', quantity: 1, totalPence: 1050, subtotalPence: 1000, bookingFeePence: 50, refundedPence: 1050, status: 'refunded', paidAt: '2026-10-20T10:00:00Z' }),
  ],
  sales: [sales(free, { ticketsSold: 2 }), sales(paid, { ordersRefunded: 1, refundedPence: 1050 })],
  stripe: 'connected',
  role: 'owner',
  lifecycle: 'live',
};
const selling = type('t-sell', { name: 'Standard', status: 'on_sale', reserved: 14, capacity: 40 });
const sold = type('t-out', { name: 'Early bird', status: 'sold_out', reserved: 20, capacity: 20, pricePence: 800 });
const many: Order[] = Array.from({ length: 5 }, (_, i) => order(`o${i}`, i % 2 ? 't-sell' : 't-out', { paidAt: `2026-10-2${7 - i}T10:00:00Z` }));
many[3] = { ...many[3], status: 'refunded', refundedPence: 2500 };
many[4] = { ...many[4], status: 'disputed' };

export const SHAPES = {
  /** 0 ticket types, 0 Stripe rows: 50 of 51 prod pages. */
  bare: { types: [], orders: [], sales: [], stripe: 'none', role: 'owner', lifecycle: 'live' },
  /** The one prod series: 2 paused types (free + paid), a free paid order and a refunded one. */
  survey,
  /** Selling + sold out, 5 orders (paid, refunded, disputed): See all. */
  selling: { types: [selling, sold], orders: many, sales: [sales(selling), sales(sold)], stripe: 'connected', role: 'owner', lifecycle: 'live' },
  /** One draft paid type, Stripe started: Put on sale says where to connect. */
  started: { types: [type('t-d', { status: 'draft' })], orders: [], sales: [sales(type('t-d', { status: 'draft' }))], stripe: 'started', role: 'manager', lifecycle: 'live' },
  /** A closed type only. */
  closed: { types: [type('t-c', { status: 'closed', reserved: 3 })], orders: [order('oc', 't-c')], sales: [sales(type('t-c', { status: 'closed', reserved: 3 }))], stripe: 'connected', role: 'owner', lifecycle: 'live' },
  /** A past (ended) event with a paused type: nothing can go on sale. */
  past: { types: [type('t-p', { status: 'paused', reserved: 4 })], orders: [order('op', 't-p')], sales: [sales(type('t-p', { status: 'paused', reserved: 4 }))], stripe: 'connected', role: 'owner', lifecycle: 'ended' },
  /** A contributor: reads everything, changes nothing. */
  contributor: { types: [selling], orders: many.slice(0, 2), sales: 'refused', stripe: 'none', role: 'contributor', lifecycle: 'live' },
} satisfies Record<string, Shape>;
export type ShapeKey = keyof typeof SHAPES;
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];
