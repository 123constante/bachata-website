import type { QueryClient } from "@tanstack/react-query";
// claim_my_dancer_profile_v1 ships from the admin repo and is not in the
// generated types (it may not even be applied yet) -- hence rpcLoose.
import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import { invalidateMyPersonaCaches } from "@/lib/myPersona";

/**
 * Self-claim at a proven sign-in (owner decision: AUTOMATIC, no click).
 *
 * `public.claim_my_dancer_profile_v1()` (admin contract, do not change): no
 * args, authenticated; returns jsonb
 *   {"ok": true, "status": <ClaimStatus>, "profile_id": uuid | null}
 * and business refusals never raise. It links the account to the ONE live,
 * unlinked admin-made profile whose email matches the account's confirmed email.
 *
 * Called once per sign-in, on EVERY sign-in (not only the first): it is a cheap
 * no-op when already linked, and it also catches a profile whose email an admin
 * added after the person signed up. It runs BEFORE the persona is read, so the
 * read that follows sees the linked profile.
 *
 * It must NEVER block or break a sign-in: every failure -- including the
 * function not existing yet (PGRST202 / 404) while the admin migration is not
 * applied, and a call that hangs -- resolves to "unavailable", with a
 * console.debug at most and never a toast.
 */

export const CLAIM_MY_DANCER_PROFILE_RPC = "claim_my_dancer_profile_v1";

export const CLAIM_STATUSES = [
  "linked",
  "already_linked",
  "no_match",
  "ambiguous",
  "email_unproven",
  "not_applicable",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type ClaimOutcome =
  | { status: ClaimStatus; profileId: string | null }
  /** The call failed, timed out, the function is missing, or the answer was not the contract's shape. */
  | { status: "unavailable"; profileId: null };

const UNAVAILABLE: ClaimOutcome = { status: "unavailable", profileId: null };

/** A sign-in is never held longer than this for the claim. */
export const CLAIM_TIMEOUT_MS = 4000;

/** Reads the contract's jsonb. Anything else is "unavailable", never a guess. */
export const parseClaimResult = (data: unknown): ClaimOutcome => {
  if (!data || typeof data !== "object") return UNAVAILABLE;
  const d = data as { ok?: unknown; status?: unknown; profile_id?: unknown };
  if (d.ok !== true || typeof d.status !== "string") return UNAVAILABLE;
  if (!(CLAIM_STATUSES as readonly string[]).includes(d.status)) return UNAVAILABLE;
  const profileId = typeof d.profile_id === "string" && d.profile_id ? d.profile_id : null;
  return { status: d.status as ClaimStatus, profileId };
};

const debug = (why: string, detail?: unknown) => {
  // eslint-disable-next-line no-console
  console.debug(`[claim_my_dancer_profile] ${why}`, detail ?? "");
};

/** The RPC, swallowed. Never rejects. */
export const claimMyDancerProfile = async (timeoutMs = CLAIM_TIMEOUT_MS): Promise<ClaimOutcome> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([rpcLoose(CLAIM_MY_DANCER_PROFILE_RPC), timeout]);
    if (result === "timeout") {
      debug("timed out");
      return UNAVAILABLE;
    }
    if (result.error) {
      // Includes PGRST202 / 404 while the admin migration is not applied yet.
      debug("not available", result.error.message);
      return UNAVAILABLE;
    }
    return parseClaimResult(result.data);
  } catch (err) {
    debug("failed", err);
    return UNAVAILABLE;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * The one entry point for both sign-in paths (/auth/callback and AuthStepper's
 * in-page sign-in). On "linked" the persona-derived caches are dropped, so every
 * screen re-reads the linked profile. Never rejects.
 */
export const claimAtSignIn = async (queryClient: QueryClient): Promise<ClaimOutcome> => {
  const outcome = await claimMyDancerProfile();
  if (outcome.status === "linked") {
    // Not awaited: an invalidation refetches active queries, and a slow refetch
    // must not hold the sign-in. The persona read that follows is a fresh call.
    void invalidateMyPersonaCaches(queryClient).catch((err) => debug("invalidate failed", err));
  }
  return outcome;
};

/**
 * Arm the one-time Finish-your-profile hop? Only on the account's first sign-in
 * (#707), and never on the sign-in that just linked an admin-made profile: that
 * profile may already be complete, and the fresh completeness check on the next
 * page decides (the banner still shows if it is not).
 */
export const shouldArmFinishHop = (input: { firstSignIn: boolean; claim: ClaimOutcome }): boolean =>
  input.firstSignIn && input.claim.status !== "linked";
