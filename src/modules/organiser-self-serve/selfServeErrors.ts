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

/**
 * Series and date commands (W4/W5: series_command_p5, occurrence_command_p5,
 * admin_event_workspace_p5). Unlike the D4 RPCs these raise a prefixed
 * message, often with detail after it ("permission_denied: occurrence.cancel
 * needs a reason that is a cancellation_reasons label"), so the copy is chosen
 * by matching the message, most specific first. Raw server text is never
 * shown: anything unmatched gets the generic line.
 */
export const COMMAND_COPY: Array<{ match: RegExp; message: string }> = [
  { match: /^version_conflict/, message: 'This changed somewhere else after you opened it. We have reloaded it; check it and save again.' },
  { match: /on a past date is admin-only|^past_date/, message: 'That date has already happened, so it can no longer be changed.' },
  { match: /^has_bookings/, message: 'People have already booked this date, so it cannot be removed. Cancel it instead, so they see why.' },
  { match: /^no_sessions_for_time_override/, message: 'This date has no session times to move yet. Ask the Bachata Calendar team to set up the class times.' },
  { match: /cancellation_reasons label/, message: 'Choose a reason. Dancers see it.' },
  { match: /must be blank or an http\(s\) URL|must be null or an array of http\(s\) URLs/, message: 'Enter a full link starting with https://.' },
  { match: /description is longer than/, message: 'Keep the note under 4,000 characters.' },
  { match: /must name an existing venue/, message: 'That venue is not on Bachata Calendar yet.' },
  { match: /default_duration_minutes/, message: 'The end time must be after the start, and within 20 hours.' },
  { match: /must be a HH:MM time|must be blank or a HH:MM time/, message: 'Enter the time as hours and minutes, like 19:30.' },
  { match: /date must be a YYYY-MM-DD date/, message: 'Choose a date.' },
  { match: /is not an owner transition|^lifecycle_transition_denied/, message: 'That status change is not available for this event right now.' },
  { match: /is not a date the recurrence rule/, message: 'The weekly pattern changed since this date was taken off, so it cannot be put back as a break. Add it as a date instead.' },
  { match: /is not a break on series/, message: 'That date is already back on the list. Reload the page.' },
  { match: /^publish_blocked/, message: 'This event needs more details before it can go live again. Ask the Bachata Calendar team.' },
  { match: /^invalid_payload: name required/, message: 'Enter the event name.' },
  { match: /^(not_found|series_not_found)/, message: 'This date or event no longer exists. Reload the page.' },
  { match: /^permission_denied/, message: 'You cannot make that change here. Ask the Bachata Calendar team.' },
];

export function commandErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : null;
  if (typeof message === 'string') {
    const text = message.trim();
    const hit = COMMAND_COPY.find((c) => c.match.test(text));
    if (hit) return hit.message;
  }
  return GENERIC.message;
}

export const isVersionConflict = (error: unknown) =>
  !!error && typeof error === 'object' && /^version_conflict/.test(String((error as { message?: unknown }).message ?? ''));
