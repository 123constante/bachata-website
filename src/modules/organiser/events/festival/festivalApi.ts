// Festival artists (ER-C10). Server pinned in ER-INTERFACE section 5 (AS BUILT):
// series_festival_artists_set_v1(p_series_id, p_artists) replaces the list;
// series_festival_artists_get_v1(p_series_id) returns [{person_id, role, name}].
// SERVER NOT LANDED on prod: callers inject these (tests fake them).

import { supabase } from '@/integrations/supabase/client';
import type { Artist, ArtistRole } from './festivalModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const rpc = () => supabase as unknown as UntypedRpc;

const ROLES: ArtistRole[] = ['teacher', 'dj', 'performer'];

export function parseArtists(data: unknown): Artist[] {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { artists?: unknown }).artists) ? (data as { artists: unknown[] }).artists : [];
  return list.flatMap((r): Artist[] => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const role = ROLES.find((x) => x === o.role);
    return typeof o.person_id === 'string' && role ? [{ personId: o.person_id, role, name: typeof o.name === 'string' && o.name.trim() ? o.name : 'Unnamed' }] : [];
  });
}

export const artistsArgs = (seriesId: string, artists: readonly Artist[]) => ({
  p_series_id: seriesId,
  p_artists: artists.map((a) => ({ person_id: a.personId, role: a.role })),
});

export async function fetchFestivalArtists(seriesId: string): Promise<Artist[]> {
  const { data, error } = await rpc().rpc('series_festival_artists_get_v1', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return parseArtists(data);
}

export async function saveFestivalArtists(seriesId: string, artists: readonly Artist[]): Promise<void> {
  const { error } = await rpc().rpc('series_festival_artists_set_v1', artistsArgs(seriesId, artists));
  if (error) throw new Error(error.message);
}

/** What the screens call; tests pass their own. */
export interface FestivalDeps {
  /** Sends one owner command (series.upsert / series.set_program); resolves when stored. */
  send: (command: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
  saveArtists: (artists: readonly Artist[]) => Promise<void>;
  search: (term: string, role: 'teaching' | 'djing') => Promise<{ id: string; name: string }[]>;
}
