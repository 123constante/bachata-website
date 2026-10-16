// Delete = hide (owner decision 2026-10-15; admin PR #820, migrations 20261122140000 /
// 20261122210000 / 20261122310000). Deleting hides the person from everyone at once;
// signing in within 30 days restores it; after that it stays hidden and is KEPT (never
// auto-erased). A full erase is by request to ACCOUNT_CONTACT_EMAIL (lib/accountDeletionCopy, with every
// message the screens show). An admin archive
// wins: restore never un-hides it.
//
// PINNED interface (slice 3b imports it): deletionLanding, fetchDeletionStatus,
// restoreAccount, DeletionStatus. The RPC names and JSON keys are pinned against the
// #820 SQL by src/lib/__tests__/accountDeletion.contract.test.ts.
import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import { ACCOUNT_RESTORE_PATH, restorePathFor } from "./accountRouting";

const rpc = (fn: string) => rpcLoose(fn);

/** my_account_deletion_status_v1 (= _account_deletion_status_v1): a restored row reads none. */
export type DeletionState = "none" | "pending" | "expired";
export type DeletionStatus = { state: DeletionState; requested_at: string | null; restore_until: string | null };

const STATES = new Set<string>(["none", "pending", "expired"]);
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** The RPC's jsonb, checked. Anything not shaped like it is null (unknown), never a guess. */
export const parseDeletionStatus = (raw: unknown): DeletionStatus | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.state !== "string" || !STATES.has(r.state)) return null;
  return { state: r.state as DeletionState, requested_at: strOrNull(r.requested_at), restore_until: strOrNull(r.restore_until) };
};

export type DeletionLanding = "restore" | "deleted-card" | null;

/**
 * The ONE reading of the deletion status after sign-in: pending -> restore it now;
 * expired -> the "this account was deleted" card; none, or an unknown/failed read -> null
 * (sign-in carries on as usual: a failed read must never strand a person).
 */
export const deletionLanding = (status: DeletionStatus | null | undefined): DeletionLanding => {
  if (status?.state === "pending") return "restore";
  if (status?.state === "expired") return "deleted-card";
  return null;
};

/** The react-query key both readers share (the sign-in check and /account/restore). */
export const DELETION_STATUS_KEY = "account-deletion-status";

export const fetchDeletionStatus = async (): Promise<DeletionStatus | null> => {
  const { data, error } = await rpc("my_account_deletion_status_v1");
  if (error) throw error;
  return parseDeletionStatus(data);
};

// Defined in lib/accountRouting (import-light, so the sign-in landing can name it); re-exported for existing callers.
export { ACCOUNT_RESTORE_PATH, restorePathFor };

/**
 * The sign-in's deletion check (pages/AuthCallback, which EVERY sign-in passes through, with or
 * without a returnTo): the restore page for a deleted account, else null. Runs before any returnTo
 * is followed, or the sign-in meant to undo a delete would land on a page and leave the account
 * hidden. A failed read is null: it never strands a sign-in.
 */
export const signInDeletionTarget = async (returnTo: string | null): Promise<string | null> => {
  try {
    return deletionLanding(await fetchDeletionStatus()) === null ? null : restorePathFor(returnTo);
  } catch {
    return null;
  }
};

/** my_account_restore_v1 codes (20261122210000): each changes nothing. */
export type RestoreCode = "no_self_delete" | "restore_window_closed" | "admin_archived";
export type RestoreOutcome =
  | { kind: "restored" }
  | { kind: "admin_archived" }
  | { kind: "window_closed"; status: DeletionStatus | null }
  | { kind: "nothing_to_restore" }
  | { kind: "failed" };

export const classifyRestore = (raw: unknown): RestoreOutcome => {
  if (!raw || typeof raw !== "object") return { kind: "failed" };
  const r = raw as Record<string, unknown>;
  if (r.restored === true) return { kind: "restored" };
  if (r.code === "admin_archived") return { kind: "admin_archived" };
  if (r.code === "restore_window_closed") return { kind: "window_closed", status: parseDeletionStatus(raw) };
  if (r.code === "no_self_delete") return { kind: "nothing_to_restore" };
  return { kind: "failed" };
};

export const restoreAccount = async (): Promise<RestoreOutcome> => {
  try {
    const { data, error } = await rpc("my_account_restore_v1");
    if (error) return { kind: "failed" };
    return classifyRestore(data);
  } catch {
    return { kind: "failed" };
  }
};


