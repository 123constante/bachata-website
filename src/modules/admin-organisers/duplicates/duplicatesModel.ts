// Pure model for "Possible duplicates": parsers for A2's RPCs and the one
// "is this RPC missing?" test that switches the screens to "available soon".
// Copy lives in duplicatesCopy.ts; network calls in duplicatesApi.ts.
// Contract: bachata-admin claude/invite-a2-identity-join, migrations 20261205330000 and 20261205340000.

/**
 * A team_stub pair (the server's only pair kind, shown as 'stub'): a login's sign-up profile sits on a team
 * list beside an unclaimed profile the admin made (the Papacito / Jinder shape).
 */
export type DuplicateKind = 'stub';

export interface DuplicatePair {
  /** The profile that stays: the one the admin made (premade_profile_id). */
  keepId: string;
  /** null = the profile has no name yet (the RPC's "(no name)" text never leaves the parser). */
  keepName: string | null;
  /** The profile folded into it: the sign-up stub (login_profile_id). */
  foldId: string;
  foldName: string | null;
  organiserId: string | null;
  organiserName: string | null;
  kind: DuplicateKind;
}

/**
 * A paused invite join (redeem outcome not_linked): NOT a pair. It has nothing to join on its own; it is
 * counted in the alert and shown as its own row, with a Review button only when a pair for the same
 * invited profile is listed (`pair`).
 */
export interface PausedJoin {
  inviteId: string;
  organiserName: string | null;
  personProfileId: string | null;
  personLabel: string | null;
  attemptedAt: string | null;
  pair: DuplicatePair | null;
}

export interface DuplicatesList {
  pairs: DuplicatePair[];
  notLinked: PausedJoin[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/**
 * A profile label from check_invitee_duplicates_v1. A profile with no name comes back as the literal text
 * "(no name)" (or, defensively, null / empty / whitespace); all of those become null = "no name yet".
 */
export const labelOf = (v: unknown): string | null => {
  const s = str(v);
  return s && !/^\(?\s*no name\s*\)?$/i.test(s) && !/^unnamed profile$/i.test(s) ? s : null;
};
const rowsOf = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map((r) => (r ?? {}) as Record<string, unknown>) : []);

/**
 * check_invitee_duplicates_v1() -> {healthy, count, pairs: [{organiser_id, organiser_name, login_profile_id,
 * login_label, premade_profile_id, premade_label, kind: 'team_stub'}], not_linked_count, not_linked: [{invite_id,
 * organiser_id, organiser_name, user_id, person_profile_id, person_label, attempted_at}], dismissed_count,
 * measured_as, checked_at}. A pair without both ids or with an unknown kind is dropped (never shown half-filled);
 * an answer without a `pairs` list is null (the caller shows "did not load", not "no duplicates").
 */
export function parseDuplicates(data: unknown): DuplicatesList | null {
  const d = (data ?? {}) as { pairs?: unknown; not_linked?: unknown };
  if (!Array.isArray(d.pairs)) return null;
  const pairs: DuplicatePair[] = [];
  for (const r of rowsOf(d.pairs)) {
    const keepId = str(r.premade_profile_id);
    const foldId = str(r.login_profile_id);
    if (!keepId || !foldId || keepId === foldId || r.kind !== 'team_stub') continue;
    pairs.push({
      keepId,
      keepName: labelOf(r.premade_label),
      foldId,
      foldName: labelOf(r.login_label),
      organiserId: str(r.organiser_id),
      organiserName: str(r.organiser_name),
      kind: 'stub',
    });
  }
  const notLinked: PausedJoin[] = [];
  for (const r of rowsOf(d.not_linked)) {
    const inviteId = str(r.invite_id);
    if (!inviteId) continue;
    const personProfileId = str(r.person_profile_id);
    const organiserId = str(r.organiser_id);
    notLinked.push({
      inviteId,
      organiserName: str(r.organiser_name),
      personProfileId,
      personLabel: labelOf(r.person_label),
      attemptedAt: str(r.attempted_at),
      pair: (personProfileId && pairs.find((p) => p.keepId === personProfileId && (!organiserId || !p.organiserId || p.organiserId === organiserId))) || null,
    });
  }
  // Pairs with a nameless side go last (stable otherwise).
  const nameless = (p: DuplicatePair) => (p.keepName === null || p.foldName === null ? 1 : 0);
  pairs.sort((a, b) => nameless(a) - nameless(b));
  return { pairs, notLinked };
}

/** The server's change lines quote labels; a quoted "(no name)" reads as "the profile with no name yet". */
const noNameYet = (t: string): string =>
  t.replace(/^"\(no name\)"/i, 'The profile with no name yet').replace(/"\(no name\)"/gi, 'the profile with no name yet');

export interface ChangeLine {
  kind: string;
  text: string;
}

export type DryRun = { kind: 'changes'; changes: ChangeLine[] } | { kind: 'refused'; code: string };

/**
 * admin_join_duplicate_people_v1(..., p_dry_run => true) -> {changes: [{kind, text}], applied, refused?, already_done?}.
 * already_done (the two are one profile already) is shown as a refusal: there is nothing to join.
 */
export function parseDryRun(data: unknown): DryRun | null {
  const r = (data ?? {}) as Record<string, unknown>;
  const refused = str(r.refused);
  if (refused) return { kind: 'refused', code: refused };
  if (r.already_done === true) return { kind: 'refused', code: 'already_done' };
  if (!Array.isArray(r.changes)) return null;
  const changes: ChangeLine[] = [];
  for (const c of r.changes) {
    const raw = str((c as { text?: unknown } | null)?.text);
    const text = raw && noNameYet(raw);
    if (text) changes.push({ kind: str((c as { kind?: unknown }).kind) ?? 'other', text });
  }
  return { kind: 'changes', changes };
}

/** The real run: {refused: code} is a refusal; {already_done: true} or {applied: true} is done. */
export function parseJoinResult(data: unknown): { ok: true } | { ok: false; code: string } {
  const r = (data ?? {}) as Record<string, unknown>;
  const refused = str(r.refused);
  if (refused) return { ok: false, code: refused };
  return r.applied === true || r.already_done === true ? { ok: true } : { ok: false, code: 'error' };
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
