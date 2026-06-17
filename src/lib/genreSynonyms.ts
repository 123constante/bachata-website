/**
 * Genre (category) synonyms + display labels — single source of truth.
 *
 * The platform never says "Social" — that older genre word folds to "Party"
 * (see the admin no-social-word rule). `category` is now stored as one of
 * party | class | workshop | masterclass; `social` was dropped from the enum,
 * but legacy rows and user input can still carry it, so we normalize on the way
 * IN (filter tokens) and relabel on the way OUT (display).
 */

/** Canonical genre (category) tokens, in display order. */
export const GENRE_TOKENS = ['party', 'class', 'workshop', 'masterclass'] as const;
export type GenreToken = (typeof GENRE_TOKENS)[number];

/** Synonyms folded to a canonical genre token (lowercased keys). */
const GENRE_SYNONYMS: Record<string, GenreToken> = {
  social: 'party', // "Social" is never shown — it means "Party"
  socials: 'party',
};

/**
 * Fold a raw genre token/word to its canonical form. Unknown tokens pass through
 * lowercased & trimmed (so a real category like 'class' is unchanged). Use this
 * whenever a genre filter is built from user input, a URL param, or a legacy value.
 */
export function normalizeGenreToken(raw: string): string {
  const t = raw.trim().toLowerCase();
  return GENRE_SYNONYMS[t] ?? t;
}

/** Human label for a genre token. Always renders 'social' as 'Party'. */
export function genreLabel(raw: string): string {
  const t = normalizeGenreToken(raw);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
