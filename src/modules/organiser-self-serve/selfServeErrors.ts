/**
 * Refusal codes raised by the organiser self-serve RPCs (admin repo, Lever 2
 * D4: claim_organiser_v1, request_organiser_access_v1,
 * create_organiser_profile_v1, list_organiser_access_requests_v1, and the
 * shared _caller_proven_email_p5 helper). Each RPC refuses with
 * `RAISE EXCEPTION '<code>'`, which PostgREST returns as `error.message`.
 *
 * The UI shows the copy for a KNOWN code and a generic line for anything
 * else, so a new server refusal degrades to "something went wrong" rather
 * than leaking raw text.
 */

export type SelfServeNextStep = 'request_access' | 'reauth' | 'sign_in' | null;

export interface SelfServeErrorCopy {
  message: string;
  /** What the screen should offer next, if anything. */
  next: SelfServeNextStep;
}

const COPY: Record<string, SelfServeErrorCopy> = {
  authentication_required: { message: 'Please sign in first.', next: 'sign_in' },
  // D-7: a claim (or an own contact email) needs a session that proved the
  // mailbox -- a magic link or a 6-digit code, not a password.
  mailbox_unproven: {
    message: 'First confirm this email is yours with a 6-digit code.',
    next: 'reauth',
  },
  auth_user_email_missing: {
    message: 'Your account has no email address, so it cannot claim a listing.',
    next: 'request_access',
  },
  organiser_id_required: { message: 'Choose an organiser first.', next: null },
  organiser_not_found: { message: 'That organiser no longer exists.', next: null },
  not_live: { message: 'That organiser is not listed publicly yet.', next: null },
  organiser_already_claimed: {
    message: 'Someone already manages this organiser. Ask them to add you, or request access.',
    next: 'request_access',
  },
  no_contact_email: {
    message: 'This listing has no contact email to check against. Request access instead.',
    next: 'request_access',
  },
  email_mismatch: {
    message:
      "This listing has a different contact email. Tell us who you are and the Bachata Calendar team will check.",
    next: 'request_access',
  },
  already_member: { message: 'You already help run this organiser.', next: null },
  message_too_long: { message: 'Keep your note under 500 characters.', next: null },
  message_invalid: { message: 'Your note contains characters we cannot accept.', next: null },
  request_already_open: {
    message: 'You already asked for access to this organiser. We will get back to you.',
    next: null,
  },
  request_limit_reached: {
    message: 'You have too many open requests. Wait for an answer on one of them first.',
    next: null,
  },
  name_required: { message: 'Enter the organiser name.', next: null },
  name_too_long: { message: 'Keep the name under 80 characters.', next: null },
  name_invalid: { message: 'The name contains characters we cannot accept.', next: null },
  city_required: { message: 'Choose a city.', next: null },
  city_not_found: { message: 'That city is not in our list.', next: null },
  contact_email_not_own: {
    message: 'The contact email must be the one you signed in with.',
    next: null,
  },
  invalid_instagram: { message: 'Enter an Instagram handle or a full https:// link.', next: null },
  invalid_website: { message: 'Enter a full website address starting with https://.', next: null },
  organiser_name_taken: {
    message: 'An organiser with this name is already listed. Find it above and claim it or request access.',
    next: null,
  },
  draft_limit_reached: {
    message: 'You already have three organisers waiting. Finish or remove one first.',
    next: null,
  },
};

const GENERIC: SelfServeErrorCopy = {
  message: 'Something went wrong. Please try again.',
  next: null,
};

/** The refusal code carried by an RPC error, or null when there is none. */
export function selfServeErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return null;
  const code = message.trim();
  return /^[a-z_]+$/.test(code) ? code : null;
}

export function selfServeErrorCopy(error: unknown): SelfServeErrorCopy {
  const code = selfServeErrorCode(error);
  return (code && COPY[code]) || GENERIC;
}

/** Exposed for the spec that pins every code the server can raise. */
export const KNOWN_SELF_SERVE_CODES = Object.keys(COPY);
