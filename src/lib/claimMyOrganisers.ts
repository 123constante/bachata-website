import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import { dancerMessageUsUrl } from "@/lib/contactLinks";
import { rememberInvitePrefill } from "@/lib/invitePrefill";

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

export type ClaimVia = "claim_email" | "invite";

/** The sender's pre-fill on an invite-joined row; the same two facts invitePrefill stores. */
export interface ClaimPrefill {
  firstName: string | null;
  cityId: string | null;
}

export interface ClaimedOrganiser {
  organiserId: string;
  name: string;
  /** How the page was joined; absent on the old answer shape or an unknown value. */
  via?: ClaimVia;
  /** Only ever used for via 'invite'; any shape problem is null. */
  prefill?: ClaimPrefill | null;
}

const parseVia = (v: unknown): ClaimVia | undefined => (v === "claim_email" || v === "invite" ? v : undefined);

const parsePrefill = (v: unknown): ClaimPrefill | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const { first_name, city_id } = v as Record<string, unknown>;
  if ((first_name != null && typeof first_name !== "string") || (city_id != null && typeof city_id !== "string")) return null;
  const firstName = typeof first_name === "string" && first_name.trim() ? first_name.trim() : null;
  const cityId = typeof city_id === "string" && city_id.trim() ? city_id.trim() : null;
  return firstName || cityId ? { firstName, cityId } : null;
};

/** Reads the contract's jsonb; rows without an id and a name are dropped. */
export const parseClaimedOrganisers = (data: unknown): ClaimedOrganiser[] => {
  const claimed = (data as { claimed?: unknown } | null)?.claimed;
  if (!Array.isArray(claimed)) return [];
  const out: ClaimedOrganiser[] = [];
  for (const r of claimed as Record<string, unknown>[]) {
    if (r && typeof r.organiser_id === "string" && typeof r.name === "string" && r.name.trim()) {
      const row: ClaimedOrganiser = { organiserId: r.organiser_id, name: r.name.trim() };
      const via = parseVia(r.via);
      if (via) row.via = via;
      if ("prefill" in r) row.prefill = parsePrefill(r.prefill);
      out.push(row);
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

/**
 * The sign-in step BOTH paths (emailed link, typed code) run: the claim, then the sender's pre-fill
 * of an invite-joined page into THE one prefill store (lib/invitePrefill) for this person, so the
 * dancer questions arrive filled in. Never throws, never holds the sign-in past its timeout.
 */
export const claimOrganisersAtSignIn = async (userId: string | null | undefined): Promise<ClaimedOrganiser[]> => {
  const claimed = await claimMyOrganisers();
  const invite = claimed.find((c) => c.via === "invite" && c.prefill);
  if (invite?.prefill && userId) rememberInvitePrefill(invite.prefill, userId);
  return claimed;
};

/** "You now manage Ritmo." / "You now manage Ritmo and Salsa Club." / "You now manage A, B and C." */
export const claimedNoticeText = (claimed: readonly ClaimedOrganiser[]): string => {
  const names = claimed.map((c) => c.name);
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `You now manage ${list}.`;
};

export const NOT_YOU_ORGANISER_MESSAGE = "Hi! I just signed in to Bachata Calendar and it says I now manage an organiser page that is not mine: ";

/** "Not you? Tell us": a WhatsApp message naming the claimed pages. */
export const notYouOrganiserHref = (claimed: readonly ClaimedOrganiser[]): string =>
  dancerMessageUsUrl(`${NOT_YOU_ORGANISER_MESSAGE}${claimed.map((c) => c.name).join(", ")}`);

/**
 * The claim notice, kept for organiser Home to draw in its own flow until it is closed (review
 * finding 7: a toast that stayed sat over Home's rows). sessionStorage, so it never outlives the
 * tab; every read and write is guarded, and an unreadable store means no notice, never an error.
 */
export const CLAIM_NOTICE_KEY = "bc_org_claim_notice_v1";
/** Landing anywhere but Home, a short toast says it there too. Never Infinity. */
export const CLAIM_TOAST_MS = 8000;

export const stashClaimNotice = (claimed: readonly ClaimedOrganiser[]): void => {
  try {
    sessionStorage.setItem(CLAIM_NOTICE_KEY, JSON.stringify({ claimed: claimed.map((c) => ({ organiser_id: c.organiserId, name: c.name })) }));
  } catch { /* storage blocked: Home simply shows no notice */ }
};

export const readClaimNotice = (): ClaimedOrganiser[] => {
  try {
    const raw = sessionStorage.getItem(CLAIM_NOTICE_KEY);
    return raw ? parseClaimedOrganisers(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
};

export const clearClaimNotice = (): void => {
  try {
    sessionStorage.removeItem(CLAIM_NOTICE_KEY);
  } catch { /* nothing to clear */ }
};
