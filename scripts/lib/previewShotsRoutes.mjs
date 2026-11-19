// Pure helpers for scripts/preview-shots.mjs: parse the `Preview routes:` line of
// a PR body into a safe list of same-origin paths. No I/O, so it is unit-tested.

export const MAX_EXTRA_ROUTES = 6;

/** A route is a same-origin path: starts with one `/`, no `//`, no scheme, no
 *  backslash, no whitespace or control characters, no `..` segment. */
export function isSafeRoute(r) {
  if (typeof r !== 'string' || r.length < 1 || r.length > 200) return false;
  if (r[0] !== '/') return false;
  if (r.includes('//') || r.includes('\\') || r.includes('://')) return false;
  if (/[\s\u0000-\u001f\u007f]/.test(r)) return false;
  if (/(^|\/)\.\.(\/|$|\?|#)/.test(r)) return false;
  return true;
}

/** Routes from the first line starting `Preview routes:` (case-insensitive).
 *  Comma or space separated; unsafe tokens are rejected (returned in `rejected`),
 *  duplicates dropped, at most MAX_EXTRA_ROUTES kept (the rest in `overflow`). */
export function parsePreviewRoutes(body) {
  const out = { routes: [], rejected: [], overflow: [] };
  if (typeof body !== 'string') return out;
  const line = body.split(/\r?\n/).find((l) => /^\s*Preview routes:/i.test(l));
  if (!line) return out;
  const tokens = line
    .replace(/^\s*Preview routes:/i, '')
    .split(/[,\s]+/)
    .map((t) => t.replace(/^`|`$/g, ''))
    .filter(Boolean);
  for (const t of tokens) {
    if (!isSafeRoute(t)) {
      out.rejected.push(t);
      continue;
    }
    if (out.routes.includes(t) || out.overflow.includes(t)) continue;
    if (out.routes.length >= MAX_EXTRA_ROUTES) out.overflow.push(t);
    else out.routes.push(t);
  }
  return out;
}

/** A filesystem-safe PNG name for a route. */
export function shotName(route) {
  const slug = route.replace(/^\//, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug || 'home'}.png`;
}

/** The soonest non-cancelled upcoming occurrence's event id from a
 *  get_calendar_events_v2 row list, or null. */
export function pickUpcomingEventId(rows, now = Date.now()) {
  let best = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || r.event_id == null) continue;
    if (r.is_cancelled === true || r.cancelled === true || String(r.status ?? '').toLowerCase() === 'cancelled') continue;
    const t = Date.parse(r.occurrence_starts_at);
    if (!Number.isFinite(t) || t < now) continue;
    if (!best || t < best.t) best = { t, id: String(r.event_id) };
  }
  return best ? best.id : null;
}
