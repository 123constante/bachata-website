// Lazy, memoised access to the Supabase client.
//
// WHY THIS EXISTS (supabase-defer arc, P1). `vendor-supabase` is 43.3 KB gz and
// sits in home's first-load graph because a handful of modules import the
// generated client statically. This accessor is the enabling primitive for
// moving those edges behind `await import()`: it defers CONSTRUCTION of the
// client to first use and memoises it, so callers share one instance.
//
// It does NOT change the first-load graph by itself. A module that still
// imports `./client` statically keeps its edge; later phases repoint the call
// sites one at a time. This phase only makes that possible and proves the
// primitive works.
//
// STILL EXACTLY ONE CLIENT. The memo is the whole point: SupabaseClient's
// constructor eagerly builds every sub-client, and a second instance on the
// same auth storage key is the "Multiple GoTrueClient instances" token-refresh
// race that src/lib/supabase.ts was collapsed to fix (audit #2).
//
// It lives BESIDE the generated client rather than inside it: client.ts carries
// a "do not edit it directly" banner and is rewritten by regeneration, which
// would silently drop anything added there.

import { safeDynamicImport } from '@/lib/lazyWithRetry';

// Erased at compile time. Importing SupabaseClient from '@supabase/supabase-js'
// in VALUE position would hold open the very module edge this arc exists to cut
// -- the same trap P4 has to avoid with `import { User, Session }`.
type SupabaseClient = (typeof import('./client'))['supabase'];

let pending: Promise<SupabaseClient> | null = null;

/**
 * The shared Supabase client, constructed on first call.
 *
 * The PROMISE is memoised, not the resolved client, so two concurrent callers
 * await a single import instead of racing two constructions.
 *
 * Routed through `safeDynamicImport` because lazyWithRetry.ts is the ONE place
 * that heals a deploy-stale chunk: after Vercel swaps the hashed filenames, a
 * tab left open 404s on the old URL, and only the once-per-session reload in
 * staleChunk.ts recovers it. Clearing the memo alone would just re-request the
 * same dead URL forever -- which from P2 onward, once client.ts is genuinely
 * code-split, would strand a live tab with a client it can never load.
 *
 * Clearing the memo on failure still matters for every OTHER rejection, so a
 * transient error does not cache itself for the rest of the session.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!pending) {
    pending = safeDynamicImport(() => import('./client'))
      .then((m) => {
        // client.ts is regenerated wholesale, and a regeneration that renamed
        // or dropped this export would otherwise memoise `undefined` on a
        // RESOLVED promise -- invisible to the catch below, and surfacing far
        // away as "cannot read properties of undefined (reading 'rpc')".
        if (!m?.supabase) {
          throw new Error(
            'supabase client module resolved without a `supabase` export -- ' +
              'src/integrations/supabase/client.ts was regenerated into a shape ' +
              'this accessor does not recognise.',
          );
        }
        return m.supabase;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
