/**
 * Post-pay read-only teaser (ticket-buyer PR 2). OFF = unchanged. Needs flags.publicTicketing too.
 * Turn on with VITE_ENABLE_TICKET_TEASER=true (Vercel env) -- no code change.
 * Lives here, not in src/lib/featureFlags.ts: dancer-area PRs may not touch files outside the
 * module (scripts/check-dancer-area-isolation.mjs).
 */
export const TICKET_TEASER_ENABLED: boolean = import.meta.env.VITE_ENABLE_TICKET_TEASER === 'true';
