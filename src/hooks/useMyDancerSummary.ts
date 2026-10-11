import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MY_DANCER_SUMMARY_ROOT, MY_PERSONA_STALE_MS, fetchMyPersonaId, myPersonaQueryKey } from "@/lib/myPersona";

// The root lives in lib/myPersona (PERSONA_DERIVED_QUERY_ROOTS invalidates it at a
// sign-in link); the Finish screen invalidates it after a save.
export { MY_DANCER_SUMMARY_ROOT };
export const myDancerSummaryQueryKey = (userId: string | null | undefined) => [MY_DANCER_SUMMARY_ROOT, userId ?? null] as const;

/** What the dancer home shows about the person. NOT the completeness fact: that is useProfileCompletion's. */
export type MyDancerSummary = {
  id: string;
  firstName: string | null;
  cityName: string | null;
  danceRole: string | null;
  avatarUrl: string | null;
  /** Archived profiles are hidden from the public dancer pages (dancer_profiles RLS). */
  archived: boolean;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The row behind the RESOLVED persona (lib/myPersona), never auth.uid(). No persona -> null. */
export const fetchMyDancerSummary = async (resolvePersona: () => Promise<string | null>): Promise<MyDancerSummary | null> => {
  const id = await resolvePersona();
  if (!id) return null;
  const { data, error } = await supabase
    .from("dancer_profiles")
    .select("id, first_name, dance_role, avatar_url, archived_at, city:cities!dancer_profiles_based_city_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as Record<string, unknown> & { city?: { name?: unknown } | null };
  return {
    id,
    firstName: text(row.first_name),
    cityName: text(row.city?.name),
    danceRole: text(row.dance_role),
    avatarUrl: text(row.avatar_url),
    archived: row.archived_at != null,
  };
};

export const useMyDancerSummary = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: myDancerSummaryQueryKey(user?.id),
    queryFn: () =>
      fetchMyDancerSummary(() =>
        queryClient.fetchQuery({ queryKey: myPersonaQueryKey(user?.id), queryFn: fetchMyPersonaId, staleTime: MY_PERSONA_STALE_MS }),
      ),
    enabled: Boolean(user?.id) && !user?.is_anonymous,
  });
};
