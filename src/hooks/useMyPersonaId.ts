import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { MY_PERSONA_STALE_MS, fetchMyPersonaId, myPersonaQueryKey } from "@/lib/myPersona";

/**
 * My RESOLVED dancer persona id, through the same per-account react-query cache
 * the imperative reads use (lib/myPersona `myPersonaIdForReads`), so a screen
 * that renders it and an effect that reads by it ask the server once.
 *
 * NULL while signed out, loading, when there is no persona, or when the call
 * failed. A caller that must still recognise the account's own row (an archived
 * stub URL, or a resolver outage) pairs it with the account id: `isMyProfile`.
 */
export const useMyPersonaId = (): string | null => {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;
  const query = useQuery({
    queryKey: myPersonaQueryKey(user?.id),
    queryFn: fetchMyPersonaId,
    enabled: signedIn,
    staleTime: MY_PERSONA_STALE_MS,
  });
  return signedIn ? query.data ?? null : null;
};
