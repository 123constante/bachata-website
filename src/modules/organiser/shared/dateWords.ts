// THE date words of the organiser area (INT-B S-1, orchestrator decision 4): full
// weekday and full month names everywhere ("Friday 23 October"), from ONE
// formatter, so a date never reads one way on Home and another on Team. Pure and
// London wall-clock: the input is a YYYY-MM-DD calendar key; an instant is turned
// into its London key (londonDateKey) by the caller first.

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Friday 23 October" for a calendar key. With `today` (a YYYY-MM-DD key), the
 * year is added when it is not today's year ("Friday 8 January 2027"), and an
 * unknown `today` ('') always shows it. Without `today`, never a year.
 */
export function fullDate(date: string, today?: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const year = today === undefined || String(y) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${WEEKDAY_NAMES[weekday]} ${d} ${MONTH_NAMES[m - 1]}${year}`;
}
