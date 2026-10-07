/**
 * Refusal codes raised by the organiser self-serve RPCs (admin repo, Lever 2
 * D4: claim_organiser_v1, request_organiser_access_v1,
 * create_organiser_profile_v1, list_organiser_access_requests_v1, and the
 * shared _caller_proven_email_p5 helper; D6: submit_organiser_profile_v1). Each RPC refuses with
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
  // mailbox -- a magic link or an emailed code, not a password.
  mailbox_unproven: {
    message: 'First confirm this email is yours with the code from your email.',
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
  // D6 submit_organiser_profile_v1.
  not_authorised: {
    message: 'Only an owner or manager of this organiser can send it for review.',
    next: null,
  },
  // Raised for every lifecycle outside draft and rejected (pending_review, live,
  // paused, ended, archived). The home reloads on it (useSendForReview).
  invalid_state: {
    message: 'Nothing to send: this organiser is already in review, live, or no longer active.',
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
  // D8: a reason only goes with a cancelled date (an un-cancel in another tab, then a stale reason save).
  { match: /cancellation_reason_label needs a cancelled date/, message: 'A reason only shows on a cancelled date. This date is not cancelled, so there is nothing to explain.' },
  // D8: the price list and the Instagram link (series.upsert default_passes / instagram_url).
  { match: /series\.upsert default_passes/, message: 'Check the prices: up to 10, each with a name and a price like 12 or 12.50.' },
  { match: /instagram_url must be blank or an instagram\.com link/, message: 'Enter an Instagram link, like https://www.instagram.com/yourname.' },
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
  // W3, the create (admin D3/D7 refusals on series.upsert (create) and series.set_recurrence).
  { match: /\(create\) needs a live organiser/, message: 'Your organiser is not public yet. Once the Bachata Calendar team approves it you can add events.' },
  { match: /naming one organiser the caller owns or manages/, message: 'Choose one of your organisers.' },
  { match: /category must be party, class or workshop|category on a live series is admin-only/, message: 'That kind of event cannot be set here. Ask the Bachata Calendar team.' },
  { match: /format must be one_off or recurring/, message: 'Choose a party or a weekly class.' },
  { match: /default_start_date cannot be set to a past date|end\.date must not be before today/, message: 'Choose a date from today on.' },
  { match: /^permission_denied: series\.set_recurrence/, message: 'The weekly pattern could not be saved. Pick one weekday and a first date from today on.' },
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

/**
 * True when the SERVER answered with a refusal (PostgREST carries the SQLSTATE in
 * `code`, P0001 for every RAISE). A dropped connection reaches supabase-js as a
 * fetch error with an empty code: the write may or may not have landed.
 */
export const isServerRefusal = (error: unknown) =>
  !!error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string' && (error as { code: string }).code.trim() !== '';

export const isVersionConflict = (error: unknown) =>
  !!error && typeof error === 'object' && /^version_conflict/.test(String((error as { message?: unknown }).message ?? ''));

/**
 * The team page (W6): remove_organiser_member_v1 (admin D7, 20261109140000)
 * and the access-request reads and decisions (D4, 20261108220000:
 * list_organiser_access_requests_v1, resolve_organiser_access_request_v1).
 * Bare codes like the D4 RPCs above. Kept apart from COPY because
 * `not_authorised` means something different here (an owner-only move) than
 * on the other RPCs that raise it.
 */
export const TEAM_COPY: Record<string, string> = {
  authentication_required: 'Please sign in first.',
  organiser_id_required: 'Choose an organiser first.',
  user_id_required: 'Choose who to remove first.',
  not_authorised: 'Only an owner of this organiser can do that. As a manager you can leave the team.',
  organiser_not_found: 'That organiser no longer exists.',
  not_a_member: 'That person is no longer on the team. Reload the page.',
  cannot_remove_owner: 'Another owner cannot be removed here. They can leave themselves, or ask the Bachata Calendar team.',
  last_owner: 'You are the only owner, so you cannot leave. Ask the Bachata Calendar team to add another owner first.',
  request_id_required: 'Choose a request first.',
  invalid_decision: 'Something went wrong. Please try again.',
  invalid_member_role: 'Something went wrong. Please try again.',
  request_not_found: 'That request no longer exists. Reload the page.',
  request_not_open: 'That request was already answered. Reload the page.',
  note_too_long: 'Keep the note under 500 characters.',
  note_invalid: 'The note contains characters we cannot accept.',
  invalid_scope: 'Something went wrong. Please try again.',
};

export function teamErrorMessage(error: unknown): string {
  const code = selfServeErrorCode(error);
  return (code && TEAM_COPY[code]) || GENERIC.message;
}

/** Exposed for the spec that pins every code the D7 / D4 team RPCs can raise. */
export const KNOWN_TEAM_CODES = Object.keys(TEAM_COPY);

/**
 * The programme of one date (admin 20261109560000,
 * organiser_set_occurrence_programme_v1 / organiser_get_occurrence_programme_v1).
 * Prefixed messages like the P5 commands, some naming the 0-based payload index
 * of the session at fault ("invalid_payload: session 2 title is required").
 * Raw server text is never shown. `reload` marks the refusals that mean the
 * screen is out of date with the server: the editor reloads the programme.
 */
export const PROGRAMME_VERSION_CONFLICT = 'This date was changed elsewhere. Reload to see the latest.';

export const PROGRAMME_COPY: Array<{ match: RegExp; message: string; reload?: boolean }> = [
  { match: /^version_conflict/, message: PROGRAMME_VERSION_CONFLICT, reload: true },
  { match: /^permission_denied: authentication_required/, message: 'Please sign in again.' },
  { match: /occurrence not found or caller is not an owner or manager/, message: 'You cannot change this date. It may have been removed, or you are no longer on this event’s team.' },
  { match: /on a past date is admin-only/, message: 'This date has already happened, so its programme can no longer be changed.', reload: true },
  { match: /on an ended or archived series is admin-only/, message: 'This event has ended or is archived, so its programme cannot be changed here.', reload: true },
  { match: /on a cancelled date is not allowed/, message: 'This date is cancelled, so its programme cannot be changed.', reload: true },
  { match: /on a multi-day event is not supported/, message: 'This event runs over more than one day. Ask the Bachata Calendar team to change its programme.', reload: true },
  { match: /type is admin-only on an existing session/, message: 'Only the Bachata Calendar team can change the kind of an existing session.' },
  { match: /programme_incomplete|names a session that is not on this date|repeats a session already listed/, message: 'The programme of this date has changed since you opened it. Reload to see the latest.', reload: true },
  { match: /title is required/, message: 'Every session needs a name.' },
  { match: /title is longer than/, message: 'Keep each session name to 120 characters or fewer.' },
  { match: /title must be a single line/, message: 'Keep each session name on one line.' },
  { match: /title must not contain < or >/, message: 'A session name cannot contain < or >.' },
  { match: /needs both start_time and end_time/, message: 'Each session needs a start time and an end time.' },
  { match: /end_time must differ from start_time/, message: 'The end time must be different from the start time.' },
  { match: /must last between 5 minutes and 12 hours/, message: 'A session must last between 5 minutes and 12 hours.' },
  { match: /must each be a HH:MM time/, message: 'Enter the times as hours and minutes, like 19:30.' },
  { match: /ends_next_day/, message: 'Check the times. A session that ends at or before its start time finishes after midnight.' },
  { match: /level_keys/, message: 'Choose levels from the list.' },
  { match: /type must be class, masterclass, party or performance/, message: 'Choose what kind of session each new one is.' },
  { match: /date-only sessions/, message: 'A date can hold up to 20 sessions added just for that date.' },
  { match: /a date holds at most \d+ sessions/, message: 'A date can hold up to 40 sessions.' },
  { match: /would span more than 20 hours/, message: 'The programme of this date would run for more than 20 hours. Check the times.' },
  { match: /sessions holds more than|sessions is larger than/, message: 'This programme is too large to save here. Ask the Bachata Calendar team.' },
  { match: /^permission_denied/, message: 'You cannot make that change here. Ask the Bachata Calendar team.' },
];

export interface ProgrammeErrorCopy {
  message: string;
  /** 0-based index into the payload the server named, so the screen can point at the row. */
  sessionIndex: number | null;
  reload: boolean;
}

export function programmeErrorCopy(error: unknown): ProgrammeErrorCopy {
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : null;
  if (typeof message === 'string') {
    const text = message.trim();
    const hit = PROGRAMME_COPY.find((c) => c.match.test(text));
    if (hit) {
      const index = /^invalid_payload: session (\d+) /.exec(text);
      return { message: hit.message, sessionIndex: index ? Number(index[1]) : null, reload: !!hit.reload };
    }
  }
  return { message: GENERIC.message, sessionIndex: null, reload: false };
}
