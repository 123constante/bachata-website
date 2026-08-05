// Loosely-typed RPC calls through the lazy client.
//
// TEMPORARY BY DESIGN. These RPCs ship from the admin repo and are not in the
// generated Database types yet, so they cannot be called by name without a cast.
// When they land in types.ts this helper should be DELETED and its callers moved
// to the typed `supabase.rpc(...)`, not extended -- it exists to hold one cast
// in one place, not to become the house way of calling RPCs.
//
// It was extracted during the supabase-defer arc (P1): converting the two
// module-scope `supabase.rpc.bind(supabase)` blockers turned a 2-line binding
// into a 9-line async wrapper, duplicated byte-for-byte in two modules.

import { getSupabase } from './getSupabase';

export type RpcResult = { data: unknown; error: { message: string } | null };

/** Call an RPC the generated types do not know about yet. */
export async function rpcLoose(
  fn: string,
  args?: Record<string, unknown>,
): Promise<RpcResult> {
  const supabase = await getSupabase();
  return (
    supabase.rpc as unknown as (
      f: string,
      a?: Record<string, unknown>,
    ) => Promise<RpcResult>
  )(fn, args);
}
