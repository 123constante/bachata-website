import { supabase } from '@/integrations/supabase/client';
import { resolveEventImage } from '@/lib/utils';

export type SearchKind = 'event' | 'venue' | 'organiser' | 'teacher' | 'dj' | 'dancer';

// search_public_v2 row (events/venues/organisers by name)
interface SearchRow {
  kind: 'event' | 'venue' | 'organiser';
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
  subtitle: string | null;
  imageUrl: string | null;
  eventType: string | null;
  startTime: string | null;
  href: string;
}

const hrefFor = (kind: SearchKind, id: string): string => {
  if (kind === 'venue') return `/venue-entity/${id}`;
  if (kind === 'organiser') return `/organisers/${id}`;
  if (kind === 'teacher') return `/teachers/${id}`;
  if (kind === 'dj') return `/djs/${id}`;
  if (kind === 'dancer') return `/dancers/${id}`;
  return `/event/${id}`;
};

// search_public_v2 -- events / venues / organisers text-match by name.
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

// search_public_v3 -- all entity types: events, organisers, venues, teachers, djs, dancers.
// Used by: Cmd+K overlay (sectionLimit=3) and /search results page (sectionLimit=12).

interface V3EventRow {
  id: string;
  name: string;
  poster_url: string | null;
  city_slug: string | null;
  event_type: string | null;
  start_time: string | null;
}

interface V3OrganiserRow {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface V3VenueRow {
  id: string;
  name: string;
  photo_url: string[] | null;
  address: string | null;
}

interface V3PersonRow {
  id: string;
  first_name: string | null;
  surname: string | null;
  display_name: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  slug: string | null;
}

interface V3Payload {
  query: string;
  events: V3EventRow[];
  organisers: V3OrganiserRow[];
  teachers: V3PersonRow[];
  djs: V3PersonRow[];
  dancers: V3PersonRow[];
  venues: V3VenueRow[];
  total_count: number;
}

const personName = (r: V3PersonRow): string =>
  r.display_name || [r.first_name, r.surname].filter(Boolean).join(' ') || 'Unknown';

export async function searchPublicV3(
  query: string,
  citySlug?: string | null,
  sectionLimit = 12,
  includePast = false,
): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  // Phase 1E #2 cutover (2026-05-27): search_public_v4 reads from
  // event_series_p5 + event_occurrence_p5 (vs v3 which read legacy events).
  // Identical JSONB envelope shape; other 5 sections unchanged.
  const { data, error } = await supabase.rpc('search_public_v4' as never, {
    p_query: term,
    p_city_slug: citySlug ?? null,
    p_section_limit: sectionLimit,
    p_include_past: includePast,
  });
  if (error) throw error;
  const payload = data as V3Payload;
  if (!payload) return [];

  const mapPerson = (r: V3PersonRow, kind: SearchKind): SearchResult => ({
    kind,
    id: r.id,
    title: personName(r),
    subtitle: null,
    imageUrl: resolveEventImage(r.avatar_url ?? r.photo_url, null),
    eventType: null,
    startTime: null,
    href: hrefFor(kind, r.id),
  });

  return [
    ...(payload.events ?? []).map((e): SearchResult => ({
      kind: 'event',
      id: e.id,
      title: e.name,
      subtitle: null,
      imageUrl: resolveEventImage(e.poster_url, null),
      eventType: e.event_type,
      startTime: e.start_time,
      href: hrefFor('event', e.id),
    })),
    ...(payload.organisers ?? []).map((o): SearchResult => ({
      kind: 'organiser',
      id: o.id,
      title: o.name,
      subtitle: null,
      imageUrl: resolveEventImage(o.avatar_url, null),
      eventType: null,
      startTime: null,
      href: hrefFor('organiser', o.id),
    })),
    ...(payload.venues ?? []).map((v): SearchResult => ({
      kind: 'venue',
      id: v.id,
      title: v.name,
      subtitle: v.address,
      imageUrl: resolveEventImage(v.photo_url, null),
      eventType: null,
      startTime: null,
      href: hrefFor('venue', v.id),
    })),
    ...(payload.teachers ?? []).map((r) => mapPerson(r, 'teacher')),
    ...(payload.djs ?? []).map((r) => mapPerson(r, 'dj')),
    ...(payload.dancers ?? []).map((r) => mapPerson(r, 'dancer')),
  ];
}
