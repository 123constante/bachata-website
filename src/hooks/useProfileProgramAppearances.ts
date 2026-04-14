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
 * Session-level: unique event IDs where this teacher has a program slot.
 * profile_id in event_program_instructors == teacher_profiles.id
 */
async function fetchTeacherProgramEventIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_program_instructors')
    .select('event_program_items!inner(event_id)')
    .eq('profile_id', profileId);
  if (error) throw error;
  const ids = (data ?? [])
    .map((r) => (r as any).event_program_items?.event_id as string | null)
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

/**
 * Session-level: unique event IDs where this DJ has a program slot.
 * profile_id in event_program_djs == dj_profiles.id
 */
async function fetchDJProgramEventIds(profileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_program_djs')
    .select('event_program_items!inner(event_id)')
    .eq('profile_id', profileId);
  if (error) throw error;
  const ids = (data ?? [])
    .map((r) => (r as any).event_program_items?.event_id as string | null)
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
 * Published + active gate: returns only the subset of the given event IDs
 * where is_published = true AND is_active = true.
 */
async function keepPublishedAndActive(eventIds: string[]): Promise<EventRow[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase
    .from('events')
    .select('id, name, location, city, start_time')
    .in('id', eventIds)
    .eq('is_published', true)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as EventRow[];
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
        programEventIds = await fetchTeacherProgramEventIds(profileId);
        programLabel = 'instructor';
      } else if (personType === 'dj') {
        programEventIds = await fetchDJProgramEventIds(profileId);
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

      // ── 5. Sort: upcoming soonest-first, then past most-recent-first ──────
      const now = Date.now();
      items.sort((a, b) => {
        const aMs = a.event_start_time
          ? new Date(a.event_start_time).getTime()
          : null;
        const bMs = b.event_start_time
          ? new Date(b.event_start_time).getTime()
          : null;
        const aUp = aMs !== null && aMs >= now;
        const bUp = bMs !== null && bMs >= now;
        if (aUp !== bUp) return aUp ? -1 : 1;
        if (aMs !== null && bMs !== null) return aUp ? aMs - bMs : bMs - aMs;
        return 0;
      });

      return items.slice(0, limit);
    },
  });
}
