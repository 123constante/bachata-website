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

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Returns published+active event appearances for a public profile page.
 *
 * Semantic contract
 * ─────────────────
 * The RPC owns P5 appearance resolution, occurrence selection, public
 * visibility, and venue enrichment for every supported profile type.
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
      const { data, error } = await supabase.rpc('get_profile_event_timeline_v2', {
        p_person_type: personType,
        p_person_id: profileId,
        p_limit: limit,
        p_offset: 0,
      });
      if (error) throw new Error(error.message ?? JSON.stringify(error));

      return ((data ?? []) as Array<{
        event_id: string;
        event_name: string;
        event_start_time: string | null;
        role: string | null;
        venue_name: string | null;
      }>).map((item) => ({
        event_id: item.event_id,
        event_name: item.event_name,
        event_location: item.venue_name,
        event_start_time: item.event_start_time,
        connection_label: item.role || personType,
        is_primary: false,
        source: 'program' as const,
      }));
    },
  });
}
