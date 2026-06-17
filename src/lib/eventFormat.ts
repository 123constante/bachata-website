/**
 * Format/category split (Phase 8) — shared event-shape predicates.
 *
 * An event's structural SHAPE lives in `format` (one_off | recurring | course |
 * festival) and drives LAYOUT; `category` is the discovery genre and never drives
 * layout. The legacy `type` column is now a GENERATED proxy (= 'festival' iff
 * format = 'festival'), kept only for null-format legacy rows and consumers whose
 * RPC has not yet gained the `format` axis.
 *
 * This module is the SINGLE home for the format-primary festival decision so the
 * null-format fallback policy is defined in exactly one place (it changes once,
 * when the legacy `type` proxy is finally dropped post-soak).
 */

/** Minimal structural shape both MapEvent and CalendarEvent satisfy. */
export interface EventFormatFields {
  type?: string | null;
  format?: string | null;
}

/**
 * Festival check, format-primary. Reads `format === 'festival'` when the new axis
 * is present; falls back to the legacy `type` proxy for null/absent-format rows.
 * Both agree post-Phase-9b (type is GENERATED from format), so the fallback only
 * matters for legacy-only series that never got a format backfill.
 *
 * NB: the event page (`useEventPage.ts`) layers a richer content-sniff
 * (multi-day schedule / has-passes) on top of `format === 'festival'` instead of
 * this `type` fallback, because a null-format legacy festival must not misroute to
 * "Festival not found". Map/calendar surfaces use this simpler predicate.
 */
export function isFestivalByFormat(e: EventFormatFields): boolean {
  if (e.format != null) return e.format === 'festival';
  return e.type === 'festival';
}
