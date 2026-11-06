// Pure model for the organiser page nights cards (Next nights card, Past nights
// highlights). No React, no WallClock: callers pass plain YYYY-MM-DD keys and strings.

export const PAST_STRIP_MAX = 6;
/** The chip sits on a 50%-wide flyer, so its text is capped at this many characters. */
export const CHIP_MAX_CHARS = 11;
/** A night this many days away or fewer gets the solid gold chip. */
export const CHIP_SOON_DAYS = 7;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Whole days from todayKey to dateKey (both YYYY-MM-DD), via Date.UTC so DST cannot shift it. */
export const daysBetweenKeys = (todayKey: string, dateKey: string): number => {
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const [ey, em, ed] = dateKey.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000);
};

export type CountdownChip = { text: string; soon: boolean };

/**
 * The page's own countdown wording (Tonight / Tomorrow / in N days / next week / in N weeks),
 * kept to 11 characters: 26+ weeks becomes "in N months" (N up to 9), beyond that "Feb 2027".
 * Returns null for a night with no date or one already past.
 */
export const countdownChip = (dateKey: string | null | undefined, todayKey: string): CountdownChip | null => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const diff = daysBetweenKeys(todayKey, dateKey);
  if (diff < 0) return null;
  const soon = diff <= CHIP_SOON_DAYS;
  if (diff === 0) return { text: 'Tonight', soon };
  if (diff === 1) return { text: 'Tomorrow', soon };
  if (diff < 7) return { text: `in ${diff} days`, soon };
  if (diff < 14) return { text: 'next week', soon };
  const weeks = Math.round(diff / 7);
  if (weeks < 26) return { text: `in ${weeks} weeks`, soon };
  const months = Math.max(6, Math.round(diff / 30.44));
  if (months <= 9) return { text: `in ${months} months`, soon };
  const month = MONTHS_SHORT[Number(dateKey.slice(5, 7)) - 1] ?? '';
  return { text: `${month} ${dateKey.slice(0, 4)}`, soon };
};

/** Venue name, else city, else no line at all (null) -- never "undefined", never an empty gap. */
export const venueLine = (location: string | null | undefined, city: string | null | undefined): string | null => {
  const v = location?.trim() || city?.trim() || '';
  return v || null;
};

/** Venue line plus the time. The time is for a single night only (callers pass null for a series). */
export const cardMetaLine = (venue: string | null, time: string | null): string | null => {
  const parts = [venue, time].filter(Boolean);
  return parts.length ? parts.join(' \u00b7 ') : null;
};

export const actionLabel = (kind: 'single' | 'series', dateCount: number): string =>
  kind === 'series' ? `See all ${dateCount} dates` : 'View event';

export type PastNight = { dateKey: string | null; cancelled?: boolean };

export type PastCounts = {
  /** Nights hosted (cancelled excluded). */
  total: number;
  /** Nights in the current London calendar year. */
  thisYear: number;
  /** How many tiles the strip shows: min(6, total). */
  stripCount: number;
  /** "See all N nights" only when some night is not already in the strip. */
  showSeeAll: boolean;
};

export const pastCounts = (nights: PastNight[], todayKey: string): PastCounts => {
  const live = nights.filter((n) => !n.cancelled);
  const year = todayKey.slice(0, 4);
  return {
    total: live.length,
    thisYear: live.filter((n) => n.dateKey?.slice(0, 4) === year).length,
    stripCount: Math.min(PAST_STRIP_MAX, live.length),
    showSeeAll: live.length > PAST_STRIP_MAX,
  };
};

/** One chip per year, in the order given (newest first), e.g. "2026 (12)". */
export const yearChips = (years: { year: string; count: number }[]): { year: string; label: string }[] =>
  years.map((y) => ({ year: y.year, label: `${y.year} (${y.count})` }));

/** Initials for the no-flyer fallback; falls back to the organiser's, then "?". */
export const fallbackInitials = (name: string | null | undefined, organiserName?: string | null): string => {
  for (const src of [name, organiserName]) {
    const parts = (src ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return '?';
};
