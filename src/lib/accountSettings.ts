// Account settings: the thin typed layer over the admin repo's account-lifecycle
// RPCs and the `account-erase` edge function (admin PR #792). The generated types
// do not know them yet, so they go through rpcLoose (DELETE this layer's casts when
// the types regen lands). The shapes below are the pinned interface; nothing else
// in the app reads these responses.
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import { deleteRefusalMessage } from "@/lib/accountDeletionCopy";

/**
 * The `account-erase` edge function's refusal codes (admin #820 handler.ts STATUS_BY_CODE). Here, not in
 * lib/accountDeletion: importing that module from the settings/dancer-app entries split it into a chunk of
 * its own, one more first-load request on /app (perf-budgets.json chunk ratchet).
 */
export type DeleteRefusalCode = "admin_account" | "sole_organiser_owner" | "already_archived" | "rate_limited";
export const DELETE_REFUSAL_CODES: readonly DeleteRefusalCode[] = ["admin_account", "sole_organiser_owner", "already_archived", "rate_limited"];

export const ERASE_CONFIRM_WORD = "DELETE";
/**
 * DELETE in capitals, ignoring stray spaces (a phone keyboard adds one after a word). Still case-sensitive:
 * the field capitalises on phones (autoCapitalize="characters"), and typing the capitals is the deliberate act.
 */
export const canConfirmErase = (typed: string): boolean => typed.trim() === ERASE_CONFIRM_WORD;

/**
 * Audit M4: settings opened from the dancer app (/app/options) carry `?from=app`, so the page can offer
 * "Back to Options". Search-param based (no document.referrer: it is empty after an in-app navigation).
 */
export const FROM_PARAM = "from";
export const FROM_APP = "app";
export const APP_OPTIONS_PATH = "/app/options";
export const BACK_TO_OPTIONS_LABEL = "Back to Options";
export const isFromApp = (search: string): boolean => new URLSearchParams(search).get(FROM_PARAM) === FROM_APP;
/** `path`, keeping the from=app context when the person came from the dancer app. */
export const withFromApp = (path: string, fromApp: boolean): string => (fromApp ? `${path}?${FROM_PARAM}=${FROM_APP}` : path);

export type AccountExport = {
  exported_at: string;
  email: string | null;
  profile: Record<string, unknown> | null;
  roles: Record<string, unknown>;
  ratings: unknown[];
  attendance: unknown[];
};

export type EraseBlocker = { entity_id: string; name: string };
export type EraseCode = "admin_account" | "sole_organiser_owner";
export type EraseCheck = { can_erase: boolean; blockers: EraseBlocker[]; code: EraseCode | null };

/** bachata-calendar-my-data-YYYY-MM-DD.json (the person's local date). */
export const exportFileName = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `bachata-calendar-my-data-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
};

export const fetchAccountExport = async (): Promise<AccountExport> => {
  const { data, error } = await rpcLoose("my_account_export_v1");
  if (error) throw error;
  return data as AccountExport;
};

/** Saves the export as a file on this device (a client-side Blob; nothing is uploaded). */
export const downloadAccountExport = async (): Promise<void> => {
  const data = await fetchAccountExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export type DisableResult = { ok: true; disabled: boolean } | { ok: false; code: "not_authenticated" | "invalid_argument" | "no_profile" | "failed" };
const DISABLE_CODES = new Set(["not_authenticated", "invalid_argument", "no_profile"]);

export const setProfileDisabled = async (disabled: boolean): Promise<DisableResult> => {
  const { data, error } = await rpcLoose("my_profile_disable_v1", { p_disabled: disabled });
  if (error) {
    return { ok: false, code: DISABLE_CODES.has(error.message) ? (error.message as "no_profile") : "failed" };
  }
  return { ok: true, disabled: Boolean((data as { disabled?: boolean } | null)?.disabled) };
};

export const fetchEraseCheck = async (): Promise<EraseCheck> => {
  const { data, error } = await rpcLoose("my_account_erase_check_v1");
  if (error) throw error;
  const d = data as Partial<EraseCheck> | null;
  return { can_erase: d?.can_erase === true, blockers: d?.blockers ?? [], code: d?.code ?? null };
};

/**
 * Delete = hide (admin PR #820): `account-erase` now runs my_account_delete_v1, which
 * hides the person at once and erases nothing. `ok:true` means HIDDEN, never erased.
 */
export type EraseOutcome =
  | { kind: "hidden" }
  | { kind: "refused"; code: DeleteRefusalCode; blockers: EraseBlocker[] }
  | { kind: "failed" };

type ErasePayload = { ok?: boolean; hidden?: boolean; code?: string; blockers?: EraseBlocker[] };

/** Exported for the table-driven tests. A refusal is read by its code, never by the HTTP status alone. */
export const classifyErase = (payload: ErasePayload | null): EraseOutcome => {
  // `hidden` is not required: the #820 function always sends it, and the old erasing one (live until the
  // owner's deploy step, same window as this build) sends only ok:true -- the account is gone from view
  // either way, and "failed" would invite a retry that can only fail.
  if (payload?.ok === true) return { kind: "hidden" };
  const code = payload?.code;
  if (code && (DELETE_REFUSAL_CODES as readonly string[]).includes(code)) {
    return { kind: "refused", code: code as DeleteRefusalCode, blockers: code === "sole_organiser_owner" ? (payload?.blockers ?? []) : [] };
  }
  return { kind: "failed" };
};

/** Hides the account (restorable for 30 days); the edge function runs it as the caller. */
export const eraseAccount = async (): Promise<EraseOutcome> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke("account-erase", { body: { confirm: ERASE_CONFIRM_WORD } });
    if (!error) return classifyErase(data as ErasePayload | null);
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = (await ctx.json().catch(() => null)) as ErasePayload | null;
      return classifyErase(body);
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
};

export type EraseFact = {
  kind: "can_erase" | "admin" | "sole_owner" | "blocked_unknown";
  /** Plain words, shown identically wherever the check is read. */
  text: string;
  blockerNames: string[];
};

/** The ONE reading of the erase check, for the ownership screen, the delete screen and a late 409. */
export const eraseCheckFact = (check: Pick<EraseCheck, "can_erase" | "blockers" | "code">): EraseFact => {
  const names = check.blockers.map((b) => b.name);
  if (check.code === "admin_account") {
    return { kind: "admin", blockerNames: [], text: deleteRefusalMessage("admin_account") };
  }
  if (check.code === "sole_organiser_owner") {
    return { kind: "sole_owner", blockerNames: names, text: deleteRefusalMessage("sole_organiser_owner") };
  }
  if (check.can_erase) return { kind: "can_erase", blockerNames: [], text: "" };
  return { kind: "blocked_unknown", blockerNames: names, text: "This account can't be deleted right now. You can hide your dancer profile instead." };
};
