/**
 * ONE switch for the public "I'm Going / Interested" (check-in) control.
 *
 * Off (owner decision 2026-10-18): nothing visible happens when a visitor taps
 * (3 attendance rows in prod, "who is going" is shown nowhere) and the
 * profile-completeness lock is client-side only. Code, RPCs, tables and hooks
 * are kept; only the surfaces stop rendering.
 *
 * Turn it on only when ALL three hold:
 *   1. dancers are shown somewhere ("who is going" is visible to visitors);
 *   2. the lock is enforced server-side (the RPC checks profile completeness);
 *   3. the "Going next" opt-in exists for dancers.
 */
export const GOING_CHECKIN_ENABLED = false;
