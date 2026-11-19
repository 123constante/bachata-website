/*
 * The door invite link's paths (organiser R4 slice a), in one place: the accept page, the seat-only
 * door screen, the R4 invite page and the sign-in return rule all build or judge them from here.
 * Lives in lib (not the organiser module) so auth routing can read it without pulling that module in.
 */
export const DOOR_BASE = '/door';
/** ticket_door_seat_invite_v1 mints encode(gen_random_bytes(32), 'hex'). */
export const DOOR_TOKEN_RE = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DOOR_PATHS = {
  join: (token: string) => `${DOOR_BASE}/join/${encodeURIComponent(token)}`,
  /** The bare accept path the address bar is left on once a token has been used up. */
  joinDone: `${DOOR_BASE}/join`,
  seat: (seriesId: string) => `${DOOR_BASE}/${encodeURIComponent(seriesId)}`,
} as const;

/** The full link an organiser sends. */
export const doorInviteUrl = (origin: string, token: string) => `${origin}${DOOR_PATHS.join(token)}`;

/** A door link or a seat-only door screen: a sign-in or sign-up comes back to it whatever the organiser flags. */
export function isDoorReturnTo(returnTo: string): boolean {
  const m = /^\/door\/(?:join\/([^/?#]+)|([^/?#]+))$/.exec(returnTo);
  if (!m) return false;
  return m[1] !== undefined ? DOOR_TOKEN_RE.test(m[1]) : UUID_RE.test(m[2]) ;
}
