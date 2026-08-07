// Load-bearing: keeps the Supabase client's construction EAGER on the auth path.
//
// WHY THIS EXISTS (supabase-defer arc, P5). `client.ts` sets
// `detectSessionInUrl: true`, so auth-js parses the magic-link fragment at
// CONSTRUCTION. The whole arc defers construction behind `getSupabase()`, and a
// deferred construction on `/auth/callback` would move that parse after the
// router has mounted -- if anything replaces the URL first, the session is lost
// silently and AuthCallback's 9s fallback tells a correctly-authenticated user
// their link expired.
//
// The auth routes live on the CATCHALL (`app/routes/catchall.tsx` ->
// AnimatedRoutes), not on a framework route, so this module is imported there:
// that puts `client.ts` in the catchall's first-load static graph, which is
// what makes construction happen during initial module evaluation, before
// hydration and before any navigation can rewrite the URL.
//
// MEASURED, not assumed (2026-08-06, at ebc67e8): before this file existed the
// same edge was already present -- but only by ACCIDENT, via two unconverted
// static importers, `src/components/auth/AuthGuard.tsx` (bundled into the
// AnimatedRoutes chunk) and `src/components/ListingRequestForm.tsx` (via the
// `@/lib/supabase` re-export, bundled into ComingSoonGate). Converting either
// to `getSupabase()` -- which is exactly what the arc's remaining phase is for
// -- would have silently removed eager construction from the auth path with no
// test failing. This file makes the edge INTENTIONAL so those two can be
// converted freely, and `perf-budgets.json`'s `requiredFirstLoad` section makes
// it GUARDED so it cannot be deleted without CI going red.
//
// DO NOT convert this import to `getSupabase()`. A dynamic import is a network
// round trip, and the race it opens is precisely the failure this prevents.
import { supabase } from '@/integrations/supabase/client';

/**
 * The eagerly-constructed client.
 *
 * The import site (`app/routes/catchall.tsx`) takes this module as a BARE
 * side-effect import, and that this survives tree-shaking was measured rather
 * than assumed: with the two accidental importers above temporarily severed,
 * a rebuild showed `catchall` as the ONLY remaining static importer of
 * client.ts and the edge still present. That experiment is the one that
 * matters, because the accidental edges mask this one by construction -- the
 * emitted entry chunk hoists its whole closure's imports, so simply seeing
 * `import "./client-*.js"` in the built chunk proves nothing about who holds
 * the edge.
 *
 * The export is kept as the named, greppable handle for that intent.
 */
export const eagerAuthClient = supabase;
