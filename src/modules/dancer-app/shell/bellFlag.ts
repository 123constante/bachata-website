/**
 * Dancer bell alerts v1 (brief #1938): a bell in the header with a small dropdown of up to
 * five alerts (ticket ready, rate last night). OFF = the header exactly as today and zero
 * extra reads. Turn on with VITE_ENABLE_DANCER_BELL=true (Vercel env). Lives here, not in
 * src/lib/featureFlags.ts: dancer-area PRs may not touch files outside the module.
 */
export const DANCER_BELL_ENABLED: boolean = import.meta.env.VITE_ENABLE_DANCER_BELL === 'true';
