/**
 * Dancer layout C (owner pick 2026-11-20, brief dancer-layout-c-s1): Home grouped under
 * Get ready / Go out / Be found. OFF = today's Home (the A/B flag decides, unchanged).
 * ON = layout C, built on the Option B view, and it wins over DANCER_DASH_B_ENABLED.
 * Turn on with VITE_ENABLE_DANCER_LAYOUT_C=true (Vercel env) -- no code change.
 * Lives here, not in src/lib/featureFlags.ts: dancer-area PRs may not touch files outside
 * the module (scripts/check-dancer-area-isolation.mjs).
 */
export const DANCER_LAYOUT_C_ENABLED: boolean = import.meta.env.VITE_ENABLE_DANCER_LAYOUT_C === 'true';
