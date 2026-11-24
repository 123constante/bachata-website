/**
 * Dancer level retired (owner clicks 2026-11-24, brief level-retire-web-a1). OFF = today's screens
 * unchanged. Turn on with VITE_ENABLE_LEVEL_RETIRED=true (Vercel env). Same convention as
 * onboarding/onboardingV3Flag.ts.
 */
export const LEVEL_RETIRED_ENABLED: boolean = import.meta.env.VITE_ENABLE_LEVEL_RETIRED === 'true';
