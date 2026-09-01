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

/** Trim `text`, then clip to `max` characters with a trailing ellipsis if it
 *  overflows. Returns '' for null/undefined/blank input. */
export function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const trimmed = String(text).trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1).trimEnd() + ELLIPSIS;
}
