import { getSupabase } from '@/integrations/supabase/getSupabase';
import { resolveEventImage } from '@/lib/utils';
import { flags } from '@/lib/featureFlags';
import { fetchPublicFestivalsList, filterUpcomingFestivals } from '@/lib/festivalsList';
import { hrefFor, orderedRoles, roleLine, telemetryKindFor, type PersonRole, type SearchKind } from '@/lib/searchEntities';
import { londonTodayKey } from '@/lib/londonDate';
import { buildCityPath } from '@/lib/cityPath';
import { reportClientErrorLazy } from '@/lib/reportClientErrorLazy';

// One report per page load for a failed searchPerson chunk, not one per keystroke.
let peopleChunkFailReported = false;

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
  // search_public_v6 only (flags.searchV6): dancer-rated series level, null
  // until the series has enough ratings. Absent on every v4/v5 result.
  derivedLevel?: string | null;
  levelVoteCount?: number;
  // People only (teacher / dj / dancer): ISO alpha-2 or null -- the flag on the photo.
  nationalityCode?: string | null;
  // search_public_v7 person rows (kind 'person') only: the roles in fixed order,
  // and the OLD entity kind logged on click (primary_role) so popularity ranking
  // keeps working with no new entity_type.
  roles?: PersonRole[];
  telemetryKind?: PersonRole;
}

// search_public_v2 -- events / venues / organisers text-match by name.
export async function searchPublic(query: string, limitPerKind = 6): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const supabase = await getSupabase();
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
  derived_level?: string | null;  // v6 only
  level_vote_count?: number;      // v6 only
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
  nationality_code?: string | null;
  roles?: string[];          // v7 only
  primary_role?: string;     // v7 only
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
  teachers?: V3PersonRow[];  // absent on v7
  djs?: V3PersonRow[];       // absent on v7
  dancers?: V3PersonRow[];   // absent on v7
  people?: V3PersonRow[];    // v7 only
  venues: V3VenueRow[];
  vendors?: V3VendorRow[];  // v5 only
  cities?: V3CityRow[];     // v5 only
  total_count: number;
  did_you_mean?: string | null;
}

const authoredName = (r: V3PersonRow): string =>
  r.display_name || [r.first_name, r.surname].filter(Boolean).join(' ');
const personName = (r: V3PersonRow): string => authoredName(r) || 'Unknown';

export async function searchPublicV3(
  query: string,
  citySlug?: string | null,
  sectionLimit = 12,
  includePast = false,
  levels: string[] | null = null,
): Promise<SearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  // v6 is a strict superset of v5's envelope, so it wins over searchV5 when on.
  // `levels` is only ever sent to v6; with searchV6 off the call is unchanged.
  // v7 is v6 with one `people` key in place of teachers/djs/dancers (same args).
  const v6 = flags.searchV6 || flags.searchV7;
  const fn = flags.searchV7 ? 'search_public_v7' : flags.searchV6 ? 'search_public_v6' : flags.searchV5 ? 'search_public_v5' : 'search_public_v4';
  // Global festivals are fetched separately so a festival in ANOTHER city still
  // surfaces in search (mirrors prior v3/v4 behaviour). They come from the
  // P5-native shared festivals-list seam (module-cached, so the per-keystroke
  // debounce does not rebuild the projection server-side each time). The name
  // match, the shared upcoming window and the section cap are applied here.
  const today = londonTodayKey();
  const needle = term.toLowerCase();

  // W1 review M1: the overlay person row is the /search PersonRow's answer, the same function
  // (person-page/searchPerson.ts over the badges mapping). Imported lazily: statically it would
  // put the Supabase client in the header's first-load graph (searchRpc reaches it through
  // getSupabase on purpose). Started here, alongside the RPC, so the chunk load overlaps the
  // network round trip. A plain import(), NOT safeDynamicImport: its stale-chunk heal reloads
  // the page, which here would happen mid-keystroke and throw the typed query away. Any
  // failure (stale chunk included) is reported once and resolves to null: the people rows
  // degrade (below) and the rest of the search still returns. Only awaited when the result
  // has people rows, so a search with no people never waits on the chunk.
  const peopleMod = flags.searchV7
    ? import('@/modules/person-page/searchPerson').catch((err: unknown) => {
        if (!peopleChunkFailReported) {
          peopleChunkFailReported = true;
          reportClientErrorLazy(err, 'error');
        }
        return null;
      })
    : null;

  // The accessor is awaited inside the leg rather than hoisted above the
  // Promise.all. This is a shape choice, NOT a latency win: the festivals leg
  // awaits getSupabase() itself on a cache miss (festivalsList.ts) and does no
  // I/O at all on a hit, so neither branch overlaps the client import with
  // anything -- hoisting would behave identically. getSupabase memoises the
  // PROMISE, so the two legs share one import either way.
  const [rpcResult, festRows] = await Promise.all([
    getSupabase().then((supabase) =>
      supabase.rpc(fn as never, {
        p_query: term,
        p_city_slug: citySlug ?? null,
        p_section_limit: sectionLimit,
        p_include_past: includePast,
        ...(v6 ? { p_level: levels && levels.length ? levels : null } : {}),
      }),
    ),
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
    nationalityCode: r.nationality_code ?? null,
  });

  // searchPersonView: link DJ page, else dancer page, else teacher page while open; tags in
  // ROLE_ORDER with Teacher shown (plain) while the teacher pages are closed. The overlay has
  // no badges read, so no stage name. Chunk failed to load: the roles from the search read,
  // the same order and labels, and no page link.
  const people = payload.people?.length && peopleMod ? await peopleMod : null;
  // No page to open (teacher-only while closed, no public role, or no mapping chunk): the
  // search results the way submitSearch opens them (city-scoped when this search is), where
  // the same row shows plain. Never /people/ and never the closed /teachers/ gate. A person
  // with no name searches the typed query rather than an empty name or "Unknown".
  const searchPath = buildCityPath(citySlug, 'search');
  const mapPersonV7 = (r: V3PersonRow): SearchResult => {
    const base = mapPerson(r, 'person');
    const view = people?.searchPersonView(r.id, r.roles, undefined, { teacherPagesOpen: flags.teacherDetail });
    const roles = view ? view.tags.map((t) => t.role) : orderedRoles(r.roles);
    return {
      ...base,
      href: view?.href ?? `${searchPath}?q=${encodeURIComponent(authoredName(r) || term)}`,
      subtitle: (view ? view.tags.map((t) => t.label).join(' \u00b7 ') : roleLine(roles)) || null,
      roles,
      telemetryKind: telemetryKindFor(r.primary_role, r.roles),
    };
  };

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
      ...(v6
        ? { derivedLevel: e.derived_level ?? null, levelVoteCount: e.level_vote_count ?? 0 }
        : {}),
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
    ...(payload.people ?? []).map(mapPersonV7),
  ];
}
