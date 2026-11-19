import { formatPence } from '@/modules/tickets/ticketCheckoutModel';
import type { R4Tile } from './r4Model';

/**
 * Money per night (flag organiserR4): ticket_sales_by_night_v1(series, occurrence?). Each night and the
 * no_night pool carry gross (paid orders, net of discount, WITHOUT booking fee), booking fees (reported
 * apart, not the organiser's money), refunded (pro-rata on paid orders) and net = gross - refunded.
 * A basket spanning two nights counts once on each night: order counts are never summed across nights.
 */
export interface R4Money {
  grossPence: number;
  feesPence: number;
  refundedPence: number;
  netPence: number;
  ordersPaid: number;
  ordersRefunded: number;
  ordersDisputed: number;
  ticketsSold: number;
}
export interface R4NightMoney extends R4Money { occurrenceId: string; date: string }

/** ok = a money read; none = this seat has no money view (not a money role, no ticket types, wrong night). */
export type R4MoneyRead =
  | { kind: 'ok'; nights: R4NightMoney[]; truncated: boolean; noNight: R4Money | null }
  | { kind: 'none' };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);

function moneyOf(o: Record<string, unknown>): R4Money {
  return {
    grossPence: num(o.gross_pence), feesPence: num(o.booking_fees_pence), refundedPence: num(o.refunded_pence), netPence: num(o.net_pence),
    ordersPaid: num(o.orders_paid), ordersRefunded: num(o.orders_refunded), ordersDisputed: num(o.orders_disputed), ticketsSold: num(o.tickets_sold),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Parse the RPC answer. A shape we do not know throws (the screen shows the read error), never a zero claim. */
export function parseNightMoney(raw: unknown): R4MoneyRead {
  if (!isObj(raw)) throw new Error('Money read: unexpected answer');
  if (raw.ok !== true) {
    if (raw.reason === 'not_authorised' || raw.reason === 'wrong_night') return { kind: 'none' };
    throw new Error('Money read: refused');
  }
  if (!Array.isArray(raw.nights)) throw new Error('Money read: no nights');
  const nights: R4NightMoney[] = [];
  for (const n of raw.nights) {
    if (!isObj(n) || typeof n.occurrence_id !== 'string' || typeof n.occurrence_date !== 'string') continue;
    nights.push({ ...moneyOf(n), occurrenceId: n.occurrence_id, date: n.occurrence_date });
  }
  return { kind: 'ok', nights, truncated: raw.truncated === true, noNight: isObj(raw.no_night) ? moneyOf(raw.no_night) : null };
}

/** Pounds, with \u00a30 for nothing (formatPence says "Free", which is a price word, not takings). */
export const gbp = (pence: number): string => (pence === 0 ? '\u00a30' : formatPence(pence));

/** The night the screen is about: by occurrence id when known, else the first night on that date. */
export function nightMoneyOf(read: R4MoneyRead | undefined, at: { occurrenceId?: string | null; date?: string | null }): R4NightMoney | null {
  if (!read || read.kind !== 'ok') return null;
  if (at.occurrenceId) return read.nights.find((n) => n.occurrenceId === at.occurrenceId) ?? null;
  if (at.date) return read.nights.find((n) => n.date === at.date) ?? null;
  return null;
}

/** Nothing ever paid, refunded or disputed on this night: no money tile (never a zero claim). */
export const hasSales = (m: R4Money): boolean => m.ordersPaid > 0 || m.ordersRefunded > 0 || m.ordersDisputed > 0;

/** The ONE money tile: net as the main number. Null when the night has no sales. */
export function moneyTileOf(m: R4NightMoney | null): R4Tile | null {
  if (!m || !hasSales(m)) return null;
  return { key: 'money', label: 'Money in', value: gbp(m.netPence), of: null };
}

/** The quiet line under the number: refunds, disputes and booking fees, only those that happened. */
export function moneyQuietOf(m: R4Money | null): string | null {
  if (!m || !hasSales(m)) return null;
  const parts: string[] = [];
  if (m.refundedPence > 0) parts.push(`${gbp(m.refundedPence)} refunded`);
  if (m.ordersRefunded > 0) parts.push(`${m.ordersRefunded} ${m.ordersRefunded === 1 ? 'order' : 'orders'} refunded in full`);
  if (m.ordersDisputed > 0) parts.push(`${m.ordersDisputed} ${m.ordersDisputed === 1 ? 'order' : 'orders'} in dispute`);
  if (m.feesPence > 0) parts.push(`${gbp(m.feesPence)} booking fees kept apart`);
  return parts.length ? `${parts.join('. ')}.` : null;
}

export const R4_MONEY_COPY = {
  error: 'We couldn\u2019t load the money for this night. Nothing was changed.',
  retry: 'Try again',
} as const;
