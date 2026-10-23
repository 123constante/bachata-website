import { supabase } from '@/integrations/supabase/client';
import { isMissingRpc, parseDryRun, parseDuplicates, parseJoinResult, refusalCode, type DryRun, type DuplicatePair } from './duplicatesModel';
import { JOIN_REFUSAL_COPY } from './duplicatesCopy';

// A2's RPCs are not in the generated Database type (and may not exist yet), so they go through one
// string-named boundary, never an `as never` on the name (check:rpc-typing). Same as invitePersonApi.ts.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

/** Computed live each time the admin page opens (staleTime 0): never a cached count. */
export const DUPLICATES_KEY = ['admin-invitee-duplicates'] as const;

export type DuplicatesAnswer = { kind: 'unavailable' } | { kind: 'ok'; pairs: DuplicatePair[] };

const KNOWN = Object.keys(JOIN_REFUSAL_COPY);

export async function fetchDuplicates(): Promise<DuplicatesAnswer> {
  const { data, error } = await rpc('check_invitee_duplicates_v1');
  if (error) {
    if (isMissingRpc(error)) return { kind: 'unavailable' };
    throw error;
  }
  const pairs = parseDuplicates(data);
  if (!pairs) throw new Error('malformed_duplicates_answer');
  return { kind: 'ok', pairs };
}

const joinArgs = (p: DuplicatePair, dryRun: boolean) => ({ p_keep_profile: p.keepId, p_fold_profile: p.foldId, p_dry_run: dryRun });

/** The dry run: writes nothing on the server; its list is what "What will change" shows. */
export async function previewJoin(p: DuplicatePair): Promise<DryRun> {
  const { data, error } = await rpc('admin_join_duplicate_people_v1', joinArgs(p, true));
  if (error) return { kind: 'refused', code: isMissingRpc(error) ? 'unavailable' : refusalCode(error, KNOWN) ?? 'error' };
  return parseDryRun(data) ?? { kind: 'refused', code: 'error' };
}

/** The real run. Called ONLY from the second confirm ("Yes, join them"). */
export async function joinPeople(p: DuplicatePair): Promise<{ ok: true } | { ok: false; code: string }> {
  const { data, error } = await rpc('admin_join_duplicate_people_v1', joinArgs(p, false));
  if (error) return { ok: false, code: isMissingRpc(error) ? 'unavailable' : refusalCode(error, KNOWN) ?? 'error' };
  return parseJoinResult(data);
}

/** "Not the same person": A2's dismiss table, written through its admin RPC; hidden for good. */
export async function dismissPair(p: DuplicatePair): Promise<{ ok: true } | { ok: false; code: string }> {
  const { error } = await rpc('admin_dismiss_duplicate_pair_v1', { p_keep_profile: p.keepId, p_fold_profile: p.foldId });
  if (error) return { ok: false, code: isMissingRpc(error) ? 'unavailable' : refusalCode(error, KNOWN) ?? 'error' };
  return { ok: true };
}
