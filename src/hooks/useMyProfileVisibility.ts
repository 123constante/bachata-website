import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { myPersonaIdForReads } from "@/lib/myPersona";

export const myProfileVisibilityQueryKey = (userId: string | null | undefined) =>
  ["my-profile-visibility", userId ?? null] as const;

/** "none": no live dancer profile. "hidden": the person disabled it (dancer_profiles.is_active = false). */
export type ProfileVisibility = "none" | "visible" | "hidden";

/** The person's OWN profile row (lib/myPersona, never auth.uid()): is_active false = hidden from the public. */
export const fetchMyProfileVisibility = async (resolvePersona: () => Promise<string | null>): Promise<ProfileVisibility> => {
  const id = await resolvePersona();
  if (!id) return "none";
  const { data, error } = await supabase.from("dancer_profiles").select("is_active").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return "none";
  return data.is_active === false ? "hidden" : "visible";
};

export type UseMyProfileVisibility = {
  status: "loading" | "error" | ProfileVisibility;
  refetch: () => void;
};

export const useMyProfileVisibility = (): UseMyProfileVisibility => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: myProfileVisibilityQueryKey(user?.id),
    queryFn: () => fetchMyProfileVisibility(() => myPersonaIdForReads(queryClient, user!.id)),
    enabled: Boolean(user?.id) && !user?.is_anonymous,
  });
  const status = q.data !== undefined ? q.data : q.isError || (q.isPending && q.isPaused) ? "error" : "loading";
  return { status, refetch: () => void q.refetch() };
};
