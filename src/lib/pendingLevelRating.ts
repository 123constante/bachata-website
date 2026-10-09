import type { SeriesLevel } from '@/hooks/useSeriesLevelRating';

// A level a signed-out visitor tapped, kept across the sign-in round trip so the
// rating is sent exactly once when they come back (LevelRatingPrompt).
export const PENDING_LEVEL_RATING_KEY = 'pending_level_rating';

export type PendingLevelRating = { seriesId: string; level: SeriesLevel };

const LEVELS = ['mostly_beginners', 'mixed', 'strong'] as const satisfies readonly SeriesLevel[];

// A tap not followed through within an hour is forgotten, so an abandoned sign-in
// cannot send a rating weeks later.
export const PENDING_LEVEL_RATING_TTL_MS = 60 * 60 * 1000;

export const stashPendingLevelRating = (pending: PendingLevelRating) => {
  try {
    localStorage.setItem(PENDING_LEVEL_RATING_KEY, JSON.stringify({ ...pending, at: Date.now() }));
  } catch {
    /* storage blocked: the visitor just taps again after signing in */
  }
};

export const clearPendingLevelRating = () => {
  try {
    localStorage.removeItem(PENDING_LEVEL_RATING_KEY);
  } catch {
    /* nothing to clear */
  }
};

/**
 * Returns the stashed level for THIS series and removes it BEFORE returning, so
 * a second call (a re-render, StrictMode, a second tab) cannot send it again.
 * A value for another series, or a malformed one, is left alone / dropped.
 */
export const takePendingLevelRating = (seriesId: string): SeriesLevel | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_LEVEL_RATING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearPendingLevelRating();
    return null;
  }
  const p = parsed as (Partial<PendingLevelRating> & { at?: unknown }) | null;
  if (
    !p ||
    typeof p.seriesId !== 'string' ||
    typeof p.level !== 'string' ||
    !(LEVELS as readonly string[]).includes(p.level) ||
    typeof p.at !== 'number' ||
    Date.now() - p.at > PENDING_LEVEL_RATING_TTL_MS
  ) {
    clearPendingLevelRating();
    return null;
  }
  if (p.seriesId !== seriesId) return null;
  clearPendingLevelRating();
  return p.level as SeriesLevel;
};
