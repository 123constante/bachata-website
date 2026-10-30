import {
  EVENT_SALE,
  NOT_MANAGER,
  SHOWN_ORDER,
  STRIPE_COPY,
  canManage,
  eventLeftLine,
  eventSaleOf,
  formOf,
  formatCount,
  isoToLondonInput,
  type MemberRole,
  type MoveContext,
  type Order,
  type StripeState,
  type TicketStatus,
  type TicketType,
  type TypeForm,
  type TypeSales,
} from '../../tickets/ticketModel';
import type { StatusTone } from '../../ui/StatusTag';
import { fullDate } from '../../shared/dateWords';

/**
 * P3 ticketing (W-T, mockup C "one tall sheet"): what the P3 screens add ON TOP of
 * tickets/ticketModel.ts, which stays the one reading of every ticketing fact (reused
 * unchanged with its matrix tests). Pure. Design record: docs/design/p3-wt-ticketing.md.
 */

// ---- Copy the owner approved for P3 (2026-10-27) -----------------------------------

/** The Home prompt's title: Home has no one event to name (the shipped title names one). */
export const PROMPT_TITLE: Record<'none' | 'started', string> = {
  none: 'Get paid for tickets',
  started: STRIPE_COPY.started.title(''),
};
export const PROMPT_BODY: Record<'none' | 'started', string> = {
  none: `Connect Stripe so you can sell paid tickets. ${STRIPE_COPY.none.body} Free tickets work without it.`,
  started: STRIPE_COPY.started.body,
};

// ---- Tones: the ONE map from ticketModel's tones to P3 tag classes -----------------

export const TONE_CLASS: Record<StatusTone, string> = {
  live: 'p3-tag p3-tag-live',
  draft: 'p3-tag p3-tag-draft',
  party: 'p3-tag p3-tag-warn',
  neutral: 'p3-tag p3-tag-hidden',
};

// ---- The event page's Tickets row --------------------------------------------------

export interface TicketsRowView {
  chip: { label: string; tone: StatusTone };
  /** The second half of the row, for example "34 sold, 26 left of 70" or "Paused, 14 sold" (dot-separated), or "Add a ticket". */
  detail: string;
}

/** Why "Add a ticket" is greyed, or null (the shipped addBlock rule). */
export const addWhy = (role: MemberRole | null | undefined, seriesLive: boolean): string | null =>
  !canManage(role) ? NOT_MANAGER : !seriesLive ? 'Put this event live before adding tickets.' : null;

/**
 * types: the event's ticket types; sold: tickets sold per type id from the sales summary,
 * or null when the summary is not known (never a made-up 0 sold).
 */
export const ticketsRowOf = (
  types: readonly Pick<TicketType, 'id' | 'status' | 'capacity' | 'reserved'>[],
  sold: ReadonlyMap<string, number> | null,
  why: string | null,
): TicketsRowView => {
  const sale = eventSaleOf(types);
  const chip = EVENT_SALE[sale];
  const soldN = sold ? types.reduce((n, t) => n + (sold.get(t.id) ?? 0), 0) : null;
  const soldWord = soldN === null ? null : `${formatCount(soldN)} sold`;
  if (sale === 'none') {
    // Sales on closed tickets are a fact for every role; then what the person can do.
    const next = why === NOT_MANAGER ? null : why ?? 'Add a ticket';
    const parts = [soldN ? soldWord : null, next].filter(Boolean);
    return { chip, detail: parts.length ? parts.join(' \u00B7 ') : 'None yet' };
  }
  if (sale === 'not_selling') {
    const word = types.some((t) => t.status === 'paused') ? 'Paused' : 'Not on sale yet';
    return { chip, detail: [word, soldWord].filter(Boolean).join(' \u00B7 ') };
  }
  return { chip, detail: [soldWord, eventLeftLine(types)].filter(Boolean).join(' \u00B7 ') };
};

// ---- Orders: the latest two in the sheet, every one behind See all ------------------

export const PREVIEW_ORDERS = 2;
/** Paid, refunded and disputed orders, newest first (pending / expired rows never show). */
export const shownOrders = (orders: readonly Order[]): Order[] =>
  orders.filter((o) => SHOWN_ORDER.includes(o.status)).slice().sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
export const seeAllLabel = (n: number): string | null => (n > PREVIEW_ORDERS ? `See all ${formatCount(n)} orders` : null);
/** The orders card's empty words: what the person can do next. */
export const noOrdersText = (types: readonly Pick<TicketType, 'status'>[], manager: boolean): string =>
  types.some((t) => t.status === 'on_sale')
    ? 'No orders yet. They show here, by buyer name, the moment someone buys.'
    : manager
      ? 'No orders yet. Switch a ticket to Selling above so people can buy.'
      : 'No orders yet. An owner or manager can put a ticket on sale.';

// ---- Home's Get paid prompt and You's Get paid row ----------------------------------

/**
 * The prompt shows only to an owner / manager, only while the page has a live event
 * and payments are not connected (and never while the account read is unknown).
 */
export const showPrompt = (role: MemberRole | null | undefined, hasLive: boolean, stripe: StripeState | null): stripe is 'none' | 'started' =>
  canManage(role) && hasLive && (stripe === 'none' || stripe === 'started');

/** The right side of You's Get paid row: the Stripe state's own tag. */
export const getPaidRowTag = (stripe: StripeState | null): { label: string; tone: StatusTone } | null =>
  stripe ? { label: STRIPE_COPY[stripe].tag, tone: STRIPE_COPY[stripe].tone } : null;

// ---- The add / edit draft, held by the parent (defect fix: survives a re-render) ----

export type Step = 1 | 2 | 3;
export type OpenMode = 'now' | 'pick';
export type CloseMode = 'event' | 'never' | 'pick';

export interface TypeDraft {
  /** 'new', or the ticket type's id: a draft for another sheet is never reused. */
  key: string;
  form: TypeForm;
  step: Step;
  openMode: OpenMode;
  closeMode: CloseMode;
}

export const draftKey = (type: Pick<TicketType, 'id'> | null): string => (type ? type.id : 'new');

export const newDraft = (type: TicketType | null, eventStart: string | null): TypeDraft => {
  const f = formOf(type);
  const form = type || !eventStart ? f : { ...f, closesAt: isoToLondonInput(eventStart) };
  return {
    key: draftKey(type),
    form,
    step: 1,
    openMode: form.opensAt ? 'pick' : 'now',
    closeMode: !form.closesAt ? 'never' : eventStart && form.closesAt === isoToLondonInput(eventStart) ? 'event' : 'pick',
  };
};

/** Keep the held draft when it is for the same sheet; start a fresh one otherwise. */
export const draftFor = (held: TypeDraft | null, type: TicketType | null, eventStart: string | null): TypeDraft =>
  held && held.key === draftKey(type) ? held : newDraft(type, eventStart);

// ---- Facts the shipped event screen computes inline (SeriesTickets.tsx, to be deleted) --

/** The server freezes the price once ANY order row exists (pending and expired included). */
export const hasOrdersOf = (t: TicketType | null, sales: ReadonlyMap<string, TypeSales>, orders: readonly Order[]): boolean => {
  if (!t) return false;
  const s = sales.get(t.id);
  const counted = s ? s.ordersPaid + s.ordersPending + s.ordersRefunded + s.ordersDisputed > 0 : false;
  return counted || t.reserved > 0 || orders.some((o) => o.typeId === t.id);
};

/** "Sunday 1 November", or "Next: Sunday 1 November" for a series, or a plain word when no date is known. */
export const eventDateLine = (s: { next_dates?: readonly { occurrence_date: string }[]; upcoming_count?: number }): string => {
  const first = s.next_dates?.[0]?.occurrence_date;
  if (!first) return 'No upcoming dates';
  return (s.upcoming_count ?? 1) > 1 ? `Next: ${fullDate(first)}` : fullDate(first);
};

export type { MoveContext, TicketStatus, TypeSales };
