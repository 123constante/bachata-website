import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonType =
  | 'teacher'
  | 'dj'
  | 'dancer'
  | 'organiser'
  | 'vendor'
  | 'videographer';

export type ProfileAppearanceItem = {
  /** Use with the canonical route /event/:event_id */
  event_id: string;
  event_name: string;
  event_location: string | null;
  event_start_time: string | null;
  /**
   * Accurate label from the source table:
   *   'instructor'  — from event_program_instructors  (session-level)
   *   'dj_set'      — from event_program_djs          (session-level)
   *   role string   — from event_profile_links.role   (event-level)
   */
  connection_label: string;
  is_primary: boolean;
  /** Semantic origin: 'program' = session-level slot, 'link' = event-level lineup */
  source: 'program' | 'link';
};

// ─── Private fetchers ─────────────────────────────────────────────────────────

/**
 * Resolve the set of profile_id values that should match this person in
 * event_program_people. Admin tooling sometimes stores the profile-table PK
 * (teacher_profiles.id / dj_profiles.id) and sometimes the shared
 * person_entity_id, so both forms must be queried.
 */
async function resolveProfileIdForms(
  profileId: string,
  profileType: 'teacher' | 'dj',
): Promise<string[]> {
  const table = profileType === 'teacher' ? 'teacher_profiles' : 'dj_profiles';
  const { data } = await supabase
    .from(table)
    .select('id, person_entity_id')
    .eq('id', profileId)
    .maybeSingle();
  const ids = new Set<string>([profileId]);
  const entityId = (data as { person_entity_id: string | null } | null)?.person_entity_id;
  if (entityId) ids.add(entityId);
  return [...ids];
}

/**
 * Session-level: unique event IDs where this person has a program slot.
 * Reads event_program_people (single authority) directly. Matches on BOTH
 * profile-table PK and person_entity_id forms of profile_id.
 */
async function fetchProgramEventIds(
  profileId: string,
  profileType: 'teacher' | 'dj',
): Promise<string[]> {
  const idForms = await resolveProfileIdForms(profileId, profileType);
  const { data, error } = await supabase
    .from('event_program_people' as never)
    .select('event_id')
    .in('profile_id', idForms)
    .eq('profile_type', profileType);
  if (error) throw error;
  const ids = ((data ?? []) as unknown as { event_id: string | null }[])
    .map((r) => r.event_id)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

type LinkRow = { event_id: string; role: string; is_primary: boolean };

/**
 * Event-level: active event_profile_links rows for any profile type.
 *
 * profile_id column meanings per profile_type:
 *   teacher      → teacher_profiles.id
 *   dj           → dj_profiles.id
 *   vendor       → vendors.id
 *   videographer → videographers.id
 *   dancer       → dancer_profiles.id
 *   organiser    → entities.id
 */
async function fetchLinkRows(
  profileId: string,
  profileType: PersonType,
): Promise<LinkRow[]> {
  const { data, error } = await supabase
    .from('event_profile_links')
    .select('event_id, role, is_primary')
    .eq('profile_id', profileId)
    .eq('profile_type', profileType)
    .eq('status', 'active')
    .is('archived_at', null);
  if (error) throw error;
  return (data ?? []) as LinkRow[];
}

type EventRow = {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  start_time: string | null;
};

/**
 * Active-only gate: `events` has no `is_published` column — `is_active`
 * is the sole public visibility flag. Null is treated as visible so that
 * legacy rows with un-set `is_active` still surface, matching the behaviour
 * of the directory pages.
 */
async function keepPublishedAndActive(eventIds: string[]): Promise<EventRow[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase
    .from('events')
    .select('id, name, location, city, start_time, is_active')
    .in('id', eventIds);
  if (error) throw error;
  return ((data ?? []) as (EventRow & { is_active: boolean | null })[])
    .filter((r) => r.is_active !== false);
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Returns published+active event appearances for a public profile page.
 *
 * Semantic contract
 * ─────────────────
 * • Teachers and DJs: event_program_instructors / event_program_djs are the
 *   primary source (session-level program slots).  active event_profile_links
 *   rows are also fetched, but only events that are NOT already represented
 *   in the program tables are surfaced from that source.  This preserves the
 *   distinction between "they have a scheduled session" and "they are on the
 *   event's general lineup".
 *
 * • All other profile types (dancer, organiser, vendor, videographer): only
 *   event_profile_links is queried (event-level lineup only).
 *
 * All results are gated on events.is_published = true AND events.is_active = true.
 * The admin-only get_profile_event_timeline RPC is never called.
 */
export function useProfileProgramAppearances(
  personType: PersonType | undefined,
  profileId: string | undefined,
  limit = 50,
) {
  return useQuery({
    queryKey: ['profile-program-appearances', personType, profileId, limit],
    enabled: Boolean(personType) && Boolean(profileId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProfileAppearanceItem[]> => {
      if (!personType || !profileId) return [];

      // ── 1. Program-table event IDs (session-level, teacher + dj only) ─────
      let programEventIds: string[] = [];
      let programLabel = '';

      if (personType === 'teacher') {
        programEventIds = await fetchProgramEventIds(profileId, 'teacher');
        programLabel = 'instructor';
      } else if (personType === 'dj') {
        programEventIds = await fetchProgramEventIds(profileId, 'dj');
        programLabel = 'dj_set';
      }

      const programSet = new Set(programEventIds);

      // ── 2. Event-level link rows ──────────────────────────────────────────
      const linkRows = await fetchLinkRows(profileId, personType);
      const linkByEventId = new Map(linkRows.map((r) => [r.event_id, r]));

      // Link events not already covered by a program slot (keeps semantics intact)
      const linkOnlyIds = linkRows
        .map((r) => r.event_id)
        .filter((id) => !programSet.has(id));

      // ── 3. Combined ID list → published+active gate ───────────────────────
      const allIds = [...new Set([...programEventIds, ...linkOnlyIds])];
      const events = await keepPublishedAndActive(allIds);

      // ── 4. Build result ───────────────────────────────────────────────────
      const items: ProfileAppearanceItem[] = events.map((e) => {
        const isProgram = programSet.has(e.id);
        const link = linkByEventId.get(e.id);
        return {
          event_id: e.id,
          event_name: e.name,
          event_location: e.location ?? e.city ?? null,
          event_start_time: e.start_time ?? null,
          connection_label: isProgram
            ? programLabel
            : (link?.role ?? personType),
          is_primary: isProgram ? false : (link?.is_primary ?? false),
          source: isProgram ? 'program' : 'link',
        };
      });

      // ── 5. Filter to upcoming + sort soonest-first ────────────────────────
      // Past events are excluded from public profile timelines — clamp at
      // today's 00:00 so events that started earlier today still surface.
      // Undated entries are preserved (rare, but legitimate).
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayMs = todayStart.getTime();
      const upcoming = items.filter((item) => {
        if (!item.event_start_time) return true;
        return new Date(item.event_start_time).getTime() >= todayMs;
      });
      upcoming.sort((a, b) => {
        const aMs = a.event_start_time
          ? new Date(a.event_start_time).getTime()
          : Number.POSITIVE_INFINITY;
        const bMs = b.event_start_time
          ? new Date(b.event_start_time).getTime()
          : Number.POSITIVE_INFINITY;
        return aMs - bMs;
      });

      return upcoming.slice(0, limit);
    },
  });
}
