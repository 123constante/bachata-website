/**
 * Where a brand-new organiser starts in P3: an import-free leaf. lib/accountRouting needs it, and
 * importing it from lib/auth-otp-routing drags contactLinks -> featureFlags (Vite env) into every
 * Node-side importer; the phone suite imports accountRouting that way (selfServeErrors).
 * Asserted equal to P3_PATHS.start in newOrganiserLanding.test.ts.
 */
export const P3_START_PATH = '/account/p3/start';
