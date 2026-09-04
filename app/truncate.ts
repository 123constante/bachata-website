// Dependency-free leaf module (mirrors app/cacheTags.ts, app/edgeCacheControl.ts):
// zero imports, by design. middleware.ts (Edge runtime) imports this file
// directly -- see app/edgeCacheControl.ts's own header for why an Edge Function
// bundle can only resolve import-free modules. app/lib/ogCardRender.ts and
// app/routes/organiser.tsx (both Node runtime) could afford heavier imports but
// share this definition anyway: truncate() had been hand-copied into all three,
// byte-identical in two and a third variant in the one that could safely
// diverge -- with a raw pasted ellipsis character where the other two used a
// numeric escape, exactly the mojibake risk CLAUDE.md's HTML-entities-over-raw-
// Unicode rule exists to prevent. A fourth copy is exactly how the next one
// would drift.

// Ellipsis, U+2026, spelled by code point rather than pasted -- see this
// file's own header.
const ELLIPSIS = String.fromCharCode(8230);

/**
 * The clip length for anything that lands in a document head description --
 * `meta[name=description]`, `og:description`, `twitter:description`.
 *
 * 160 because app/routes/organiser.tsx already truncated its bio at 160 and was
 * the only truncation in the repo, because Google renders roughly 155-160
 * characters of a snippet anyway, and because one number across all three tags
 * is easier to hold than three. Named rather than spelled three times for the
 * reason this module exists at all: the last drift here was a hand-copied
 * definition, and a hand-copied CONSTANT drifts exactly the same way.
 *
 * Sized against the longest string the app itself generates: the ended-run
 * sentence (src/modules/event-page/endedShareDescription.ts) tops out at 142
 * characters -- noun "masterclass" plus a two-full-date range -- so the clip
 * cannot mangle it. What it is for is STORED copy, which is written to sell a
 * run and has been measured at 5,536 characters on one live event.
 */
export const HEAD_DESCRIPTION_MAX = 160;

/** Trim `text`, then clip to `max` characters with a trailing ellipsis if it
 *  overflows. Returns '' for null/undefined/blank input. */
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const trimmed = String(text).trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1).trimEnd() + ELLIPSIS;
}
