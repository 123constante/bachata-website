// Pure model for "Possible duplicates": parsers for A2's two RPCs and the one
// "is this RPC missing?" test that switches the screens to "available soon".
// Copy lives in duplicatesCopy.ts; network calls in duplicatesApi.ts.

/**
 * stub: a login's sign-up profile sits on a team list beside an unclaimed profile the admin made
 * (the Papacito / Jinder shape). not_linked: an invite join was paused because the login did not
 * land on the invited profile (W1 / A2 record it); the invite stays open until this is sorted.
 */
export type DuplicateKind = 'stub' | 'not_linked';

export interface DuplicatePair {
  /** The profile that stays: the one the admin made. */
  keepId: string;
  keepName: string;
  /** The profile folded into it: the sign-up stub. */
  foldId: string;
  foldName: string;
  organiserName: string | null;
  kind: DuplicateKind;
  /** Short facts for the side-by-side cards, as the server words them. */
  keepFacts: string[];
  foldFacts: string[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => s !== null) : []);

/**
 * check_invitee_duplicates_v1 -> a JSON array of pairs, or {pairs: [...]}. Each pair:
 * {keep_profile_id, keep_name, fold_profile_id, fold_name, organiser_name, kind, keep_facts?, fold_facts?}.
 * A row without both ids or with an unknown kind is dropped (never shown half-filled); an answer that
 * is not a list at all is null (the caller shows "did not load", not "no duplicates").
 */
export function parseDuplicates(data: unknown): DuplicatePair[] | null {
  const rows = Array.isArray(data) ? data : Array.isArray((data as { pairs?: unknown } | null)?.pairs) ? (data as { pairs: unknown[] }).pairs : null;
  if (!rows) return null;
  const out: DuplicatePair[] = [];
  for (const raw of rows) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const keepId = str(r.keep_profile_id);
    const foldId = str(r.fold_profile_id);
    const kind = r.kind === 'stub' || r.kind === 'not_linked' ? r.kind : null;
    if (!keepId || !foldId || keepId === foldId || !kind) continue;
    out.push({
      keepId,
      keepName: str(r.keep_name) ?? 'Unnamed profile',
      foldId,
      foldName: str(r.fold_name) ?? 'Unnamed profile',
      organiserName: str(r.organiser_name),
      kind,
      keepFacts: strList(r.keep_facts),
      foldFacts: strList(r.fold_facts),
    });
  }
  return out;
}

export interface ChangeLine {
  kind: string;
  text: string;
}

export type DryRun = { kind: 'changes'; changes: ChangeLine[] } | { kind: 'refused'; code: string };

/** admin_join_duplicate_people_v1(..., p_dry_run => true) -> {changes: [{kind, text}], refused?: code} (COMMON.md). */
export function parseDryRun(data: unknown): DryRun | null {
  const r = (data ?? {}) as Record<string, unknown>;
  const refused = str(r.refused);
  if (refused) return { kind: 'refused', code: refused };
  if (!Array.isArray(r.changes)) return null;
  const changes: ChangeLine[] = [];
  for (const c of r.changes) {
    const text = str((c as { text?: unknown } | null)?.text);
    if (text) changes.push({ kind: str((c as { kind?: unknown }).kind) ?? 'other', text });
  }
  return { kind: 'changes', changes };
}

/** The real run: {refused: code} is a refusal; anything else without one is done. */
export function parseJoinResult(data: unknown): { ok: true } | { ok: false; code: string } {
  const refused = str((data as { refused?: unknown } | null)?.refused);
  return refused ? { ok: false, code: refused } : { ok: true };
}

/** The RPC does not exist yet (A2 not applied): PostgREST PGRST202, Postgres 42883, or HTTP 404. */
export function isMissingRpc(error: unknown): boolean {
  const e = (error ?? {}) as { code?: unknown; status?: unknown; message?: unknown };
  if (e.code === 'PGRST202' || e.code === '42883' || e.status === 404) return true;
  return typeof e.message === 'string' && /could not find the function/i.test(e.message);
}

/** The refusal code in an RPC error (raised as the message), or null. */
export function refusalCode(error: unknown, known: readonly string[]): string | null {
  const text = String((error as { message?: unknown } | null)?.message ?? '');
  return known.find((code) => new RegExp(`(^|[^a-z_])${code}($|[^a-z_])`).test(text)) ?? null;
}
