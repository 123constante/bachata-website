/*
 * Door short code + Tonight-list Check in (docs/briefs/ticket-door-code-screen.md), inside the
 * door screen that flags.organiserTicketing already gates. OFF = the door is exactly as before
 * (code box takes the QR token only, list read-only). Turn on with
 * VITE_ENABLE_TICKET_DOOR_CODE=true (Vercel env) -- no code change.
 *
 * Lives here, not in src/lib/featureFlags.ts, on purpose: that module rides in a chunk every
 * route loads, and this flag must add zero bytes outside the lazy door chunk.
 */
export const ticketDoorCode = import.meta.env.VITE_ENABLE_TICKET_DOOR_CODE === 'true';
