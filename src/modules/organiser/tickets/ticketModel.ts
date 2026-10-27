import { instantToLondonWallClockStamp, londonWallClockToInstant } from '@/lib/londonDate';
import type { StatusTone } from '../ui/StatusTag';

/**
 * Organiser ticketing (S3), the ONE reading of every ticketing fact the screens show:
 * status words and tones, the status machine, what a role may do, Get paid state,
 * money, the editor's diff and every refusal's words. Pure: ticketsApi.ts is the wire.
 * Journey and shape survey: docs/organiser-ticketing-journey.md.
 */

export type TicketStatus = 'draft' | 'on_sale' | 'paused' | 'sold_out' | 'closed';
export const TICKET_STATUSES: readonly TicketStatus[] = ['draft', 'on_sale', 'paused', 'sold_out', 'closed'];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  draft: 'Not on sale yet',
  on_sale: 'On sale',
  paused: 'Paused',
  sold_out: 'Sold out',
  closed: 'Closed',
};

export const STATUS_TONE: Record<TicketStatus, StatusTone> = {
  draft: 'draft',
  on_sale: 'live',
  paused: 'draft',
  sold_out: 'party',
  closed: 'neutral',
};

/** ticket_type_set_status_v1's machine, mirrored so the screen offers only moves the server accepts. */
export const NEXT_STATUS: Record<TicketStatus, readonly TicketStatus[]> = {
  draft: ['on_sale', 'closed'],
  on_sale: ['paused', 'sold_out', 'closed'],
  paused: ['on_sale', 'closed'],
  sold_out: ['on_sale', 'closed'],
  closed: [],
};

/** The button that moves a ticket type TO this status. */
export const MOVE_LABEL: Record<TicketStatus, string> = {
  draft: '',
  on_sale: 'Put on sale',
  paused: 'Pause sales',
  sold_out: 'Mark sold out',
  closed: 'Close sales',
};

export const asStatus = (v: unknown): TicketStatus => (TICKET_STATUSES.includes(v as TicketStatus) ? (v as TicketStatus) : 'closed');

// ---- Who may do what (Q15: only owner / manager write or refund) -------------------

export type MemberRole = 'owner' | 'manager' | 'contributor' | string;
export const canManage = (role: MemberRole | null | undefined): boolean => role === 'owner' || role === 'manager';
export const NOT_MANAGER = 'Only an owner or manager of this page can change tickets.';
export const NOT_MANAGER_REFUND = 'Only an owner or manager of this page can refund.';
export const NOT_MANAGER_STRIPE = 'Only an owner or manager of this page can set up payments.';

// ---- Get paid (organiser_stripe_accounts) -----------------------------------------

export type StripeState = 'none' | 'started' | 'connected';
export interface StripeRow {
  charges_enabled?: unknown;
  payouts_enabled?: unknown;
  details_submitted?: unknown;
}
export const stripeStateOf = (row: StripeRow | null | undefined): StripeState =>
  !row ? 'none' : row.charges_enabled === true ? 'connected' : 'started';

export const STRIPE_COPY: Record<StripeState, { tag: string; tone: StatusTone; body: string; action: string | null }> = {
  none: {
    tag: 'Not set up',
    tone: 'neutral',
    body: 'Connect a Stripe account to sell paid tickets. Free tickets work without one.',
    action: 'Set up payments',
  },
  started: {
    tag: 'Not finished',
    tone: 'draft',
    body: 'Stripe still needs some details before you can sell paid tickets. Free tickets work meanwhile.',
    action: 'Finish setting up',
  },
  connected: {
    tag: 'Connected',
    tone: 'live',
    body: 'You can sell paid tickets. Stripe pays the money into your bank account.',
    action: null,
  },
};

/** The edge functions (S2) are not deployed yet: 404 / 503 / not_configured all read as this. */
export const NOT_SWITCHED_ON = 'Payments are not switched on yet. Free tickets work now; paid tickets and refunds come soon.';

// ---- Rows ------------------------------------------------------------------------

export interface TicketType {
  id: string;
  seriesId: string;
  occurrenceId: string | null;
  name: string;
  pricePence: number;
  capacity: number;
  reserved: number;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
  status: TicketStatus;
  manualSoldOut: boolean;
}

export interface TypeSales {
  id: string;
  seriesId: string;
  name: string;
  status: TicketStatus;
  pricePence: number;
  capacity: number;
  reserved: number;
  ticketsSold: number;
  ordersPaid: number;
  ordersPending: number;
  ordersRefunded: number;
  ordersDisputed: number;
  grossPence: number;
  bookingFeesPence: number;
  refundedPence: number;
}

export type OrderStatus = 'paid' | 'refunded' | 'disputed' | string;
export interface Order {
  id: string;
  typeId: string;
  buyerName: string | null;
  quantity: number;
  subtotalPence: number;
  bookingFeePence: number;
  totalPence: number;
  refundedPence: number;
  status: OrderStatus;
  paidAt: string | null;
}

export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
export const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

// ---- Money (GBP only, Q10) ---------------------------------------------------------

export const BOOKING_FEE_PENCE = 50;
export const MAX_PER_ORDER = 20;
const POUND = '£';

export const formatPence = (pence: number): string => `${POUND}${(pence / 100).toFixed(2)}`;
export const priceLabel = (pence: number): string => (pence === 0 ? 'Free' : formatPence(pence));

/** "12", "12.5", "12.50", "£12.50" -> pence; anything else (or over the server's 1,000,000p cap) -> null. */
export const penceOf = (text: string): number | null => {
  const t = text.trim().replace(/^£/, '');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return pence <= 1_000_000 ? pence : null;
};
export const poundsText = (pence: number): string => (pence / 100).toFixed(2);

// ---- Sales summary ------------------------------------------------------------------

export interface SalesTotals {
  ticketsSold: number;
  ordersPaid: number;
  ordersPending: number;
  ordersRefunded: number;
  ordersDisputed: number;
  grossPence: number;
  bookingFeesPence: number;
  refundedPence: number;
}
export const totalsOf = (rows: readonly TypeSales[]): SalesTotals =>
  rows.reduce<SalesTotals>(
    (t, r) => ({
      ticketsSold: t.ticketsSold + r.ticketsSold,
      ordersPaid: t.ordersPaid + r.ordersPaid,
      ordersPending: t.ordersPending + r.ordersPending,
      ordersRefunded: t.ordersRefunded + r.ordersRefunded,
      ordersDisputed: t.ordersDisputed + r.ordersDisputed,
      grossPence: t.grossPence + r.grossPence,
      bookingFeesPence: t.bookingFeesPence + r.bookingFeesPence,
      refundedPence: t.refundedPence + r.refundedPence,
    }),
    { ticketsSold: 0, ordersPaid: 0, ordersPending: 0, ordersRefunded: 0, ordersDisputed: 0, grossPence: 0, bookingFeesPence: 0, refundedPence: 0 },
  );

export const soldLine = (sold: number, capacity: number): string => `${sold} of ${capacity} sold`;

// ---- Status moves ------------------------------------------------------------------

export interface MoveContext {
  role: MemberRole | null | undefined;
  stripe: StripeState;
}

/** Why a move button is disabled, or null when it can be pressed. One rule for every screen. */
export const moveBlock = (type: Pick<TicketType, 'pricePence' | 'reserved' | 'capacity'>, to: TicketStatus, ctx: MoveContext): string | null => {
  if (!canManage(ctx.role)) return NOT_MANAGER;
  if (to === 'on_sale' && type.reserved >= type.capacity) return 'Every ticket is taken. Raise the number of tickets first.';
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe !== 'connected') return 'Set up payments under Get paid before selling paid tickets.';
  return null;
};

// ---- Sales window (London wall clock in the form, true instants on the wire) ---------

/** timestamptz -> 'YYYY-MM-DDTHH:mm' London, for <input type="datetime-local">. */
export const isoToLondonInput = (iso: string | null): string => {
  const stamp = instantToLondonWallClockStamp(iso);
  return stamp ? stamp.slice(0, 16).replace(' ', 'T') : '';
};
/** 'YYYY-MM-DDTHH:mm' London -> true instant ISO, or null for an empty / bad value. */
export const londonInputToIso = (value: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = londonWallClockToInstant(`${value}:00+00`);
  return d ? d.toISOString() : null;
};
export const windowLine = (open: string | null, close: string | null): string => {
  const words = (iso: string) => isoToLondonInput(iso).replace('T', ' ');
  if (open && close) return `Sales ${words(open)} to ${words(close)}`;
  if (open) return `Sales open ${words(open)}`;
  if (close) return `Sales close ${words(close)}`;
  return 'No sales window';
};

// ---- Editor -------------------------------------------------------------------------

export interface TypeForm {
  name: string;
  paid: boolean;
  price: string;
  capacity: string;
  opensAt: string;
  closesAt: string;
}

export const formOf = (t: TicketType | null): TypeForm =>
  t
    ? {
        name: t.name,
        paid: t.pricePence > 0,
        price: t.pricePence > 0 ? poundsText(t.pricePence) : '',
        capacity: String(t.capacity),
        opensAt: isoToLondonInput(t.salesOpenAt),
        closesAt: isoToLondonInput(t.salesCloseAt),
      }
    : { name: '', paid: false, price: '', capacity: '', opensAt: '', closesAt: '' };

export type FormErrors = Partial<Record<keyof TypeForm, string>>;

export interface FormContext {
  /** Orders exist: the server freezes the price (has_orders). */
  hasOrders: boolean;
  /** Tickets already reserved: capacity cannot go below it. */
  reserved: number;
}

export const validateForm = (f: TypeForm, ctx: FormContext): FormErrors => {
  const e: FormErrors = {};
  const name = f.name.trim();
  if (!name) e.name = 'Give the ticket a name, for example Early bird.';
  else if (name.length > 200) e.name = 'Keep the name under 200 characters.';
  if (f.paid) {
    const p = penceOf(f.price);
    if (p === null || p === 0) e.price = 'Enter a price in pounds, for example 12.50.';
  }
  const cap = /^\d{1,6}$/.test(f.capacity.trim()) ? Number(f.capacity.trim()) : NaN;
  if (!Number.isInteger(cap) || cap < 1 || cap > 100_000) e.capacity = 'Enter how many tickets, from 1 to 100,000.';
  else if (cap < ctx.reserved) e.capacity = `${ctx.reserved} tickets are already taken, so it cannot go lower than that.`;
  if (f.opensAt && !londonInputToIso(f.opensAt)) e.opensAt = 'Pick a date and time.';
  if (f.closesAt && !londonInputToIso(f.closesAt)) e.closesAt = 'Pick a date and time.';
  const o = londonInputToIso(f.opensAt);
  const c = londonInputToIso(f.closesAt);
  if (o && c && o >= c) e.closesAt = 'Sales must close after they open.';
  return e;
};

export interface UpsertDraft {
  id: string | null;
  organiserId: string;
  seriesId: string;
  occurrenceId: string | null;
  name: string;
  pricePence: number;
  capacity: number;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
}

/**
 * The write the form asks for, or null when there is nothing to send: an edit whose
 * values all equal the stored row sends no command. The server overwrites every
 * field, so an edit always carries the full row (occurrence unchanged).
 */
export const buildUpsert = (
  f: TypeForm,
  original: TicketType | null,
  ids: { organiserId: string; seriesId: string },
): UpsertDraft | null => {
  const draft: UpsertDraft = {
    id: original?.id ?? null,
    organiserId: ids.organiserId,
    seriesId: original?.seriesId ?? ids.seriesId,
    occurrenceId: original?.occurrenceId ?? null,
    name: f.name.trim(),
    pricePence: f.paid ? penceOf(f.price) ?? 0 : 0,
    capacity: Number(f.capacity.trim()),
    salesOpenAt: londonInputToIso(f.opensAt),
    salesCloseAt: londonInputToIso(f.closesAt),
  };
  if (!original) return draft;
  const same =
    draft.name === original.name &&
    draft.pricePence === original.pricePence &&
    draft.capacity === original.capacity &&
    sameInstant(draft.salesOpenAt, original.salesOpenAt) &&
    sameInstant(draft.salesCloseAt, original.salesCloseAt);
  return same ? null : draft;
};

const sameInstant = (a: string | null, b: string | null): boolean =>
  a === b || (!!a && !!b && new Date(a).getTime() === new Date(b).getTime());

/** Why the price field is locked, or null. */
export const priceLock = (hasOrders: boolean): string | null =>
  hasOrders ? 'The price cannot change once someone has bought a ticket.' : null;

/** Why the whole editor is read-only, or null. */
export const editLock = (t: TicketType | null, role: MemberRole | null | undefined): string | null => {
  if (!canManage(role)) return NOT_MANAGER;
  if (t?.status === 'closed') return 'Sales are closed for this ticket, so it cannot be changed.';
  return null;
};

// ---- Refunds (Q5: a partial refund keeps tickets valid; the UI refunds whole orders) --

/** Why the Refund button is disabled, or null. Only a paid order shows the button at all (refundable). */
export const refundBlock = (role: MemberRole | null | undefined): string | null => (canManage(role) ? null : NOT_MANAGER_REFUND);
export const refundable = (o: Pick<Order, 'status'>): boolean => o.status === 'paid';
export const refundAmount = (o: Pick<Order, 'totalPence' | 'refundedPence'>): number => Math.max(0, o.totalPence - o.refundedPence);

export const refundQuestion = (o: Order): { title: string; body: string } => ({
  title: `Refund ${formatPence(refundAmount(o))}?`,
  body:
    `${o.buyerName ?? 'The buyer'} gets back ${formatPence(refundAmount(o))} for ${o.quantity} ${o.quantity === 1 ? 'ticket' : 'tickets'}, ` +
    `including the 50p booking fee per ticket (${formatPence(o.bookingFeePence)}). Their tickets stop working. This cannot be undone.`,
});

export const ORDER_TAG: Record<string, { label: string; tone: StatusTone }> = {
  paid: { label: 'Paid', tone: 'live' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'party' },
};
export const orderTag = (status: string) => ORDER_TAG[status] ?? { label: status, tone: 'neutral' as StatusTone };

// ---- Server refusals -----------------------------------------------------------------

const REASON: Record<string, string> = {
  not_authorised: NOT_MANAGER,
  not_found: 'This ticket is not there any more. Reload the page.',
  invalid_payload: 'Something in the form is not right. Check it and try again.',
  invalid_name: 'Give the ticket a name under 200 characters.',
  invalid_price: 'Enter a price from 0 to 10,000 pounds.',
  invalid_capacity: 'Enter how many tickets, from 1 to 100,000.',
  invalid_sales_window: 'Sales must close after they open.',
  series_not_live_or_not_organisers: 'Tickets can only be added to a live event of this page.',
  series_not_live: 'Put the event live before selling tickets.',
  occurrence_not_in_series: 'That date is not part of this event.',
  immutable_field: 'This ticket belongs to another event.',
  closed: 'Sales are closed for this ticket, so it cannot be changed.',
  has_orders: 'The price cannot change once someone has bought a ticket.',
  capacity_below_reserved: 'More tickets are already taken than that number.',
  bad_transition: 'That change is not possible from the ticket’s current state. Reload the page.',
  at_capacity: 'Every ticket is taken. Raise the number of tickets first.',
  organiser_not_onboarded: 'Set up payments under Get paid before selling paid tickets.',
};
export const reasonMessage = (reason: string | null | undefined): string =>
  (reason && REASON[reason]) || 'That did not work. Try again in a moment.';
