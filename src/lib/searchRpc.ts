import { supabase } from '@/integrations/supabase/client';
import { resolveEventImage } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { fetchPublicFestivalsList, filterUpcomingFestivals } from '@/lib/festivalsList';
import { hrefFor, type SearchKind } from '@/lib/searchEntities';
import { londonTodayKey } from '@/lib/londonDate';

// Re-export the canonical 8-kind SearchKind (defined in searchEntities) so the
// existing `import { SearchKind } from '@/lib/searchRpc'` call sites keep working.
export type { SearchKind } from '@/lib/searchEntities';

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

// search_public_v4 / v5 -- federated search across all entity types. The overlay
// (usePublicSearch) consumes the flat SearchResult[]. v5 adds vendors + cities
// as two extra optional sections; the rest of the envelope is unchanged.
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

interface V3VendorRow {
  id: string;
  name: string | null;
  photo_url: string | null;
  short_description: string | null;
}

interface V3CityRow {
  id: string;
  name: string | null;
  slug: string | null;
  country_name: string | null;
  image_url: string | null;
}

interface V3Payload {
  query: string;
  events: V3EventRow[];
  organisers: V3OrganiserRow[];
  teachers: V3PersonRow[];
  djs: V3PersonRow[];
  dancers: V3PersonRow[];
  venues: V3VenueRow[];
  vendors?: V3VendorRow[];  // v5 only
  cities?: V3CityRow[];     // v5 only
  total_count: number;
  did_you_mean?: string | null;
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
  const fn = flags.searchV5 ? 'search_public_v5' : 'search_public_v4';
  // Global festivals are fetched separately so a festival in ANOTHER city still
  // surfaces in search (mirrors prior v3/v4 behaviour). They come from the
  // P5-native shared festivals-list seam (module-cached, so the per-keystroke
  // debounce does not rebuild the projection server-side each time). The name
  // match, the shared upcoming window and the section cap are applied here.
  const today = londonTodayKey();
  const needle = term.toLowerCase();

  const [rpcResult, festRows] = await Promise.all([
    supabase.rpc(fn as never, {
      p_query: term,
      p_city_slug: citySlug ?? null,
      p_section_limit: sectionLimit,
      p_include_past: includePast,
    }),
    fetchPublicFestivalsList(),
  ]);

  const nameMatches = festRows.filter((f) => (f.name ?? '').toLowerCase().includes(needle));
  const festResult = (includePast ? nameMatches : filterUpcomingFestivals(nameMatches, today))
    .slice(0, sectionLimit);
  if (rpcResult.error) throw rpcResult.error;
  const payload = rpcResult.data as V3Payload;
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

  const localEventIds = new Set((payload.events ?? []).map((e) => e.id));
  const globalFests: SearchResult[] = festResult
    .filter((f) => !localEventIds.has(f.id))
    .map((f) => ({
      kind: 'event' as SearchKind,
      id: f.id,
      title: f.name ?? '',
      subtitle: f.city,
      imageUrl: resolveEventImage(f.poster_url, null),
      eventType: 'festival',
      startTime: null,
      href: `/festival/${f.id}`,
    }));

  return [
    ...(payload.events ?? []).map((e): SearchResult => ({
      kind: 'event',
      id: e.id,
      title: e.name,
      subtitle: null,
      imageUrl: resolveEventImage(e.poster_url, null),
      eventType: e.event_type,
      startTime: e.start_time,
      href: e.event_type === 'festival' ? `/festival/${e.id}` : hrefFor('event', e.id),
    })),
    ...globalFests,
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
    ...(payload.vendors ?? []).map((v): SearchResult => ({
      kind: 'vendor',
      id: v.id,
      title: v.name ?? 'Vendor',
      subtitle: v.short_description,
      imageUrl: resolveEventImage(v.photo_url, null),
      eventType: null,
      startTime: null,
      href: hrefFor('vendor', v.id),
    })),
    ...(payload.cities ?? []).map((c): SearchResult => ({
      kind: 'city',
      id: c.id,
      title: c.name ?? 'City',
      subtitle: c.country_name,
      imageUrl: resolveEventImage(c.image_url, null),
      eventType: null,
      startTime: null,
      href: hrefFor('city', c.id, c.slug),
    })),
    ...(payload.teachers ?? []).map((r) => mapPerson(r, 'teacher')),
    ...(payload.djs ?? []).map((r) => mapPerson(r, 'dj')),
    ...(payload.dancers ?? []).map((r) => mapPerson(r, 'dancer')),
  ];
}
