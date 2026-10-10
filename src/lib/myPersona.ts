import type { QueryClient } from "@tanstack/react-query";
// _my_dancer_profile_id_v1 is not in the generated types yet (admin 20261109960000).
import { rpcLoose } from "@/integrations/supabase/rpcLoose";

/**
 * "Which dancer profile is MINE?" -- the ONE client answer, read by every
 * "my profile" screen (AuthGuard, useUserIds, EditProfile, DancerDashboard,
 * PracticePartners, DancerProfile's isSelfView, the completion hook and the
 * sign-in callback). Two copies of this would drift into one screen showing the
 * linked admin profile and the next one the empty sign-up stub.
 *
 * The server owns the rule: `_my_dancer_profile_id_v1()` = the live admin-made
 * profile linked to the account (dancer_profiles.claimed_by), else the account's
 * own row (the sign-up stub), else NULL. It is NOT auth.uid() for a linked
 * account, so nothing here keys a read on the auth id when the resolver answered.
 */

export const MY_PERSONA_RPC = "_my_dancer_profile_id_v1";

export const myPersonaQueryKey = (accountId: string | null | undefined) =>
  ["my-persona-id", accountId ?? null] as const;

/** Cached per account. A link changes it only at a sign-in, which invalidates it (see claimMyDancerProfile). */
export const MY_PERSONA_STALE_MS = 5 * 60_000;

/** One raw call. Throws when the call FAILED; NULL means the account has no persona. */
export const fetchMyPersonaId = async (): Promise<string | null> => {
  const resolved = await rpcLoose(MY_PERSONA_RPC);
  if (resolved.error) throw resolved.error;
  return typeof resolved.data === "string" && resolved.data ? resolved.data : null;
};

export type PersonaResolution =
  | { status: "resolved"; id: string }
  /** The resolver answered NULL: no own row and no linked profile. */
  | { status: "none" }
  /** The resolver call failed (network, 5xx, a missing function). */
  | { status: "error" };

/**
 * The id a "my profile" READ keys on. The one mapping every screen uses:
 * - resolved -> that id (the linked admin profile, or the own stub);
 * - none     -> null: the screen takes the path it already takes for "no row";
 * - error    -> the account id. That is exactly what every screen read before
 *   this resolver existed, so an outage of the resolver degrades to the old
 *   behaviour instead of blanking a screen or bouncing a gate.
 */
export const personaIdForReads = (resolution: PersonaResolution, accountId: string): string | null => {
  if (resolution.status === "resolved") return resolution.id;
  if (resolution.status === "none") return null;
  return accountId;
};

/** The resolver through the shared react-query cache (one call per account per stale window). */
export const resolveMyPersona = async (queryClient: QueryClient, accountId: string): Promise<PersonaResolution> => {
  try {
    const id = await queryClient.fetchQuery({
      queryKey: myPersonaQueryKey(accountId),
      queryFn: fetchMyPersonaId,
      staleTime: MY_PERSONA_STALE_MS,
    });
    return id ? { status: "resolved", id } : { status: "none" };
  } catch {
    return { status: "error" };
  }
};

/** resolveMyPersona + personaIdForReads: what an imperative read (an effect) calls. */
export const myPersonaIdForReads = async (queryClient: QueryClient, accountId: string): Promise<string | null> =>
  personaIdForReads(await resolveMyPersona(queryClient, accountId), accountId);

/**
 * Is the viewed profile mine? True for my RESOLVED persona, and ALSO for my
 * account's own row: once linked, the sign-up stub is archived but its URL still
 * belongs to me, so it must not read as a stranger's page.
 */
export const isMyProfile = (input: {
  viewedId: string | null | undefined;
  personaId: string | null | undefined;
  accountId: string | null | undefined;
}): boolean => {
  const { viewedId, personaId, accountId } = input;
  if (!viewedId) return false;
  return viewedId === personaId || viewedId === accountId;
};

/**
 * The caches that hold an answer derived from the persona. Invalidated when a
 * sign-in links the account to a profile, so every screen re-reads the linked one.
 */
export const PERSONA_DERIVED_QUERY_ROOTS = ["my-persona-id", "profile-completion"] as const;

export const invalidateMyPersonaCaches = (queryClient: QueryClient): Promise<void> =>
  Promise.all(
    PERSONA_DERIVED_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  ).then(() => undefined);
