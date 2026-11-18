import type { P3Row } from '../data/home';
import { shortDay } from './r4EventsModel';

/**
 * Board R4EditNight: one form (Name, Date + Starts, Place, Ticket price, Repeats). Name and Place
 * save here through the Details save; Date, Starts, Price and Repeats are shown from real reads and
 * open the screen that changes them. A field with no read is not drawn.
 */
export interface R4EditModel {
  /** "Fri 20 Nov 2026" of the next night; null with no date coming up. */
  date: string | null;
  /** "21:00"; null when the next night has no time. */
  starts: string | null;
  /** The price list as dancers see it ("£12", "£12, £15"); null when the event has no prices (hidden). */
  price: { value: string; locked: string | null } | null;
  /** "Repeats every Friday" + On, or "Repeats" + Off for a one-off. */
  repeat: { words: string; on: boolean };
}

export interface R4EditInput {
  row: P3Row | null;
  /** repeatWords(...) for a repeating series, else null. */
  repeatWords: string | null;
  /** priceLabel of each price row, in order. */
  prices: readonly string[];
  /** pricesLock(ws): why the price list cannot change here, or null. */
  pricesLock: string | null;
}

export const EDIT_COPY = {
  noDate: 'No date yet',
  noTime: 'No time yet',
  datesWhy: 'Change the date or start time on All dates.',
  priceWhy: 'Change the price on Prices.',
  repeatOff: 'Repeats',
} as const;

export function r4EditOf(i: R4EditInput): R4EditModel {
  const next = i.row?.next && i.row.next.status !== 'cancelled' ? i.row.next : null;
  const words = i.repeatWords?.trim().replace(/\.$/, '') || null;
  return {
    date: next ? `${shortDay(next.date)} ${next.date.slice(0, 4)}` : null,
    starts: next ? i.row?.nextStart ?? null : null,
    price: i.prices.length ? { value: i.prices.join(', '), locked: i.pricesLock } : null,
    repeat: words ? { words: /^Every /.test(words) ? `Repeats ${words.replace(/^Every/, 'every')}` : words, on: true } : { words: EDIT_COPY.repeatOff, on: false },
  };
}
