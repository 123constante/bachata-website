// Pure helpers ONLY the lazy TicketCard chunk uses. Kept out of ./model on purpose: a module shared with the
// dancer-app chunk lands in that chunk, and a lazy chunk that imports from it stops the chunk being the
// src/modules/dancer-app/dancer-app.tsx manifest entry (check:bundle-budget loses the /app/* row; see
// screens/home/homeGoing.tsx).

/** "Ticket k of N" for ALL N (no cap). */
export const ticketCountLine = (index: number, total: number): string => `Ticket ${index + 1} of ${total}`;

/** Wraps around both ways, so N tickets give N positions. */
export const stepTicket = (index: number, delta: number, total: number): number => (total <= 0 ? 0 : (index + delta + total) % total);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "YYYY-MM-DD" -> "Saturday 21 November 2026" (full weekday); any other text is shown as the server gave it. */
export function doorDate(date: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
