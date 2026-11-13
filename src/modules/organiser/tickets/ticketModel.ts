import { instantToLondonWallClockStamp, londonWallClockToInstant } from '@/lib/londonDate';
import { BOOKING_FEE_PENCE } from '@/lib/ticketBookingFee';
import { MONTH_NAMES } from '../shared/dateWords';
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
// Slice 2 (PQ1): refunds and payouts are the owner's alone, so the role notes say to ask the owner.
/** The once-per-list note for a legacy contributor row (A1); a manager gets NOT_OWNER_REFUND per row. */
export const NOT_MANAGER_REFUND = 'Ask the owner to refund an order.';
/** GetPaid for anyone but the owner: no Connect action, no amounts. */
export const PAYOUTS_ASK_OWNER = 'Ask the owner to set up payouts.';

// ---- Owner-only money (organiser area v2 slice 2: PQ1, Q15) -------------------------
// A manager (and a legacy contributor row, A1) sees ticket COUNTS: no amount on any line,
// no Refund, no payout action. The owner alone sees money and refunds.
export const isOwner = (role: MemberRole | null | undefined): boolean => role === 'owner';
/** Refund is the one money write on Tickets (Q15): owner only (PQ1). */
export const canRefund = isOwner;
/** Stripe onboarding / payout set-up: owner only (PQ1). Every entry point reads this one rule. */
export const canSetUpPayouts = isOwner;
/** Sales, refunds and payout amounts: owner only. */
export const seesMoney = isOwner;
/** Shown on a refundable order row for anyone but the owner (testid tix-refund-ask-owner). */
export const NOT_OWNER_REFUND = 'Ask the owner to refund this order.';
/** The counts-only note on a manager's orders view (testid tix-counts-only). */
export const COUNTS_ONLY_NOTE = 'Ticket counts only. The owner sees sales and refunds.';

// ---- Going count and external ticket link (slice 2: T4 / Q16, X5) ------------------
// Counts and words only: neither line ever carries an amount, so both read the same for
// owner, manager and a legacy contributor row (A1).

/** One upcoming night as get_my_series_going_v1 gives it (only what the count needs). */
export interface GoingNightCount {
  is_cancelled: boolean;
  going_count: number;
}

/** Going taps over the upcoming nights that still happen; a cancelled night counts for nothing. */
export function goingTotal(nights: readonly GoingNightCount[]): { going: number; nights: number } {
  const on = nights.filter((n) => !n.is_cancelled);
  return { going: on.reduce((sum, n) => sum + Math.max(0, Math.floor(n.going_count || 0)), 0), nights: on.length };
}

/**
 * The free event's "Going" line (testid tix-going-count): only when nothing on it is paid
 * (a paid ticket's sales say the same thing better), and only when someone has tapped Going.
 * null = no line.
 */
export function goingCountLine(nights: readonly GoingNightCount[] | null, types: readonly Pick<TicketType, 'pricePence'>[]): string | null {
  if (!nights || types.some((t) => t.pricePence > 0)) return null;
  const { going, nights: n } = goingTotal(nights);
  if (going === 0) return null;
  const who = going === 1 ? '1 person is' : `${going} people are`;
  const when = n === 1 ? 'the next date' : `the next ${n} dates`;
  return `Going: ${who} going to ${when}. Free event: no money is taken here.`;
}

/** The host of a ticket link, for the line (never the whole URL with its tracking). */
function linkHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return 'your own ticket link';
  }
}

/**
 * The external-link line (testid tix-external-link): the event sells on its own ticket link and
 * has no ticket types here, so the Tickets view offers no payment controls. null = no line.
 */
export function externalTicketLine(ticketUrl: string | null, types: readonly unknown[]): string | null {
  if (!ticketUrl || types.length > 0) return null;
  return `This event sells tickets on its own link (${linkHost(ticketUrl)}), not here.`;
}

// ---- Get paid (organiser_stripe_accounts) -----------------------------------------

/**
 * none: no account row. started: a row, the forms are not all sent (Stripe still needs details from the person).
 * waiting: every form sent (details_submitted), charges not on yet (Stripe is checking; nothing is left to do but wait).
 * connected: charges on.
 */
export type StripeState = 'none' | 'started' | 'waiting' | 'connected';
export interface StripeRow {
  charges_enabled?: unknown;
  payouts_enabled?: unknown;
  details_submitted?: unknown;
}
export const stripeStateOf = (row: StripeRow | null | undefined): StripeState =>
  !row ? 'none' : row.charges_enabled === true ? 'connected' : row.details_submitted === true ? 'waiting' : 'started';

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
  waiting: {
    tag: 'Stripe is checking',
    tone: 'draft',
    title: () => 'Stripe is checking your details',
    body: 'Stripe is checking the details you sent. This is usually quick. You can sell paid tickets as soon as it is done. Free tickets work meanwhile.',
    action: 'Check again',
  },
  connected: {
    tag: 'Paid out via Stripe',
    tone: 'live',
    title: () => 'Payments connected',
    body: 'Stripe pays the money into your bank account.',
    action: null,
  },
};

/** The edge functions (S2) are not deployed yet: 404 / 503 / not_configured all read as this (refunds are stricter: only a body saying not_configured does). */
/** The waiting state's two real actions: refetch the status, and carry on at Stripe if the person wants to. */
export const CHECK_AGAIN_LABEL = 'Check again';
export const OPEN_STRIPE_LABEL = 'Open Stripe';
/** Why a paid ticket cannot go on sale while Stripe is checking; also the line of the waiting Connect block. */
export const STRIPE_WAITING_REASON = 'Stripe is still checking your details. Paid tickets can go on sale as soon as it is done.';
/** The return banner while waiting, once the poll is over. */
export const CONNECT_RETURN_WAITING = 'Stripe is checking your details. This is usually quick, and you can sell as soon as it is done.';

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
  /** Sum of promo-code discounts on paid orders; grossPence is already net of it. */
  discountsPence: number;
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

// The one shared constant (server: env TICKET_BOOKING_FEE_PENCE, set to 0 since 2026-10-29).
export { BOOKING_FEE_PENCE };
export const MAX_PER_ORDER = 20;
const POUND = '\u00A3';

/** "\u00A3240,170.00": the ONE money format on every screen (thousands separators, two decimals). */
export const formatPence = (pence: number): string =>
  `${POUND}${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** "2,022": the ONE format for a count shown on a card. */
export const formatCount = (n: number): string => n.toLocaleString('en-GB');
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
  discountsPence: number;
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
      discountsPence: t.discountsPence + r.discountsPence,
      bookingFeesPence: t.bookingFeesPence + r.bookingFeesPence,
      refundedPence: t.refundedPence + r.refundedPence,
    }),
    { ticketsSold: 0, ordersPaid: 0, ordersPending: 0, ordersRefunded: 0, ordersDisputed: 0, grossPence: 0, discountsPence: 0, bookingFeesPence: 0, refundedPence: 0 },
  );


// ---- Status moves ------------------------------------------------------------------

export interface MoveContext {
  role: MemberRole | null | undefined;
  /** 'unknown' while the account row is loading or could not be read. */
  stripe: StripeState | 'unknown';
  /** event_series_p5.lifecycle_status === 'live': the server refuses on_sale otherwise. */
  seriesLive: boolean;
}

/** Where a paid ticket's seller connects payments (the one Get paid screen). */
export const PAYMENTS_WHERE_LINK = 'Connect payments in You \u203A Get paid'; // PAYMENTS_WHERE_LINK: the tap target inside PAYMENTS_WHERE
export const PAYMENTS_WHERE = `${PAYMENTS_WHERE_LINK} before selling paid tickets.`;

/** STRIPE_AT_PRICE_HINT: shown at price entry (step 1) once the price is above zero, so the next step is no surprise. */
export const STRIPE_AT_PRICE_HINT = 'Paid tickets are paid out through Stripe. About 10 minutes: you leave the app for Stripe and come back.';
/** SELLING_ELSEWHERE_LINK: the small plain text link under Connect payments; it opens the event Details ticket link field. Never primary. */
export const SELLING_ELSEWHERE_LINK = 'Selling elsewhere? Add a ticket link';
/** STRIPE_REFRESH_NOTE: why the person is back after `stripe=refresh`. */
export const STRIPE_REFRESH_NOTE = 'The Stripe link ran out. Carry on with Stripe to get a fresh one.';
/** CONNECT_START_ERROR_SHOWN: the start error has this test id wherever it is drawn (sheet, banner, draft row). */
export const CONNECT_START_ERROR_SHOWN = 'tix-connect-error';

/** Why a move button is disabled, or null when it can be pressed. One rule for every screen. */
export const moveBlock = (type: Pick<TicketType, 'pricePence' | 'reserved' | 'capacity'>, to: TicketStatus, ctx: MoveContext): string | null => {
  if (!canManage(ctx.role)) return NOT_MANAGER;
  if (to === 'on_sale' && !ctx.seriesLive) return 'Put this event live before selling tickets.';
  if (to === 'on_sale' && type.reserved >= type.capacity) return 'Every ticket is taken. Raise the number of tickets first.';
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe === 'unknown') return 'Checking your payment set-up. Try again in a moment.';
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe === 'waiting') return STRIPE_WAITING_REASON;
  if (to === 'on_sale' && type.pricePence > 0 && ctx.stripe !== 'connected') return canSetUpPayouts(ctx.role) ? PAYMENTS_WHERE : PAYOUTS_ASK_OWNER;
  return null;
};

// ---- Connect payments inline (the Add a ticket flow and a draft's row) ----------------

export const CONNECT_LINE = 'Connect payments to put this on sale';
export const CONNECT_LABEL = 'Connect payments';
export const CONNECT_RESUME_LABEL = 'Carry on with Stripe';

export interface ConnectBlock {
  /** 'connect': the button goes to Stripe. 'check': waiting, the button refetches and `openStripe` is the way on to Stripe. */
  kind: 'connect' | 'check';
  /** The moveBlock reason this block stands in for (it replaces that line on the screen). */
  replaces: string;
  line: string;
  /** The one button's words. */
  button: string;
  /** The start-onboarding error, when the last press failed. */
  error: string | null;
}

/**
 * The ONE decision for the Connect payments block, used by the sheet and by a draft's list row (they only
 * draw it). Null = no block: free ticket, not a manager (NOT_MANAGER stays), Stripe still loading (the
 * "Checking your payment set-up" reason stays), already connected, or onboarding cannot start
 * (not_configured: the existing disabled reason is the fallback).
 */
export const connectBlock = (
  pricePence: number,
  ctx: Pick<MoveContext, 'role' | 'stripe'>,
  onboarding: { switchedOff: boolean; note: string | null },
): ConnectBlock | null => {
  if (!(pricePence > 0) || !canSetUpPayouts(ctx.role)) return null;
  if (ctx.stripe === 'unknown' || ctx.stripe === 'connected' || onboarding.switchedOff) return null;
  if (ctx.stripe === 'waiting') {
    return { kind: 'check', replaces: STRIPE_WAITING_REASON, line: STRIPE_WAITING_REASON, button: CHECK_AGAIN_LABEL, error: onboarding.note };
  }
  return { kind: 'connect', replaces: PAYMENTS_WHERE, line: CONNECT_LINE, button: ctx.stripe === 'started' ? CONNECT_RESUME_LABEL : CONNECT_LABEL, error: onboarding.note };
};

// ---- After Stripe: the status banner on the Tickets sheet -------------------------------
export type ConnectReturnKind = 'refresh' | 'checking' | 'ready_drafts' | 'ready_none' | 'needs_more' | 'waiting';
export interface ConnectReturnBanner {
  kind: ConnectReturnKind;
  line: string;
  /** Buttons, in order: put each paid draft on sale, put them all on sale, or carry on with Stripe. */
  actions: ReadonlyArray<{ kind: 'put_on_sale' | 'put_all_on_sale' | 'carry_on' | 'check'; label: string; typeId?: string }>;
}
export const CONNECT_RETURN_CHECKING = 'Checking your payment set-up\u2026';
export const CONNECT_RETURN_NONE = 'Payments connected. Add a ticket to start selling.';
export const CONNECT_RETURN_NEEDS = 'A few details are still needed.';

/**
 * ONE mapping (Stripe state x paid drafts) for the banner shown when the person comes back from Stripe.
 * `drafts` is this event's ticket types. `polling` is true while the return poll is still running.
 * No banner: not from Stripe, not an owner or manager, or tickets exist but none is a paid draft
 * (a free-only list, or everything already moved on).
 */
export const connectReturnBanner = (i: {
  arrivedFromStripe: boolean;
  stripe: StripeState | 'unknown' | null;
  role: MemberRole | null | undefined;
  drafts: readonly Pick<TicketType, 'id' | 'name' | 'pricePence' | 'status'>[];
  polling?: boolean;
  /** Arrived with `stripe=refresh`: the Stripe link ran out. */
  refresh?: boolean;
}): ConnectReturnBanner | null => {
  const waitingBanner = (): ConnectReturnBanner => ({
    kind: 'waiting',
    line: CONNECT_RETURN_WAITING,
    actions: canSetUpPayouts(i.role) ? [{ kind: 'check', label: CHECK_AGAIN_LABEL }, { kind: 'carry_on', label: OPEN_STRIPE_LABEL }] : [{ kind: 'check', label: CHECK_AGAIN_LABEL }],
  });
  if (i.refresh && !i.arrivedFromStripe && canSetUpPayouts(i.role) && i.stripe !== 'connected') {
    if (i.stripe === 'waiting') return waitingBanner();
    return { kind: 'refresh', line: STRIPE_REFRESH_NOTE, actions: [{ kind: 'carry_on', label: CONNECT_RESUME_LABEL }] };
  }
  if (!i.arrivedFromStripe || !canManage(i.role)) return null;
  const paid = i.drafts.filter((t) => t.status === 'draft' && t.pricePence > 0);
  if (i.drafts.length > 0 && paid.length === 0) return null;
  if (i.stripe === 'connected') {
    if (paid.length === 0) return { kind: 'ready_none', line: CONNECT_RETURN_NONE, actions: [] };
    if (paid.length === 1) {
      return {
        kind: 'ready_drafts',
        line: `Payments connected. Put ${paid[0].name} on sale.`,
        actions: [{ kind: 'put_on_sale', label: 'Put on sale', typeId: paid[0].id }],
      };
    }
    return {
      kind: 'ready_drafts',
      line: `Payments connected. Put ${paid.map((t) => t.name).join(', ')} on sale.`,
      actions: [{ kind: 'put_all_on_sale', label: 'Put all on sale' }],
    };
  }
  if (i.polling || i.stripe === null || i.stripe === 'unknown') return { kind: 'checking', line: CONNECT_RETURN_CHECKING, actions: [] };
  if (i.stripe === 'waiting') return waitingBanner();
  if (!canSetUpPayouts(i.role)) return { kind: 'needs_more', line: PAYOUTS_ASK_OWNER, actions: [] };
  return { kind: 'needs_more', line: CONNECT_RETURN_NEEDS, actions: [{ kind: 'carry_on', label: CONNECT_RESUME_LABEL }] };
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
  /** T5 (flag ticketCoursePresets): a NEW ticket may be a course; absent = a per-night ticket, exactly as before. */
  kind?: 'night' | 'course';
  /** 'YYYY-MM-DD' (valid_from / valid_to are dates). */
  validFrom?: string;
  validTo?: string;
}

/** A series as the Tickets sheet knows it: how many upcoming dates, and the next one's start. */
export interface SeriesDates {
  upcoming_count?: number;
  next_dates?: readonly { materialised_start_utc: string | null }[];
}

/** A ticket type carries no date today, so on a series with 2+ upcoming dates it covers every one of them. */
export const coversEveryDate = (s: SeriesDates | null | undefined): boolean => (s?.upcoming_count ?? 0) > 1;

export const EVERY_DATE_NOTE =
  'This ticket is for every date of this event, and its numbers are shared across them. To stop selling after one night, set Sales close.';

/**
 * The default "Sales close" for a NEW ticket on a series with several dates: the next date's start,
 * as the London wall-clock text the form holds (same reading as eventStartOf). Null when the series
 * has fewer than two upcoming dates or the next start is missing.
 */
export const defaultCloseFor = (s: SeriesDates | null | undefined): string | null => {
  if (!coversEveryDate(s)) return null;
  const start = s?.next_dates?.[0]?.materialised_start_utc;
  return start ? isoToLondonInput(start) || null : null;
};

export const formOf = (t: TicketType | null, series?: SeriesDates | null): TypeForm =>
  t
    ? {
        name: t.name,
        paid: t.pricePence > 0,
        price: t.pricePence > 0 ? poundsText(t.pricePence) : '',
        capacity: String(t.capacity),
        opensAt: isoToLondonInput(t.salesOpenAt),
        closesAt: isoToLondonInput(t.salesCloseAt),
      }
    : { name: '', paid: false, price: '', capacity: '', opensAt: '', closesAt: defaultCloseFor(series) ?? '' };

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
  else if (cap < ctx.reserved) e.capacity = `${formatCount(ctx.reserved)} tickets are already taken, so it cannot go lower than that.`;
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
  /** Only a NEW course carries these (an edit sends no kind keys: the server keeps the type's kind and dates). */
  kind?: 'course';
  validFrom?: string;
  validTo?: string;
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
  if (!original) {
    if (f.kind === 'course') return { ...draft, kind: 'course', validFrom: f.validFrom, validTo: f.validTo };
    return draft;
  }
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

/** ONE wording for a locked price: the sheet's help line and the server's has_orders refusal both read it. */
export const PRICE_LOCKED_TEXT =
  'Tickets have been sold at this price, so it cannot change. To use a different price, pause this ticket and add a new one.';

/** What a paused ticket means, shown on its row. */
export const PAUSED_NOTE = 'Not on sale. People who already bought keep their tickets.';

/** Why the price field is locked, or null. */
export const priceLock = (hasOrders: boolean): string | null => (hasOrders ? PRICE_LOCKED_TEXT : null);

/** Why the whole editor is read-only, or null. */
export const editLock = (t: TicketType | null, role: MemberRole | null | undefined): string | null => {
  if (!canManage(role)) return NOT_MANAGER;
  if (t?.status === 'closed') return 'Sales are closed for this ticket, so it cannot be changed.';
  return null;
};

// ---- Refunds (Q5: a partial refund keeps tickets valid and the order stays paid; a whole refund voids tickets) --

/** Why the Refund button is disabled, or null. Only a paid order shows the button at all (refundable). */
/** Slice 2 (PQ1): refund is the owner's alone; anyone else is told to ask the owner. */
export const refundBlock = (role: MemberRole | null | undefined): string | null => (canRefund(role) ? null : NOT_MANAGER_REFUND);
export const refundAmount = (o: Pick<Order, 'totalPence' | 'refundedPence'>): number => Math.max(0, o.totalPence - o.refundedPence);
/** A paid order with money left to give back (a free order, or one already refunded in full, has none). */
export const refundable = (o: Pick<Order, 'status' | 'totalPence' | 'refundedPence'>): boolean => o.status === 'paid' && refundAmount(o) > 0;
/**
 * The ask-the-owner gate (review 1520-r1 F1): a non-owner's orders read carries no pence, so every amount
 * parses to 0 and `refundable` is always false there. The status is the one fact that read has.
 */
export const refundableByStatus = (o: Pick<Order, 'status'>): boolean => o.status === 'paid';

/** The buyer's name as every screen shows it; the order row may not carry one. */
export const buyerNameOf = (o: Pick<Order, 'buyerName'>): string => o.buyerName?.trim() || 'Buyer';

/**
 * The ONE order code (review 1520-r1 F4): the first 8 letters or digits of the order id, upper case, never
 * an email or a Stripe id. The orders list, the Refund sheet, its toast and the guest-list CSV all read it.
 */
export const shortRef = (id: string): string => id.replace(/[^0-9a-z]/gi, '').slice(0, 8).toUpperCase();
/**
 * The ONE buyer label (Q14, A2): first name plus the order's code, e.g. "Ana \u00B7 3F2A9C1E".
 * The orders list and the Refund sheet both read it; a full name is never shown to organisers.
 */
export const buyerFirstAndCode = (o: Pick<Order, 'buyerName' | 'id'>): string => {
  const first = o.buyerName?.trim().split(/\s+/)[0] || 'Buyer';
  const code = shortRef(o.id);
  return code ? `${first} \u00B7 ${code}` : first;
};

/**
 * The orders-list title. The owner sees first name plus code; a counts-only reader never fetched a name, so
 * they get "Order CODE" (no empty-looking gap, nothing pointing at a name that is not there).
 */
export const orderTitleFor = (showMoney: boolean, o: Pick<Order, 'buyerName' | 'id'>): string =>
  showMoney ? buyerFirstAndCode(o) : `Order ${shortRef(o.id) || ''}`.trim();

export const refundQuestion = (o: Order): { title: string; body: string; confirm: string } => {
  const amount = formatPence(refundAmount(o));
  const one = o.quantity === 1;
  return {
    title: `Refund ${buyerFirstAndCode(o)}?`,
    body:
      `${amount} goes back${o.bookingFeePence > 0 ? ', booking fee included' : ''}. ` +
      `${one ? 'Their ticket stops' : `Their ${o.quantity} tickets stop`} working and the ${one ? 'place reopens' : 'places reopen'}. Cannot be undone.`,
    confirm: `Refund ${amount}`,
  };
};

/**
 * The money check for "Refund part of it": null when the amount can be sent, else one plain
 * sentence naming the maximum (what is left = total - refunded). Typing exactly what is left is
 * fine: it goes as a partial with that amount and the server decides clears_balance.
 */
export const refundAmountError = (text: string, o: Pick<Order, 'totalPence' | 'refundedPence'>): string | null => {
  const max = formatPence(refundAmount(o));
  if (text.trim() === '') return `Enter how much to refund, up to ${max}.`;
  const pence = penceOf(text);
  if (pence === null) return `Enter an amount in pounds, like 3.50, up to ${max}.`;
  if (pence === 0) return `Enter more than ${formatPence(0)}, up to ${max}.`;
  if (pence > refundAmount(o)) return `That is more than is left. Enter up to ${max}.`;
  return null;
};

/** The "Refund part of it" words: the maximum line, the body, and the confirm button (amount only once it is valid). */
export const refundPartQuestion = (o: Pick<Order, 'totalPence' | 'refundedPence'>, validPence: number | null): { max: string; body: string; confirm: string } => ({
  max: `Up to ${formatPence(refundAmount(o))} left to refund`,
  // The whole remainder typed as a part: the server decides what happens to the order (clears_balance), so promise nothing.
  body:
    validPence !== null && validPence >= refundAmount(o)
      ? 'This gives back everything that is left on the order. Cannot be undone.'
      : 'The amount you enter goes back. Their tickets stay valid and the order stays paid. Cannot be undone.',
  confirm: validPence === null ? 'Refund' : `Refund ${formatPence(validPence)}`,
});

/**
 * The toast after a partial refund (the order row updates a moment later, once the webhook lands).
 * Only what the server said: no remainder when it did not send one, and no promise about the
 * tickets once the server says the balance is cleared (it settles that order, not this screen).
 */
export const partialRefundDone = (amountPence: number, remainingPence: number | null, clearsBalance = false): string => {
  const sent = `Refunded ${formatPence(amountPence)}.`;
  if (clearsBalance || remainingPence === 0) return `${sent} Nothing is left to refund.`;
  if (remainingPence === null) return `${sent} Tickets stay valid.`;
  return `${sent} ${formatPence(remainingPence)} is left to refund. Tickets stay valid.`;
};

/**
 * One idempotency key per press of Refund (ticket-refund request_id: 8-64 chars of [A-Za-z0-9_-]).
 * A UUID (36 chars of hex and dashes); the fallback mirrors shared/seriesCommands.ts newIdempotencyKey.
 */
export const newRefundRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

/**
 * Server answers that END a partial-refund press: the server has said no (or yes) for certain, so the
 * held key is dropped and the next press is a new refund. `stripe_error` and `internal_error` can happen
 * AFTER Stripe created the refund, and an unknown reason or gateway code says nothing, so those keep the
 * key and a retry sends the same one (the server answers the same press, never a second refund).
 */
export const DEFINITE_REFUND_REASONS: ReadonlySet<string> = new Set([
  'invalid_request',
  'invalid_amount',
  'request_id_required',
  'request_id_reused',
  'not_signed_in',
  'not_authorised',
  'not_found',
  'not_refundable',
  'refund_exceeds_balance',
  'method_not_allowed',
  'not_allowed',
]);
/** True when this outcome ends the press (drop the key); false keeps it for the retry. */
export const endsRefundPress = (kind: 'ok' | 'not_configured' | 'failed', reason: string | null): boolean =>
  kind !== 'failed' || (reason !== null && DEFINITE_REFUND_REASONS.has(reason));

/** Shown under the note while a key is held: the last press may have reached Stripe. */
export const refundMaybeSent = (pence: number): string =>
  `The last refund may have gone through. Tap Refund ${formatPence(pence)} again to check, or reload the page before changing the amount.`;

/**
 * `refunded_pence` is advisory and lags the webhook. Pence this page has sent that the order row does
 * not show yet: counted only while the row still shows the figure it had when the refund was sent.
 */
export type PendingRefund = { base: number; pence: number };
export const withPendingRefund = <T extends { refundedPence: number }>(o: T, p: PendingRefund | undefined): T =>
  p && p.base === o.refundedPence ? { ...o, refundedPence: o.refundedPence + p.pence } : o;

export const ORDER_TAG: Record<string, { label: string; tone: StatusTone }> = {
  paid: { label: 'Paid', tone: 'live' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'party' },
};
export const orderTag = (status: string) => ORDER_TAG[status] ?? { label: status, tone: 'neutral' as StatusTone };

// ---- Server refusals -----------------------------------------------------------------

const REASON: Record<string, string> = {
  not_authorised: NOT_MANAGER,
  // ticket-refund for anyone but the owner (Part B, PQ1): the refund is the owner's.
  not_allowed: NOT_OWNER_REFUND,
  not_found: 'This ticket is not there any more. Reload the page.',
  invalid_payload: 'Something in the form is not right. Check it and try again.',
  invalid_name: 'Give the ticket a name under 200 characters.',
  invalid_course_dates: 'Check the course dates: it needs a start day, and it cannot end before it starts.',
  invalid_kind: 'This kind of ticket is not available. Pick Each night or A course.',
  invalid_price: 'Enter a price from 0 to 10,000 pounds.',
  invalid_capacity: 'Enter how many tickets, from 1 to 100,000.',
  invalid_sales_window: 'Sales must close after they open.',
  series_not_live_or_not_organisers: 'Tickets can only be added to a live event of this page.',
  series_not_live: 'Put the event live before selling tickets.',
  occurrence_not_in_series: 'That date is not part of this event.',
  immutable_field: 'This ticket belongs to another event.',
  closed: 'Sales are closed for this ticket, so it cannot be changed.',
  has_orders: PRICE_LOCKED_TEXT,
  capacity_below_reserved: 'More tickets are already taken than that number.',
  bad_transition: 'That change is not possible from the ticket\u2019s current state. Reload the page.',
  at_capacity: 'Every ticket is taken. Raise the number of tickets first.',
  organiser_not_onboarded: PAYMENTS_WHERE,
  // ticket-refund (partial refunds). Each says what the person can do on the Refund sheet or the page.
  invalid_amount: 'That amount cannot be refunded. Enter an amount up to what is left on the order.',
  request_id_required: 'That refund did not start. Tap Refund again.',
  request_id_reused: 'That refund was already sent with a different amount. Reload the page to see the order before refunding again.',
  not_refundable: 'This order cannot be refunded any more. Reload the page to see its latest state.',
  refund_exceeds_balance: 'An earlier refund on this order may still be settling. Wait a minute, then try again.',
};

export const reasonMessage = (reason: string | null | undefined): string =>
  (reason && REASON[reason]) || 'That did not work. Try again in a moment.';
/**
 * A ticket-refund reply (review 1520-r1 F7). Refunds are the owner's alone (PQ1), so a `not_authorised`
 * here (e.g. an owner whose seat went mid-session) says to ask the owner, never "owner or manager".
 */
export const refundReasonMessage = (reason: string | null | undefined): string =>
  reason === 'not_authorised' ? NOT_OWNER_REFUND : reasonMessage(reason);

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
  /** "\u00A310.00 ticket + 50p booking fee" while there is a fee, "The ticket price, nothing added" at 0, or "Free". */
  line: string;
}
export const buyerTotal = (pricePence: number): BuyerTotal =>
  pricePence > 0
    ? {
        free: false,
        ticketPence: pricePence,
        feePence: BOOKING_FEE_PENCE,
        totalPence: pricePence + BOOKING_FEE_PENCE,
        line:
          BOOKING_FEE_PENCE > 0
            ? `${formatPence(pricePence)} ticket + ${feeLabel(BOOKING_FEE_PENCE)} booking fee`
            : 'The ticket price, nothing added',
      }
    : { free: true, ticketPence: 0, feePence: 0, totalPence: 0, line: BOOKING_FEE_PENCE > 0 ? 'Free, no fee' : 'Free' };

/** The event's rules line after the date, on every organiser tickets screen. The fee clause only while there is a fee. */
export const buyerRulesLine = (): string =>
  BOOKING_FEE_PENCE > 0
    ? `Buyers pay a ${feeLabel(BOOKING_FEE_PENCE)} booking fee per paid ticket, up to ${MAX_PER_ORDER} tickets an order.`
    : `Buyers pay the ticket price, up to ${MAX_PER_ORDER} tickets an order.`;

/** One price box in the editor: empty or 0 is a free ticket, anything else is paid (and validated as a price). */
export const paidOf = (priceText: string): boolean => priceText.trim() !== '' && penceOf(priceText) !== 0;
/** The form's price in pence, or null while the typed text is not a price yet. */
export const formPence = (f: Pick<TypeForm, 'paid' | 'price'>): number | null => (f.paid ? penceOf(f.price) : 0);

/** Places still free: capacity less every held ticket (paid and waiting for payment). */
export const leftOf = (t: { capacity: number; reserved: number }): number => Math.max(0, t.capacity - t.reserved);
/** "12 sold \u00B7 8 left"; without the sales summary only the places left (never a made-up 0 sold). */
export const countsLine = (sold: number | null, left: number): string => (sold === null ? `${formatCount(left)} left` : `${formatCount(sold)} sold ${DOT} ${formatCount(left)} left`);

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
/**
 * "8 left of 20" over the places people can buy (on sale, or sold out); null when there are
 * none, so the chip alone speaks. A draft or a paused ticket's places are not "left".
 */
export const eventLeftLine = (types: readonly Pick<TypeSales, 'status' | 'capacity' | 'reserved'>[]): string | null => {
  const open = types.filter((t) => t.status === 'on_sale' || t.status === 'sold_out');
  if (open.length === 0) return null;
  const cap = open.reduce((n, t) => n + t.capacity, 0);
  const left = open.reduce((n, t) => n + leftOf(t), 0);
  return `${formatCount(left)} left of ${formatCount(cap)}`;
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
  | { kind: 'connect'; stripe: 'none' | 'started' | 'waiting'; seriesId: string; seriesName: string }
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

/**
 * The one link under the number cards that still reaches Stripe once the Next step card is
 * about something else (every ticket free, so payments count as done). null when payments
 * are connected, when the card already carries Connect, or for a role that cannot act.
 */
export const paymentsLink = (
  role: MemberRole | null | undefined,
  stripe: StripeState,
  step: NextStep | null,
): { lead: string | null; action: string } | null => {
  if (!canManage(role) || stripe === 'connected' || step?.kind === 'connect') return null;
  if (stripe === 'none') return { lead: 'Payments not connected.', action: 'Connect' };
  return stripe === 'waiting' ? { lead: STRIPE_COPY.waiting.title(''), action: CHECK_AGAIN_LABEL } : { lead: null, action: 'Finish connecting' };
};

// ---- Orders ----------------------------------------------------------------------

const dayKeyBefore = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
/** "today", "yesterday" or "6 November" (the area's full month names, dateWords.ts) for a paid_at instant, in London; '' when unknown. */
export const dayWord = (iso: string | null, todayKey: string): string => {
  const stamp = iso ? instantToLondonWallClockStamp(iso) : null;
  if (!stamp) return '';
  const key = stamp.slice(0, 10);
  if (key === todayKey) return 'today';
  if (key === dayKeyBefore(todayKey)) return 'yesterday';
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]}`;
};
/** "2 \u00D7 \u00A310.50 \u00B7 today": tickets, what each cost the buyer (fee in), and when. */
export const orderLine = (o: Pick<Order, 'quantity' | 'totalPence' | 'paidAt'>, todayKey: string): string => {
  const each = o.quantity > 0 ? Math.round(o.totalPence / o.quantity) : o.totalPence;
  const price = each === 0 ? 'Free' : formatPence(each);
  const day = dayWord(o.paidAt, todayKey);
  return `${o.quantity} ${TIMES} ${price}${day ? ` ${DOT} ${day}` : ''}`;
};

/** A manager's order line (counts only, no money): "2 tickets \u00B7 today". */
export const orderCountLine = (o: Pick<Order, 'quantity' | 'paidAt'>, todayKey: string): string => {
  const day = dayWord(o.paidAt, todayKey);
  return `${o.quantity} ${o.quantity === 1 ? 'ticket' : 'tickets'}${day ? ` ${DOT} ${day}` : ''}`;
};
/** The one order-line mapping for every role: money for the owner, counts for anyone else. */
export const orderLineFor = (
  role: MemberRole | null | undefined,
  o: Pick<Order, 'quantity' | 'totalPence' | 'paidAt'>,
  todayKey: string,
): string => (seesMoney(role) ? orderLine(o, todayKey) : orderCountLine(o, todayKey));

// ---- Editor steps and review -------------------------------------------------------

export const EDITOR_STEPS = 3;
/** The fields each step owns; Continue checks only these. */
export const STEP_FIELDS: Record<1 | 2, readonly (keyof TypeForm)[]> = {
  1: ['name', 'price', 'validFrom', 'validTo'],
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
  return `${d} ${MONTH_NAMES[m - 1]}, ${time}`;
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
    { key: 'places', label: 'Places', value: formatCount(Number(f.capacity)) },
    { key: 'opens', label: 'On sale', value: opensWords(f.opensAt) },
    { key: 'closes', label: 'Closes', value: closesWords(f.closesAt, eventStart) },
    { key: 'buyer', label: 'Buyer pays', value: total.free ? total.line : formatPence(total.totalPence) },
  ];
};
