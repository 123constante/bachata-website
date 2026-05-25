import { supabase } from '@/integrations/supabase/client';
import { resolveEventImage } from '@/lib/utils';

// Federated public search backed by the search_public_v1 RPC (admin repo
// migration 20260713000000). Returns events, venues and organisers unified by
// `kind`; the overlay groups them. Links: event -> /event/:id,
// venue -> /venue-entity/:id, organiser -> /organisers/:id.

export type SearchKind = 'event' | 'venue' | 'organiser';

interface SearchRow {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  city_slug: string | null;
  event_type: string | null;
  start_time: string | null;
  match_rank: number;
}

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  eventType: string | null;
  startTime: string | null;
  href: string;
}

const hrefFor = (kind: SearchKind, id: string): string => {
  if (kind === 'venue') return `/venue-entity/${id}`;
  if (kind === 'organiser') return `/organisers/${id}`;
  return `/event/${id}`;
};

export async function searchPublic(query: string, limitPerKind = 6): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const { data, error } = await supabase.rpc('search_public_v2' as never, {
    p_query: term,
    p_limit: limitPerKind,
  });
  if (error) throw error;

  return ((data ?? []) as SearchRow[]).map((r) => ({
    kind: r.kind,
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    imageUrl: resolveEventImage(r.image_url, null),
    eventType: r.event_type,
    startTime: r.start_time,
    href: hrefFor(r.kind, r.id),
  }));
}
