/**
 * Where a city map opens when the city has no pins yet. `cities` has no
 * lat/lng columns (checked on prod 2026-10-26), so this is a per-city table;
 * a slug not in it falls back to London, the map's old hard-coded default.
 */
type LatLng = [number, number];

const CENTRES: Record<string, LatLng> = {
  'london-gb': [51.5085, -0.128],
  'bristol-gb': [51.4545, -2.5879],
};

// The teaser's drag limit around London, as it always was (HomeMapCard).
const GREATER_LONDON: [LatLng, LatLng] = [
  [51.25, -0.55],
  [51.72, 0.34],
];

export function cityCentre(slug: string | null | undefined): LatLng {
  return CENTRES[(slug ?? '').toLowerCase()] ?? CENTRES['london-gb'];
}

/** The teaser's drag limit: Greater London, else a box about 50 km wide round the centre. */
export function cityBounds(slug: string | null | undefined): [LatLng, LatLng] {
  const s = (slug ?? '').toLowerCase();
  if (!CENTRES[s] || s === 'london-gb') return GREATER_LONDON;
  const [lat, lng] = CENTRES[s];
  return [
    [lat - 0.22, lng - 0.45],
    [lat + 0.22, lng + 0.45],
  ];
}
