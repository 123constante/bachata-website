// The account gate: ONE answer to "what is this login?" before any area renders.
//
// PINNED interface (the organiser session imports it; do not change the shape):
//   useAccountGate(): AccountGate (+ status 'loading')   fetchAccountGate(): Promise<AccountGate>
// A thin composition of hooks/useProfileCompletion and lib/accountDeletion; no new RPC.
// `composeAccountGate` is the single mapping, so the hook and the fetcher cannot disagree.
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchProfileCompletion, useProfileCompletion } from "@/hooks/useProfileCompletion";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { DELETION_STATUS_KEY, deletionLanding, fetchDeletionStatus, type DeletionLanding } from "@/lib/accountDeletion";
import type { ProfileCompletion } from "@/lib/profileCompletion";

export type AccountGateStatus = "loading" | "signed-out" | "deleted" | "incomplete" | "complete";

export type AccountGate = {
  status: AccountGateStatus;
  /** The resolved dancer profile id (hooks/useProfileCompletion), null when there is none or it is not known yet. */
  dancerProfileId: string | null;
  /** Not null exactly when status is 'deleted': restore (inside 30 days) or the deleted card. */
  deletion: DeletionLanding;
};

export type SettledAccountGate = Omit<AccountGate, "status"> & { status: Exclude<AccountGateStatus, "loading"> };

/** What each read knows: `loading` until it answers; a failed deletion read is null (it never strands a sign-in). */
export type GateFacts = {
  completion: Pick<ProfileCompletion, "status" | "profileId">;
  deletion: DeletionLanding | "loading";
};

/**
 * - signed out -> 'signed-out' (nothing was read);
 * - a deletion landing wins over every other state, loading included;
 * - anything still loading -> 'loading';
 * - complete -> 'complete'; incomplete, no profile and a FAILED check -> 'incomplete'
 *   (fail closed, like dancerGate: a gate that opened on a network blip would not be one).
 */
export const composeAccountGate = ({ completion, deletion }: GateFacts): AccountGate => {
  if (completion.status === "signed_out") return { status: "signed-out", dancerProfileId: null, deletion: null };
  const dancerProfileId = completion.profileId;
  if (deletion !== "loading" && deletion !== null) return { status: "deleted", dancerProfileId, deletion };
  if (deletion === "loading" || completion.status === "loading") return { status: "loading", dancerProfileId, deletion: null };
  return { status: completion.status === "complete" ? "complete" : "incomplete", dancerProfileId, deletion: null };
};

export const accountGateQueryKey = (userId: string | null | undefined) => [DELETION_STATUS_KEY, userId ?? null] as const;

export const useAccountGate = (): AccountGate => {
  const { user } = useAuth();
  const signedIn = Boolean(user?.id) && !user?.is_anonymous;
  const completion = useProfileCompletion();
  // The same key as /account/restore (which invalidates every query once restored).
  const status = useQuery({
    queryKey: accountGateQueryKey(user?.id),
    queryFn: fetchDeletionStatus,
    enabled: signedIn,
    staleTime: 30_000,
    retry: false,
  });
  const deletion: GateFacts["deletion"] = status.data !== undefined ? deletionLanding(status.data) : status.isError ? null : "loading";
  return composeAccountGate({ completion, deletion });
};

/** The non-hook form, for route loaders and callbacks. Same mapping, same answers. */
export const fetchAccountGate = async (): Promise<SettledAccountGate> => {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return composeAccountGate({ completion: { status: "signed_out", profileId: null }, deletion: null }) as SettledAccountGate;
  const [deleted, completion] = await Promise.allSettled([fetchDeletionStatus(), fetchProfileCompletion()]);
  return composeAccountGate({
    deletion: deleted.status === "fulfilled" ? deletionLanding(deleted.value) : null,
    completion: completion.status === "fulfilled" ? completion.value : { status: "error", profileId: null },
  }) as SettledAccountGate;
};
