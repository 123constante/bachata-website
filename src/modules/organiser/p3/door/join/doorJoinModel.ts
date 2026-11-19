/*
 * The door invite link (organiser R4 slice a): what the accept page at /door/join/:token shows,
 * and what the R4 "Copy door invite link" button says. Pure: no React, no network.
 *
 * Server truth (prod, authenticated only):
 *   ticket_door_seat_accept_v1(p_token) -> { result, event_series_id, expires_at }
 *     result: ok | unknown_invite | invite_ended | invite_used | seat_revoked | profile_incomplete
 *   ticket_door_seat_invite_v1(p_event_series_id, p_occurrence_id) -> { result, token, expires_at }
 *     result: ok | not_allowed | organiser_ambiguous | occurrence_not_live | occurrence_ended
 * The raw token (64 hex) is returned ONCE by the invite call; only its hash is stored.
 * There is no anon preview of a door link, so a signed-out visitor is told to sign in without
 * naming the event: the page cannot know it until the accept call runs.
 */

/** Door base: the seat-only door screen and the accept page live outside the organiser area. */
export const DOOR_BASE = '/door';
export const DOOR_PATHS = {
  join: (token: string) => `${DOOR_BASE}/join/${encodeURIComponent(token)}`,
  /** The bare accept path the address bar is left on once a token has been used up. */
  joinDone: `${DOOR_BASE}/join`,
  seat: (seriesId: string) => `${DOOR_BASE}/${encodeURIComponent(seriesId)}`,
} as const;

/** ticket_door_seat_invite_v1 mints encode(gen_random_bytes(32), 'hex'). */
export const DOOR_TOKEN_RE = /^[0-9a-f]{64}$/;

export type AcceptResult = 'ok' | 'unknown_invite' | 'invite_ended' | 'invite_used' | 'seat_revoked' | 'profile_incomplete';
export interface AcceptAnswer { result: AcceptResult; seriesId: string | null; expiresAt: string | null }

const ACCEPT_RESULTS: readonly AcceptResult[] = ['ok', 'unknown_invite', 'invite_ended', 'invite_used', 'seat_revoked', 'profile_incomplete'];

/** Anything the server sends that is not a known answer is an error (the page offers Try again). */
export function parseAccept(raw: unknown): AcceptAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const result = ACCEPT_RESULTS.find((r) => r === o.result);
  if (!result) return null;
  const seriesId = typeof o.event_series_id === 'string' && o.event_series_id ? o.event_series_id : null;
  if (result === 'ok' && !seriesId) return null;
  return { result, seriesId, expiresAt: typeof o.expires_at === 'string' ? o.expires_at : null };
}

export type JoinStep =
  | 'bad_link' | 'checking' | 'signed_out' | 'accepting' | 'ok' | 'ended' | 'used' | 'revoked' | 'profile' | 'error';

export interface JoinIn {
  tokenValid: boolean;
  auth: 'resolving' | 'signed_out' | 'signed_in';
  /** The accept call: not run yet, running, answered, or failed (network / unknown answer). */
  accept: 'idle' | 'running' | 'failed' | AcceptAnswer;
}

export function joinStepOf(i: JoinIn): JoinStep {
  if (!i.tokenValid) return 'bad_link';
  if (i.auth === 'resolving') return 'checking';
  if (i.auth === 'signed_out') return 'signed_out';
  if (i.accept === 'idle' || i.accept === 'running') return 'accepting';
  if (i.accept === 'failed') return 'error';
  switch (i.accept.result) {
    case 'ok': return 'ok';
    case 'unknown_invite':
    case 'invite_ended': return 'ended';
    case 'invite_used': return 'used';
    case 'seat_revoked': return 'revoked';
    case 'profile_incomplete': return 'profile';
  }
}

export const DOOR_JOIN_COPY = {
  title: 'Door invite',
  signedOut: 'Sign in to open the door for this night.',
  signedOutWhy: 'This link gives you the door screen for one night: Scan and Search, names only. After you sign in you come straight back here.',
  signIn: 'Sign in',
  checking: 'Checking your sign-in…',
  accepting: 'Opening the door…',
  ok: 'You are on the door.',
  okUntil: (when: string) => `Access ends ${when}.`,
  openDoor: 'Open the door screen',
  ended: 'This link has stopped working. Ask the organiser for a new one.',
  used: 'Someone else has already used this link. Each link works for one person. Ask the organiser for a new one.',
  revoked: 'The organiser has taken you off the door for this night. Ask them if you think this is a mistake.',
  profile: 'Add your name first, so the organiser knows who is on the door. It takes a minute, then you come back here.',
  finishProfile: 'Add your name',
  error: 'We couldn’t open the door. Check your connection and try again.',
  retry: 'Try again',
  home: 'Go to Bachata Calendar',
} as const;

/** "Saturday 21 November, 11:30am" in London time, or null when the server sent nothing readable. */
export function accessEndsWord(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).replace(',', '');
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }).replace(' ', '').replace(':00', '').toLowerCase();
  return `${day}, ${time}`;
}

/* ---------------- The organiser side: minting a link ---------------- */

export type MintResult = 'ok' | 'not_allowed' | 'organiser_ambiguous' | 'occurrence_not_live' | 'occurrence_ended';
export interface MintAnswer { result: MintResult; token: string | null; expiresAt: string | null }
const MINT_RESULTS: readonly MintResult[] = ['ok', 'not_allowed', 'organiser_ambiguous', 'occurrence_not_live', 'occurrence_ended'];

export function parseMint(raw: unknown): MintAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const result = MINT_RESULTS.find((r) => r === o.result);
  if (!result) return null;
  const token = typeof o.token === 'string' && DOOR_TOKEN_RE.test(o.token) ? o.token : null;
  if (result === 'ok' && !token) return null;
  return { result, token, expiresAt: typeof o.expires_at === 'string' ? o.expires_at : null };
}

export const DOOR_MINT_WHY: Record<Exclude<MintResult, 'ok'>, string> = {
  not_allowed: 'Only the owner or a manager of the page that sells tickets for this event can make a door link.',
  organiser_ambiguous: 'This event is sold by more than one organiser page, so we can’t tell whose door this is. Ask us to sort it out.',
  occurrence_not_live: 'We can\u2019t tell when this night starts, so the link would have no end. Add a start time to the night first.',
  occurrence_ended: 'This night has ended. Pick a night coming up.',
};
export const DOOR_MINT_FAILED = 'We couldn’t make the link. Nothing was changed. Try again.';
