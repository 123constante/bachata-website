/**
 * UK postcode lookup through postcodes.io (no key). A failure is one of three named kinds so
 * the screen can say what to do: `bad` (not shaped like a postcode), `not_found` (shaped
 * right, no such postcode) or `offline` (the call failed; retry).
 */
export interface PostcodeFound {
  postcode: string;
  lat: number;
  lng: number;
  address: string;
  area: string;
}

export type PostcodeFailure = 'bad' | 'not_found' | 'offline';
export type PostcodeResult = { ok: true; found: PostcodeFound } | { ok: false; failure: PostcodeFailure };

const SHAPE = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/;

/** Upper-case, single inner space before the last three characters; null when not postcode-shaped. */
export function normalisePostcode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  if (!SHAPE.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export const POSTCODE_MESSAGES: Record<PostcodeFailure, string> = {
  bad: 'That does not look like a UK postcode. Check it and try again.',
  not_found: 'We could not find that postcode. Check it and try again.',
  offline: 'We could not look that up. Check your connection and try again.',
};

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export async function lookupPostcode(raw: string, fetchImpl: FetchLike = (u) => fetch(u)): Promise<PostcodeResult> {
  const postcode = normalisePostcode(raw);
  if (!postcode) return { ok: false, failure: 'bad' };
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  } catch {
    return { ok: false, failure: 'offline' };
  }
  if (res.status === 404) return { ok: false, failure: 'not_found' };
  if (!res.ok) return { ok: false, failure: 'offline' };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, failure: 'offline' };
  }
  const r = ((body as { result?: Record<string, unknown> } | null)?.result ?? null) as Record<string, unknown> | null;
  const lat = r?.latitude;
  const lng = r?.longitude;
  if (!r || typeof lat !== 'number' || typeof lng !== 'number') return { ok: false, failure: 'not_found' };
  const area = str(r.admin_ward) || str(r.parish) || str(r.admin_district);
  const found = str(r.postcode) || postcode;
  return { ok: true, found: { postcode: found, lat, lng, address: placeLine({ area, postcode: found }), area } };
}

/**
 * The place line the Add-a-venue sheet shows ('Area, POSTCODE'), and the address a new
 * draft venue stores: owner click F-C5-5, the stored address is exactly what the person saw.
 */
export const placeLine = (place: { area: string; postcode: string }): string => [place.area, place.postcode].filter(Boolean).join(', ');

/** OpenStreetMap embed for the map pin; no key. */
export function mapPinUrl(lat: number, lng: number): string {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
}
