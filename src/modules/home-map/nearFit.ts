// Near me map fit: pure helpers (no Leaflet, no DOM) so the framing rules are testable.
import { distanceMiles, type MapEvent } from './mapTypes';

export type LatLng = { lat: number; lng: number };
/** [[south, west], [north, east]] -- the shape Leaflet's LatLngBoundsExpression accepts. */
export type Box = [[number, number], [number, number]];

export const NEAR_FIT_COUNT = 5;

/** The user pin's own venue-less framing: the N nearest DISTINCT places (by coordinate), nearest first.
 *  Rows without coordinates are skipped; fewer than N is fine (returns what exists). */
export function nearestVenues(events: MapEvent[], user: LatLng | null, n = NEAR_FIT_COUNT): LatLng[] {
  if (!user) return [];
  const best = new Map<string, { p: LatLng; d: number }>();
  for (const e of events) {
    const d = distanceMiles(e, user);
    if (d == null || e.lat == null || e.lng == null) continue;
    const k = `${e.lat},${e.lng}`;
    const cur = best.get(k);
    if (!cur || d < cur.d) best.set(k, { p: { lat: e.lat, lng: e.lng }, d });
  }
  return [...best.values()].sort((a, b) => a.d - b.d).slice(0, n).map((v) => v.p);
}

/** Tight box around the user plus the given venues. */
export function fitBox(user: LatLng, venues: LatLng[]): Box {
  const pts = [user, ...venues];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
}

/** Grow a box by `ratio` of its own span on every side (0.5 = 50 percent). A zero-span box
 *  (user alone, no venues) gets a minimum so the bounds are never a point. */
export function padBox(box: Box, ratio = 0.5, minSpanDeg = 0.02): Box {
  const [[s, w], [n, e]] = box;
  const dLat = Math.max(n - s, minSpanDeg) * ratio;
  const dLng = Math.max(e - w, minSpanDeg) * ratio;
  return [[s - dLat, w - dLng], [n + dLat, e + dLng]];
}
