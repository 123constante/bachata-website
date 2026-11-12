/**
 * Dancer Home Option B (queue-website#1534). OFF = the current Option A Home.
 * Turn on with VITE_ENABLE_DANCER_DASH_B=true (Vercel env) -- no code change.
 * Lives here, not in src/lib/featureFlags.ts: dancer-area PRs may not touch files outside
 * the module (scripts/check-dancer-area-isolation.mjs).
 */
export const DANCER_DASH_B_ENABLED: boolean = import.meta.env.VITE_ENABLE_DANCER_DASH_B === 'true';
