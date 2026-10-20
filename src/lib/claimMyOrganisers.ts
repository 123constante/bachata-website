import { rpcLoose } from "@/integrations/supabase/rpcLoose";

/**
 * claim_my_organisers_v1() (admin contract): no args, authenticated; returns
 *   {"status": <text>, "claimed": [{"organiser_id": uuid, "name": text}]}
 * It links the pages an admin recorded this person's email against, and needs a
 * proven mailbox. `claimed` may be empty (nothing to claim, or already claimed).
 *
 * Called once per sign-in, right after the dancer claim. It must NEVER block or
 * break a sign-in: an error, a timeout, a malformed answer and the function not
 * existing yet all resolve to an empty list.
 */
export const CLAIM_MY_ORGANISERS_RPC = "claim_my_organisers_v1";
export const CLAIM_ORGANISERS_TIMEOUT_MS = 4000;

export interface ClaimedOrganiser {
  organiserId: string;
  name: string;
}

/** Reads the contract's jsonb; rows without an id and a name are dropped. */
export const parseClaimedOrganisers = (data: unknown): ClaimedOrganiser[] => {
  const claimed = (data as { claimed?: unknown } | null)?.claimed;
  if (!Array.isArray(claimed)) return [];
  const out: ClaimedOrganiser[] = [];
  for (const r of claimed as Record<string, unknown>[]) {
    if (r && typeof r.organiser_id === "string" && typeof r.name === "string" && r.name.trim()) {
      out.push({ organiserId: r.organiser_id, name: r.name.trim() });
    }
  }
  return out;
};

export const claimMyOrganisers = async (timeoutMs = CLAIM_ORGANISERS_TIMEOUT_MS): Promise<ClaimedOrganiser[]> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    const result = await Promise.race([rpcLoose(CLAIM_MY_ORGANISERS_RPC), timeout]);
    if (result === "timeout" || result.error) return [];
    return parseClaimedOrganisers(result.data);
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/** "You now manage Ritmo." / "You now manage Ritmo and Salsa Club." / "You now manage A, B and C." */
export const claimedNoticeText = (claimed: readonly ClaimedOrganiser[]): string => {
  const names = claimed.map((c) => c.name);
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `You now manage ${list}.`;
};

export const NOT_YOU_ORGANISER_MESSAGE = "Hi! I just signed in to Bachata Calendar and it says I now manage an organiser page that is not mine: ";
