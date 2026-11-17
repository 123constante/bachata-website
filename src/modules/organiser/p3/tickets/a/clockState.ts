/**
 * Tickets screen option A: which of the three faces the chosen night shows.
 * before = more than DOOR_OPENS_BEFORE_MS ahead of the start, door = from then until DOOR_CLOSES_AFTER_MS
 * after the start, after = later, or no coming night at all.
 */
export type TicketsClock = 'before' | 'door' | 'after';

export const DOOR_OPENS_BEFORE_MS = 3 * 60 * 60 * 1000;
export const DOOR_CLOSES_AFTER_MS = 8 * 60 * 60 * 1000;

export function ticketsClock(startIso: string | null | undefined, now: number): TicketsClock {
  const start = startIso ? Date.parse(startIso) : NaN;
  if (!Number.isFinite(start)) return 'after';
  if (now < start - DOOR_OPENS_BEFORE_MS) return 'before';
  if (now <= start + DOOR_CLOSES_AFTER_MS) return 'door';
  return 'after';
}

/** Plain words for the big number's caption. */
export const CLOCK_CAPTION: Record<TicketsClock, string> = {
  before: 'tickets sold',
  door: 'people came',
  after: 'people came',
};

/** The exit link under the flag: new wording, the public site root. */
export const EXIT_WORD = 'Back to bachatacalendar.co.uk';
export const EXIT_TO = '/';
