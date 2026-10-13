// Account settings: the thin typed layer over the admin repo's account-lifecycle
// RPCs and the `account-erase` edge function (admin PR #792). The generated types
// do not know them yet, so they go through rpcLoose (DELETE this layer's casts when
// the types regen lands). The shapes below are the pinned interface; nothing else
// in the app reads these responses.
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { rpcLoose } from "@/integrations/supabase/rpcLoose";

export const ERASE_CONFIRM_WORD = "DELETE";
/** Exactly DELETE: case-sensitive, no padding. */
export const canConfirmErase = (typed: string): boolean => typed === ERASE_CONFIRM_WORD;

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

export type EraseOutcome =
  | { kind: "erased" }
  | { kind: "blocked"; code: EraseCode | null; blockers: EraseBlocker[] }
  | { kind: "media_failed" }
  | { kind: "failed" };

type ErasePayload = { ok?: boolean; code?: string; blockers?: EraseBlocker[] };

const classify = (payload: ErasePayload | null, status: number | null): EraseOutcome => {
  if (payload?.ok === true) return { kind: "erased" };
  if (payload?.code === "media_delete_failed") return { kind: "media_failed" };
  if (status === 409 || payload?.code === "admin_account" || payload?.code === "sole_organiser_owner") {
    const code = payload?.code === "admin_account" || payload?.code === "sole_organiser_owner" ? payload.code : null;
    return { kind: "blocked", code, blockers: payload?.blockers ?? [] };
  }
  return { kind: "failed" };
};

/** The final, irreversible step: the edge function does it all (photo files included). */
export const eraseAccount = async (): Promise<EraseOutcome> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke("account-erase", { body: { confirm: ERASE_CONFIRM_WORD } });
    if (!error) return classify(data as ErasePayload | null, 200);
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = (await ctx.json().catch(() => null)) as ErasePayload | null;
      return classify(body, ctx.status);
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
    return { kind: "admin", blockerNames: [], text: "This is an admin account, so it can't be deleted here. You can still hide your dancer profile instead." };
  }
  if (check.code === "sole_organiser_owner") {
    return {
      kind: "sole_owner",
      blockerNames: names,
      text: "You're the only owner of the organiser page(s) below. Add another owner, or remove the page, then come back to delete your account.",
    };
  }
  if (check.can_erase) return { kind: "can_erase", blockerNames: [], text: "" };
  return { kind: "blocked_unknown", blockerNames: names, text: "This account can't be deleted right now. You can hide your dancer profile instead." };
};
