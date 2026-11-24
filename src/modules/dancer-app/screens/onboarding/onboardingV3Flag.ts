/**
 * Dancer onboarding v3 (owner pick, brief dancer-onboarding-v3-s1): the new post-code
 * flow (roles, styles, years, partner, photo, bio). OFF = today's onboarding, byte for byte.
 * Turn on with VITE_ENABLE_DANCER_ONBOARDING_V3=true (Vercel env) -- no code change.
 * Lives here, not in src/lib/featureFlags.ts: dancer-area PRs may not touch files outside
 * the module (scripts/check-dancer-area-isolation.mjs).
 */
export const DANCER_ONBOARDING_V3_ENABLED: boolean = import.meta.env.VITE_ENABLE_DANCER_ONBOARDING_V3 === 'true';
