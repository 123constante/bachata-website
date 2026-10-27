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

export const STRIPE_COPY: Record<StripeState, { tag: string; tone: StatusTone; title: (eventName: string) => string; body: string; action: string | null }> = {
  none: {
    tag: 'Not connected',
    tone: 'neutral',
    title: (eventName) => `Connect payments to sell ${eventName}`,
    body: 'Stripe pays you directly. About 10 minutes, once.',
    action: 'Connect payments',
  },
  started: {
    tag: 'Not finished',
    tone: 'draft',
    title: () => 'Finish connecting payments',
    body: 'Stripe still needs a few details before you can sell paid tickets. Free tickets work meanwhile.',
    action: 'Finish connecting',
  },
  connected: {
    tag: 'Paid out via Stripe',
    tone: 'live',
    title: () => 'Payments connected',
    body: 'Stripe pays the money into your bank account.',
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

export type OrderStatus = 'pending' | 'expired' | 'paid' | 'refunded' | 'disputed' | string;
/** The orders the list shows; pending / expired rows still freeze the price (hasOrders). */
export const SHOWN_ORDER: readonly string[] = ['paid', 'refunded', 'disputed'];
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
const POUND = '\u00A3';

export const formatPence = (pence: number): string => `${POUND}${(pence / 100).toFixed(2)}`;
export const priceLabel = (pence: number): string => (pence === 0 ? 'Free' : formatPence(pence));

/** "12", "12.5", "12.50", "\u00A312.50" -> pence; anything else (or over the server's 1,000,000p cap) -> null. */
export const penceOf = (text: string): number | null => {
  const t = text.trim().replace(/^\u00A3/, '');
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
/** When the sales summary is not readable: held tickets (paid + waiting for payment), never a made-up 0 sold. */
export const takenLine = (reserved: number, capacity: number): string => `${reserved} of ${capacity} taken`;

// ---- Status moves ------------------------------------------------------------------

export interface MoveContext {
  role: MemberRole | null | undefined;
  /** 'unknown' while the account row is loading or could not be read. */
  stripe: StripeState | 'unknown';
  /** event_series_p5.lifecycle_status === 'live': the server refuses on_sale otherwise. */
  seriesLive: boolean;
}

/** Why a move button is disabled, or null when it can be pressed. One rule for every screen. */
export const moveBlock = (type: Pick<TicketType, 'pricePence' | 'reserved' | 'capacity'>, to: TicketStatus, ctx: MoveContext): string | null => {
  if (!canManage(ctx.role)) return NOT_MANAGER;
  if (to === 'on_sale' && !ctx.seriesLive) return 'Put this event live before selling tickets.';
  if (to === 'on_sale' && type.reserved >= type.capacity) return 'Every ticket is taken. Raise the number of tickets first.';
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe === 'unknown') return 'Checking your payment set-up. Reload the page if this stays.';
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe !== 'connected') return 'Connect payments on your Tickets home before selling paid tickets.';
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
export const refundAmount = (o: Pick<Order, 'totalPence' | 'refundedPence'>): number => Math.max(0, o.totalPence - o.refundedPence);
/** A paid order with money left to give back (a free order, or one already refunded in full, has none). */
export const refundable = (o: Pick<Order, 'status' | 'totalPence' | 'refundedPence'>): boolean => o.status === 'paid' && refundAmount(o) > 0;

/** The buyer's name as every screen shows it; the order row may not carry one. */
export const buyerNameOf = (o: Pick<Order, 'buyerName'>): string => o.buyerName?.trim() || 'Buyer';

export const refundQuestion = (o: Order): { title: string; body: string; confirm: string } => {
  const amount = formatPence(refundAmount(o));
  const one = o.quantity === 1;
  return {
    title: `Refund ${buyerNameOf(o)}?`,
    body:
      `${amount} goes back, booking fee included. ` +
      `${one ? 'Their ticket stops' : `Their ${o.quantity} tickets stop`} working and the ${one ? 'place reopens' : 'places reopen'}. Cannot be undone.`,
    confirm: `Refund ${amount}`,
  };
};

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
  bad_transition: 'That change is not possible from the ticket\u2019s current state. Reload the page.',
  at_capacity: 'Every ticket is taken. Raise the number of tickets first.',
  organiser_not_onboarded: 'Connect payments on your Tickets home before selling paid tickets.',
};
export const reasonMessage = (reason: string | null | undefined): string =>
  (reason && REASON[reason]) || 'That did not work. Try again in a moment.';

// ---- Compact screens (S3b, owner picked mockup B; docs/design/1060.md) ---------------

const DOT = '\u00B7';
const TIMES = '\u00D7';

/** "50p" under a pound, "\u00A31.50" from a pound up. */
export const feeLabel = (pence: number): string => (pence < 100 ? `${pence}p` : formatPence(pence));

/** What a buyer pays for ONE ticket. The one sum behind the editor's live box, the review and the order lines. */
export interface BuyerTotal {
  free: boolean;
  ticketPence: number;
  feePence: number;
  totalPence: number;
  /** "\u00A310.00 ticket + 50p booking fee", or "Free, no fee". */
  line: string;
}
export const buyerTotal = (pricePence: number): BuyerTotal =>
  pricePence > 0
    ? {
        free: false,
        ticketPence: pricePence,
        feePence: BOOKING_FEE_PENCE,
        totalPence: pricePence + BOOKING_FEE_PENCE,
        line: `${formatPence(pricePence)} ticket + ${feeLabel(BOOKING_FEE_PENCE)} booking fee`,
      }
    : { free: true, ticketPence: 0, feePence: 0, totalPence: 0, line: 'Free, no fee' };

/** One price box in the editor: empty or 0 is a free ticket, anything else is paid (and validated as a price). */
export const paidOf = (priceText: string): boolean => priceText.trim() !== '' && penceOf(priceText) !== 0;
/** The form's price in pence, or null while the typed text is not a price yet. */
export const formPence = (f: Pick<TypeForm, 'paid' | 'price'>): number | null => (f.paid ? penceOf(f.price) : 0);

/** Places still free: capacity less every held ticket (paid and waiting for payment). */
export const leftOf = (t: { capacity: number; reserved: number }): number => Math.max(0, t.capacity - t.reserved);
/** "12 sold \u00B7 8 left"; without the sales summary only the places left (never a made-up 0 sold). */
export const countsLine = (sold: number | null, left: number): string => (sold === null ? `${left} left` : `${sold} sold ${DOT} ${left} left`);

// ---- The Selling switch (replaces the Pause / Put on sale buttons) ------------------

/** The switch's label states the state, so it reads right whichever way it is set. */
export const SWITCH_LABEL: Record<TicketStatus, string> = {
  draft: 'Not on sale',
  on_sale: 'Selling',
  paused: 'Paused',
  sold_out: 'Sold out',
  closed: 'Closed',
};
/** Where one tap on the switch moves the ticket, or null (closed has no switch). */
export const switchMove = (s: TicketStatus): TicketStatus | null => (s === 'closed' ? null : s === 'on_sale' ? 'paused' : 'on_sale');

// ---- Home: one event's state, setup progress, the Next step ------------------------

export type EventSale = 'none' | 'selling' | 'sold_out' | 'not_selling';
export const eventSaleOf = (types: readonly Pick<TypeSales, 'status'>[]): EventSale => {
  const open = types.filter((t) => t.status !== 'closed');
  if (types.length === 0 || open.length === 0) return 'none';
  if (open.some((t) => t.status === 'on_sale')) return 'selling';
  if (open.some((t) => t.status === 'sold_out')) return 'sold_out';
  return 'not_selling';
};
export const EVENT_SALE: Record<EventSale, { label: string; tone: StatusTone }> = {
  none: { label: 'No tickets', tone: 'neutral' },
  selling: { label: 'Selling', tone: 'live' },
  sold_out: { label: 'Sold out', tone: 'party' },
  not_selling: { label: 'Not selling', tone: 'draft' },
};
/** "8 left of 20" over the event's ticket types still in play; null when there are none. */
export const eventLeftLine = (types: readonly Pick<TypeSales, 'status' | 'capacity' | 'reserved'>[]): string | null => {
  const open = types.filter((t) => t.status !== 'closed');
  if (open.length === 0) return null;
  const cap = open.reduce((n, t) => n + t.capacity, 0);
  const left = open.reduce((n, t) => n + leftOf(t), 0);
  return `${left} left of ${cap}`;
};

export interface SetupStep {
  key: 'payments' | 'ticket' | 'on_sale';
  label: string;
  done: boolean;
}
/** The 3-part setup bar. Payments count as done when every ticket so far is free (free needs no Stripe). */
export const setupSteps = (stripe: StripeState, types: readonly Pick<TypeSales, 'status' | 'pricePence' | 'ticketsSold'>[]): SetupStep[] => {
  const allFree = types.length > 0 && types.every((t) => t.pricePence === 0);
  return [
    { key: 'payments', label: 'Payments connected', done: stripe === 'connected' || allFree },
    { key: 'ticket', label: 'First ticket added', done: types.length > 0 },
    { key: 'on_sale', label: 'On sale', done: types.some((t) => t.status === 'on_sale' || t.ticketsSold > 0) },
  ];
};
export const setupLine = (steps: readonly SetupStep[]): string => `Setup ${steps.filter((s) => s.done).length} of ${steps.length} done`;

export type NextStep =
  | { kind: 'connect'; stripe: 'none' | 'started'; seriesId: string; seriesName: string }
  | { kind: 'add'; seriesId: string; seriesName: string }
  | { kind: 'sell'; seriesId: string; seriesName: string };

/**
 * The ONE highlighted card on Home: the first setup step not done, on the event it is about.
 * null when setup is done, when there is no live event, or for a role that cannot act.
 */
export const nextStep = (
  role: MemberRole | null | undefined,
  stripe: StripeState,
  live: readonly { id: string; name: string }[],
  types: readonly Pick<TypeSales, 'seriesId' | 'status' | 'pricePence' | 'ticketsSold'>[],
): NextStep | null => {
  if (!canManage(role) || live.length === 0) return null;
  const [payments, ticket, onSale] = setupSteps(stripe, types);
  const bare = live.find((s) => !types.some((t) => t.seriesId === s.id)) ?? live[0];
  if (!payments.done && stripe !== 'connected') return { kind: 'connect', stripe, seriesId: bare.id, seriesName: bare.name };
  if (!ticket.done) return { kind: 'add', seriesId: bare.id, seriesName: bare.name };
  if (!onSale.done) {
    const withTypes = live.find((s) => types.some((t) => t.seriesId === s.id && t.status !== 'closed'));
    return withTypes ? { kind: 'sell', seriesId: withTypes.id, seriesName: withTypes.name } : { kind: 'add', seriesId: bare.id, seriesName: bare.name };
  }
  return null;
};

// ---- Orders ----------------------------------------------------------------------

const dayKeyBefore = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "today", "yesterday" or "6 Nov" for a paid_at instant, in London; '' when unknown. */
export const dayWord = (iso: string | null, todayKey: string): string => {
  const stamp = iso ? instantToLondonWallClockStamp(iso) : null;
  if (!stamp) return '';
  const key = stamp.slice(0, 10);
  if (key === todayKey) return 'today';
  if (key === dayKeyBefore(todayKey)) return 'yesterday';
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${SHORT_MONTH[m - 1]}`;
};
/** "2 \u00D7 \u00A310.50 \u00B7 today": tickets, what each cost the buyer (fee in), and when. */
export const orderLine = (o: Pick<Order, 'quantity' | 'totalPence' | 'paidAt'>, todayKey: string): string => {
  const each = o.quantity > 0 ? Math.round(o.totalPence / o.quantity) : o.totalPence;
  const price = each === 0 ? 'Free' : formatPence(each);
  const day = dayWord(o.paidAt, todayKey);
  return `${o.quantity} ${TIMES} ${price}${day ? ` ${DOT} ${day}` : ''}`;
};

// ---- Editor steps and review -------------------------------------------------------

export const EDITOR_STEPS = 3;
/** The fields each step owns; Continue checks only these. */
export const STEP_FIELDS: Record<1 | 2, readonly (keyof TypeForm)[]> = {
  1: ['name', 'price'],
  2: ['capacity', 'opensAt', 'closesAt'],
};
export const stepErrors = (errors: FormErrors, step: 1 | 2): FormErrors =>
  Object.fromEntries(Object.entries(errors).filter(([k]) => STEP_FIELDS[step].includes(k as keyof TypeForm)));

/** A one-off's start: the default "Sales close" for a new ticket. A series has no single start, so null. */
export const eventStartOf = (s: { upcoming_count?: number; next_dates?: readonly { materialised_start_utc: string | null }[] } | null | undefined): string | null =>
  s && s.upcoming_count === 1 && s.next_dates?.length === 1 ? s.next_dates[0].materialised_start_utc : null;

const whenWords = (input: string): string => {
  const [date, time] = input.split('T');
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${SHORT_MONTH[m - 1]}, ${time}`;
};
export const opensWords = (opensAt: string): string => (opensAt ? whenWords(opensAt) : 'Now');
export const closesWords = (closesAt: string, eventStart: string | null): string =>
  !closesAt ? 'When you stop selling' : eventStart && closesAt === isoToLondonInput(eventStart) ? 'Event start' : whenWords(closesAt);

/** Step 3 in plain words: price, places, on sale, closes, buyer total. */
export const reviewRows = (f: TypeForm, eventStart: string | null): { key: string; label: string; value: string }[] => {
  const pence = formPence(f) ?? 0;
  const total = buyerTotal(pence);
  return [
    { key: 'price', label: 'Price', value: priceLabel(pence) },
    { key: 'places', label: 'Places', value: f.capacity.trim() },
    { key: 'opens', label: 'On sale', value: opensWords(f.opensAt) },
    { key: 'closes', label: 'Closes', value: closesWords(f.closesAt, eventStart) },
    { key: 'buyer', label: 'Buyer pays', value: total.free ? total.line : formatPence(total.totalPence) },
  ];
};
