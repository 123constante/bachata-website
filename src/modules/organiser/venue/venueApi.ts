import { supabase } from '@/integrations/supabase/client';
import { isServerRefusal } from '../shared/selfServeErrors';
import { placeLine, type PostcodeFound } from './postcode';

/**
 * Client for the pinned venue RPCs (ER-INTERFACE section 3). Built to the pinned names; the
 * server has not landed, so a missing function reads as `unavailable` and the screen says so.
 */
export interface SimilarVenue {
  venueId: string;
  name: string;
  postcode: string | null;
}
export interface CreatedVenue {
  venueId: string;
  /** True when an exact name + postcode match already existed: that venue is picked, nothing was created. */
  existing: boolean;
}

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
const defaultRpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);

/**
 * Why a venue call failed, in words the screen can use. `refused` = the server said no
 * (P0001 `permission_denied: ...` / `invalid_payload: ...`); `failed` = no answer (network).
 */
export class VenueApiError extends Error {
  constructor(readonly kind: 'rate_limited' | 'unavailable' | 'refused' | 'failed') {
    super(kind);
  }
}

/** AS BUILT (ER-AD1): the 5-a-day limit raises code 54000 with the message `rate_limited`. */
const RATE_LIMITED = /^rate_limited\b/;

function toError(e: { code?: string; message?: string }): VenueApiError {
  const message = e.message ?? '';
  if (RATE_LIMITED.test(message)) return new VenueApiError('rate_limited');
  if (e.code === 'PGRST202' || /could not find the function/i.test(message)) return new VenueApiError('unavailable');
  if (isServerRefusal(e)) return new VenueApiError('refused');
  return new VenueApiError('failed');
}

export async function similarVenues(name: string, postcode: string, rpc: Rpc = defaultRpc): Promise<SimilarVenue[]> {
  const { data, error } = await rpc('owner_similar_venues_v1', { p_name: name.trim(), p_postcode: postcode });
  if (error) throw toError(error);
  const rows = (data as { venues?: unknown } | null)?.venues;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r: Record<string, unknown>) =>
    typeof r?.venue_id === 'string' && typeof r.name === 'string'
      ? [{ venueId: r.venue_id, name: r.name, postcode: typeof r.postcode === 'string' ? r.postcode : null }]
      : [],
  );
}

export async function createVenueDraft(name: string, place: PostcodeFound, rpc: Rpc = defaultRpc): Promise<CreatedVenue> {
  const { data, error } = await rpc('owner_create_venue_draft_v1', {
    p_name: name.trim(),
    p_postcode: place.postcode,
    p_lat: place.lat,
    p_lng: place.lng,
    p_address: placeLine(place),
    p_area: place.area,
  });
  if (error) throw toError(error);
  const row = (data ?? {}) as Record<string, unknown>;
  if (typeof row.venue_id !== 'string') throw new VenueApiError('failed');
  return { venueId: row.venue_id, existing: row.existing === true };
}

/** A draft venue as a picker option, so it can be chosen on the event at once. */
export function draftVenueOption(venueId: string, name: string, place: PostcodeFound) {
  return { id: venueId, name: name.trim(), neighbourhood: place.area || null, city_name: null, address: placeLine(place) || null, postcode: place.postcode };
}
