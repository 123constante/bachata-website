import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase } from "@/integrations/supabase/getSupabase";
// Both RPCs ship from the admin repo (20261109950000 / 20261109960000) and are
// not in the generated types until the types regen lands -- hence rpcLoose.
import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import {
  PROFILE_FIELDS,
  missingProfileFields,
  type ProfileCompletion,
  type ProfileRow,
} from "@/lib/profileCompletion";

export const profileCompletionQueryKey = (userId: string | null | undefined) =>
  ["profile-completion", userId ?? null] as const;

/**
 * The caller's profile completeness, asked of the SERVER about the caller's
 * RESOLVED persona:
 *
 * 1. `_my_dancer_profile_id_v1()` -> the persona id. It is NOT auth.uid() for an
 *    account linked to an admin-made profile (claimed_by), so nothing here
 *    keys on the auth id.
 * 2. `profile_complete_v1(<that id>)` -> the one definition of "complete".
 * 3. Only when incomplete: read that row's four fields to know which to ask for.
 */
export const fetchProfileCompletion = async (): Promise<ProfileCompletion> => {
  const resolved = await rpcLoose("_my_dancer_profile_id_v1");
  if (resolved.error) throw resolved.error;
  const profileId = typeof resolved.data === "string" && resolved.data ? resolved.data : null;
  if (!profileId) return { status: "no_profile", missing: [...PROFILE_FIELDS], profileId: null };

  const complete = await rpcLoose("profile_complete_v1", { p_person: profileId });
  if (complete.error) throw complete.error;
  if (complete.data === true) return { status: "complete", missing: [], profileId };

  const supabase = await getSupabase();
  const { data: row, error } = await supabase
    .from("dancer_profiles")
    .select("first_name, based_city_id, dance_role, avatar_url")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  const missing = missingProfileFields(row as ProfileRow | null);
  // The server said incomplete but the row reads full (an RLS gap or drift between
  // this mirror and the SQL): ask for every field rather than show an empty form.
  return { status: "incomplete", missing: missing.length > 0 ? missing : [...PROFILE_FIELDS], profileId };
};

export type UseProfileCompletion = ProfileCompletion & {
  /** Re-asks the server and resolves to the fresh answer (the Finish screen, after a save). */
  refetch: () => Promise<ProfileCompletion>;
};

/**
 * `paused`: do not ask yet (ProfileCompletionChrome on /auth*, where the callback
 * is still filling the stub -- an answer cached there would be stale on arrival).
 */
export const useProfileCompletion = (opts: { paused?: boolean } = {}): UseProfileCompletion => {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;

  const query = useQuery({
    queryKey: profileCompletionQueryKey(user?.id),
    queryFn: fetchProfileCompletion,
    enabled: signedIn && !opts.paused,
    // The app default (60 s, refetch on focus): other screens can complete a
    // profile without invalidating this, so it must not linger.
  });

  const refetch = async (): Promise<ProfileCompletion> => {
    const result = await query.refetch();
    // A failed refetch keeps the PREVIOUS data; reporting that as fresh would
    // tell the person a field they just saved is still missing.
    if (result.isError || !result.data) return { status: "error", missing: [], profileId: null };
    return result.data;
  };

  if (!signedIn) return { status: "signed_out", missing: [], profileId: null, refetch };
  if (opts.paused && !query.data) return { status: "loading", missing: [], profileId: null, refetch };
  if (query.data) return { ...query.data, refetch };
  if (query.isError) return { status: "error", missing: [], profileId: null, refetch };
  return { status: "loading", missing: [], profileId: null, refetch };
};
