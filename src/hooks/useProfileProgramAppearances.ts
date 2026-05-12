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
   *   'instructor'  — teacher session in event_program_people
   *   'dj_set'      — DJ session in event_program_people
   *   role string   — event_program_people.role for non-teacher/dj profile_types
   */
  connection_label: string;
  is_primary: boolean;
  /**
   * Semantic origin: 'program' = session-level slot resolved via the program
   * fetch path, 'link' = surfaced via the lineup fetch path. Both paths read
   * event_program_people post-EPL retirement; the distinction is now whether
   * the event was first found by the teacher/dj program fetch or by the
   * universal lineup fetch.
   */
  source: 'program' | 'link';
};

// ─── Private fetchers ─────────────────────────────────────────────────────────

/**
 * Resolve the set of profile_id values that should match this person in
 * event_program_people. Admin tooling sometimes stores the profile-table PK
 * and sometimes the shared person_entity_id, so both forms must be queried.
 *
 * Post-DJ-table retirement (2026-04-30): both teachers and DJs now resolve
 * via dancer_profiles, which carries person_entity_id for the unified person
 * model.
 */
async function resolveProfileIdForms(
  profileId: string,
  _profileType: 'teacher' | 'dj',
): Promise<string[]> {
  const { data } = await supabase
    .from('dancer_profiles')
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
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  const ids = ((data ?? []) as unknown as { event_id: string | null }[])
    .map((r) => r.event_id)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

type LinkRow = { event_id: string; role: string; is_primary?: boolean };

/**
 * Lineup rows for any profile type, sourced from event_program_people (the
 * canonical post-EPL authority). EPP has one row per program item the
 * profile is on, so the same (event_id, profile_id) pair can appear multiple
 * times within one event — collapse to one row per event_id, preferring the
 * first non-empty role string for the connection label.
 *
 * profile_id column meanings per profile_type:
 *   teacher      → dancer_profiles.id (or person_entity_id form)
 *   dj           → dancer_profiles.id  (or person_entity_id form)
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
    .from('event_program_people')
    .select('event_id, profile_id, profile_type, role')
    .eq('profile_id', profileId)
    .eq('profile_type', profileType);
  if (error) throw new Error(error.message ?? JSON.stringify(error));

  const rowsByEventId = new Map<string, LinkRow>();
  for (const raw of (data ?? []) as { event_id: string | null; role: string | null }[]) {
    const eventId = raw?.event_id;
    if (!eventId) continue;
    const role = typeof raw?.role === 'string' ? raw.role : '';
    const existing = rowsByEventId.get(eventId);
    if (!existing || (!existing.role && role)) {
      rowsByEventId.set(eventId, { event_id: eventId, role });
    }
  }
  return [...rowsByEventId.values()];
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
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return ((data ?? []) as (EventRow & { is_active: boolean | null })[])
    .filter((r) => r.is_active !== false);
}

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Returns published+active event appearances for a public profile page.
 *
 * Semantic contract
 * ─────────────────
 * • Teachers and DJs: a program-id resolution step (resolveProfileIdForms)
 *   resolves both the profile-table PK and person_entity_id forms, then
 *   reads event_program_people for the session-level event ids. A second
 *   universal lineup fetch (also event_program_people) catches any rows
 *   whose profile_id form was not in the program path. Per-event de-dup
 *   collapses EPP's per-program-item rows.
 *
 * • All other profile types (dancer, organiser, vendor, videographer): only
 *   the universal lineup fetch path runs.
 *
 * All results are gated on events.is_active != false (matching the directory
 * page behaviour). The admin-only get_profile_event_timeline RPC is never
 * called.
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
