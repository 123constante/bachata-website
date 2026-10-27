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
import { DANCER_GATE_REASON, PROFILE_INCOMPLETE_CODE } from '@/lib/accountRouting';
import { VERSION_CONFLICT } from './copy';

import { LAST_OWNER_NOTE, TEAM_CAP } from './teamModel';

/** `finish_profile`: the screen sends the person to the gated Finish screen (finishProfileHref of where they are). */
/** `contact_support`: the screen shows the support rows (supportLinks()) and no retry, because a retry cannot work. */
export type SelfServeNextStep = 'request_access' | 'reauth' | 'sign_in' | 'finish_profile' | 'contact_support' | null;

/** A page holds at most TEAM_CAP people (admin A1b): add-member / set-member raise `team_full`, invite redeem returns it as a reason. */
export const TEAM_FULL_COPY = `This team already has ${TEAM_CAP} people. Remove someone first, or ask the Bachata Calendar team.`;
/** `profile_required` (organiser_team_set_public_v1), and the Team switch's note before it is ever tapped: ONE sentence. */
export const PROFILE_REQUIRED_NOTE = 'Finish your dancer profile first, then you can show on the public team.';
/** Creating a NEW organiser page is invite-only (owner decision 2026-10-20); the admin trigger raises `organiser_invite_required`. */
export const INVITE_REQUIRED_COPY = 'Creating a new organiser page needs an invite from the Bachata Calendar team. Message us and we\u2019ll set you up.';

export interface SelfServeErrorCopy {
  message: string;
  /** What the screen should offer next, if anything. */
  next: SelfServeNextStep;
}

const COPY: Record<string, SelfServeErrorCopy> = {
  authentication_required: { message: 'Please sign in first.', next: 'sign_in' },
  // Dancer first, then organiser (owner decision 2026-10-11): create / claim /
  // request refuse an unfinished dancer profile (the separate admin PR). The
  // client gate usually gets there first; this is the server catching a stale one.
  [PROFILE_INCOMPLETE_CODE]: { message: DANCER_GATE_REASON, next: 'finish_profile' },
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
  invalid_instagram: { message: 'Use your Instagram name, like yourname or @yourname, or your profile link.', next: null },
  invalid_website: { message: 'Enter a full website address starting with https://.', next: null },
  organiser_name_taken: {
    message: 'An organiser with this name is already listed. Find it above and claim it or request access.',
    next: null,
  },
  draft_limit_reached: {
    message: 'You already have three organisers waiting. Finish or remove one first.',
    next: null,
  },
  not_authorised: {
    message: 'Only an owner or manager of this page can do that.',
    next: null,
  },
  invalid_state: {
    message: 'This page cannot do that right now. Reload and check it.',
    next: null,
  },
  organiser_invite_required: { message: INVITE_REQUIRED_COPY, next: 'contact_support' },
  team_full: { message: TEAM_FULL_COPY, next: null },
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
/**
 * Arc 1 flow 9c: the sign-in ended mid-edit, on every save path. Not the mockup's
 * "What you typed is kept on this phone": no flow keeps a draft across a sign-in.
 */
export const SESSION_ENDED = 'Your sign-in ended. Sign in again.';

export const COMMAND_COPY: Array<{ match: RegExp; message: string | ((hit: RegExpMatchArray) => string) }> = [
  // INT4, the final AW1 contract (admin PR #838): an owner may not delete a session that has per-date changes (named),
  // an id-less or stale-id programme save is refused (reload brings the stored ids), and an owner may only ADD
  // live organiser pages they own or manage. FIRST and anchored (FIX-INT4 S-3): the session title is free text, so
  // an unanchored rule below (e.g. "on a past date is admin-only") must never see it first. The server sends
  // left(title, 80) and a title may be '' (FIX-INT4 S-1).
  { match: /^permission_denied: removing the session "(.{0,200})" would delete its per-date changes/, message: (hit) => {
    const title = hit[1].trim().slice(0, 80);
    return title
      ? `The session \u201c${title}\u201d has changes on some dates, so only an admin can remove it. Keep it, or ask the Bachata Calendar team to remove it.`
      : 'One of the sessions has changes on some dates, so only an admin can remove it. Keep it, or ask the Bachata Calendar team to remove it.';
  } },
  { match: /^invalid_payload: (this programme save carries no ids|a programme id )/, message: 'This programme changed since you opened it. Reload the page, then make your change and save again.' },
  { match: /^permission_denied: series\.set_organisers can only add an organiser page you own or manage/, message: 'You can only add organiser pages you run. To add another page, ask the Bachata Calendar team.' },
  { match: /^permission_denied: series\.set_organisers can only add a live organiser page/, message: "That page isn't live, so it can't be added." },
  { match: /^version_conflict/, message: VERSION_CONFLICT },
  // P3 W2b, the date sheet (handlers read on prod 2026-10-27). Anchored: the reason refusal lists every label.
  { match: /^invalid_payload: cancellation reason must be one of/, message: 'That reason is no longer on the list. Reload the page, then pick a reason again.' },
  { match: /^invalid_payload: per-date time is not supported for festivals/, message: 'Festival times are set for the whole festival, not one date. Ask the Bachata Calendar team.' },
  { match: /^invalid_transition: festival_extra_date/, message: 'A festival holds one date. Ask the Bachata Calendar team to change its days.' },
  { match: /^invalid_payload: (date|occurrence_id) required/, message: 'Choose a date.' },
  { match: /^invalid_payload: new_local_start required/, message: 'Enter the new start time, like 19:30.' },
  { match: /^invalid_payload: date_time_session_has_people/, message: 'This date\u2019s own time has people on its session, so it can\u2019t go back to the usual time. Change the time instead.' },
  // ER AD4, series.cancel_one_off (_cmd_series_cancel_one_off_p5 and the dispatcher's payload rule, read on prod
  // 2026-10-26). Anchored and before every loose rule: the reason refusal lists every label, and the token sits
  // between the first and second colon.
  { match: /^invalid_transition: cancel_one_off_started:/, message: 'It has already started, so it can\u2019t be cancelled. If it didn\u2019t happen, use End it tomorrow.' },
  { match: /^invalid_transition: cancel_one_off_past:/, message: 'Its date has passed, so it can\u2019t be cancelled. Use End it instead.' },
  { match: /^invalid_transition: cancel_one_off_not_live:/, message: 'Only an event that is showing can be cancelled. Show it again first, then cancel it.' },
  { match: /^invalid_transition: cancel_one_off_(not_one_off|festival|dates):/, message: 'This event can\u2019t be cancelled this way. Reload the page to see it as it is now.' },
  { match: /^invalid_payload: cancel_one_off_reason:|^permission_denied: series\.cancel_one_off (needs a reason that is a cancellation_reasons label|needs a JSON object|payload keys)/, message: 'That reason is no longer on the list. Reload the page, then pick a reason again.' },
  // Admin waves A1-A3 (er-p4-a1/a2/a3 handovers): stable codes after "permission_denied: ". Anchored and
  // before every loose rule below, because their detail text names keys those rules match on.
  { match: /^permission_denied: city_follows_venue/, message: 'The city comes from the venue, so it cannot be set on its own. Choose the venue and its city is filled in for you.' },
  { match: /^permission_denied: slug_admin_only/, message: 'Only the Bachata Calendar team can change the web address of an event. Ask them if it needs to change.' },
  { match: /^permission_denied: category_admin_only/, message: 'That kind of event cannot be set here. Ask the Bachata Calendar team.' },
  { match: /^permission_denied: occurrence_cancelled/, message: 'This date is cancelled, so its name, music, photos and prices cannot be changed. Put the date back first if it is on again.' },
  { match: /^permission_denied: forward_from_past/, message: 'Changes to this and later dates must start today or later. Pick a date from today on.' },
  { match: /^permission_denied: format_festival_admin_only/, message: 'Only the Bachata Calendar team can turn an event into a festival, or a festival into something else. Ask them.' },
  { match: /^permission_denied: format_needs_collapse/, message: 'A repeating event cannot become one date here. Ask the Bachata Calendar team.' },
  { match: /^permission_denied: format_course_needs_rule/, message: 'A course needs its repeat pattern before it can change. Ask the Bachata Calendar team to set it.' },
  { match: /^permission_denied: course_total_needs_course/, message: 'The number of sessions is only for a course. Leave it empty for this event.' },
  { match: /^permission_denied: collapse_needs_repeating/, message: 'This event already has one date, so there is nothing to cut down.' },
  { match: /^permission_denied: collapse_survivor_past/, message: 'The date you keep must be today or later. Pick an upcoming date.' },
  { match: /on an ended series is admin-only/, message: 'This event has ended, so it cannot be changed here. Ask the Bachata Calendar team.' },
  { match: /^permission_denied: series\.set_group_chat/, message: 'Enter a group chat link starting with https://, or leave it empty.' },
  { match: /^permission_denied: occurrence\.set_override title/, message: 'Give this date a name of up to 80 characters, or leave it empty to use the event name.' },
  { match: /^permission_denied: occurrence\.set_override music_styles/, message: 'Choose up to 20 music styles, each up to 40 characters.' },
  { match: /^permission_denied: occurrence\.set_override gallery/, message: 'Add up to 30 photos, each a full link starting with https://.' },
  // occurrence.move_date (_cmd_occurrence_move_date_p5): the day is taken (a cancelled date counts), or the date is not on.
  { match: /date_taken/, message: 'This event already has a date on that day (a cancelled one counts too). Pick another day.' },
  { match: /move_date needs a scheduled date/, message: 'This date is cancelled or already over, so it cannot be moved. Reload the page to see it as it is now.' },
  { match: /move_date is not supported for festivals/, message: 'Festival days are set by the Bachata Calendar team. Ask them to move a day.' },
  { match: /to_date required/, message: 'Choose a date.' },
  { match: /on a past date is admin-only|^past_date/, message: 'This date has already happened, so it can no longer be changed.' },
  { match: /^has_bookings: .*cannot be made a break/, message: 'People have already booked this date, so it cannot be skipped. Cancel it instead, so they see why.' },
  { match: /^has_bookings/, message: 'People have already booked this date, so it cannot be removed. Cancel it instead, so they see why.' },
  { match: /^no_sessions_for_time_override/, message: 'This date has no session times to move yet. Ask the Bachata Calendar team to set up the class times.' },
  { match: /cancellation_reasons label/, message: 'Choose a reason. Dancers see it.' },
  // D8: a reason only goes with a cancelled date (an un-cancel in another tab, then a stale reason save).
  { match: /cancellation_reason_label needs a cancelled date/, message: 'A reason only shows on a cancelled date. This date is not cancelled, so there is nothing to explain.' },
  // D8: the price list and the Instagram link (series.upsert default_passes / instagram_url).
  { match: /series\.upsert default_passes|occurrence\.set_override passes/, message: 'Check the prices: up to 10, each with a name and a price like 12 or 12.50.' },
  { match: /instagram_url must be blank or an instagram\.com link/, message: 'Enter an Instagram link, like https://www.instagram.com/yourname.' },
  { match: /must be blank or an http\(s\) URL|must be null or an array of http\(s\) URLs/, message: 'Enter a full link starting with https://.' },
  { match: /description is longer than/, message: 'Keep the note under 4,000 characters.' },
  { match: /must name an existing venue/, message: 'That venue is not on Bachata Calendar yet.' },
  { match: /default_duration_minutes/, message: 'The end time must be after the start, and within 20 hours.' },
  { match: /must be a HH:MM time|must be blank or a HH:MM time/, message: 'Enter the time as hours and minutes, like 19:30.' },
  { match: /date must be a YYYY-MM-DD date/, message: 'Choose a date.' },
  { match: /is not an owner transition|^lifecycle_transition_denied/, message: 'That status change is not available for this event right now.' },
  // P3 W2a, the Status sheet: series.end_run and series.stop_repeating refusals (_cmd_series_end_run_p5,
  // _cmd_series_stop_repeating_p5 as read on prod 2026-10-26). Anchored: the server text names ids and formats.
  { match: /^permission_denied: series\.set_lifecycle \S+ -> live needs a ready series/, message: 'It is not ready to go live yet: it needs a cover photo, a date coming up and its details. Add them in the current organiser area, then put it live.' },
  { match: /^invalid_payload: today_session_required/, message: 'This event has a date today. Say whether tonight happened, then end it.' },
  { match: /^invalid_transition: series \S+ has no night this platform can evidence/, message: 'We have no record of a night this event ran, so it cannot be ended. Remove it instead, or ask the Bachata Calendar team.' },
  { match: /^invalid_transition: course \S+ is (live|paused)\. A course must keep a schedule/, message: 'A course keeps its dates while it runs. End it when the last class is done.' },
  { match: /^invalid_transition: series \S+ is '\S+'\. Only a live or paused series can be ended/, message: 'Only a live or hidden event can be ended. Reload the page to see it as it is now.' },
  { match: /^invalid_transition: series \S+ (is not a ruled recurring series|has format)/, message: 'This event does not repeat, so there is nothing to stop. Reload the page to see it as it is now.' },
  { match: /is not a date the recurrence rule/, message: 'The weekly pattern changed since this date was taken off, so it cannot be put back as a break. Add it as a date instead.' },
  { match: /is not a break on series/, message: 'That date is already back on the list. Reload the page.' },
  { match: /^publish_blocked/, message: 'This event needs more details before it can go live again. Ask the Bachata Calendar team.' },
  { match: /^invalid_payload: name required/, message: 'Enter the event name.' },
  { match: /^(not_found|series_not_found)/, message: 'This date or event no longer exists. Reload the page.' },
  // W3, the create (admin D3/D7 refusals on series.upsert (create) and series.set_recurrence).
  { match: /\(create\) needs a live organiser/, message: 'Your page is not live yet, so it cannot take events. Ask the Bachata Calendar team.' },
  { match: /naming one organiser the caller owns or manages/, message: 'Choose one of your organisers.' },
  { match: /category must be party, class or workshop|category on a live series is admin-only/, message: 'That kind of event cannot be set here. Ask the Bachata Calendar team.' },
  { match: /format must be one_off or recurring/, message: 'Choose a party or a weekly class.' },
  { match: /default_start_date cannot be set to a past date|end\.date must not be before today/, message: 'Choose a date from today on.' },
  // Admin refusals raised as a bare code: the daily edit limit, the dates limit, and undo.
  { match: /^(permission_denied: )?daily_edit_cap/, message: "You have reached today's limit of 100 changes. You can carry on tomorrow, or ask the Bachata Calendar team." },
  { match: /^(permission_denied: )?date_cap/, message: 'No new date can be added while 30 or more upcoming dates are listed (past and cancelled dates do not count). Cancel or remove an upcoming date first, or start a new event.' },
  // PAR-A S1: admin_bulk_occurrence_command_p5 refuses the WHOLE call (nothing changed); a retry would fail the same way.
  { match: /shift would move a date into the past/, message: 'Nothing was moved: one of the ticked dates would land before today. Pick fewer days or other dates.' },
  { match: /shift would collide/, message: 'Nothing was moved: one of the ticked dates would land on a day that already has a date of this event (a cancelled one counts too). Pick another number of days.' },
  { match: /bulk_too_large/, message: 'Nothing was changed: too many dates at once. Tick fewer dates and do the rest in a second go.' },
  { match: /^undo_conflict/, message: 'Someone changed this after you. Look at the event as it is now before you change it again.' },
  { match: /^not_undoable/, message: 'That change cannot be undone here. Change it back by hand.' },
  // Arc 1 9c: a sign-in that ended is not a refusal; before the catch-all below, which would say "you cannot".
  { match: /^(permission_denied: )?authentication_required/, message: SESSION_ENDED },
  { match: /^permission_denied: series\.set_recurrence/, message: 'The weekly pattern could not be saved. Pick one weekday and a first date from today on.' },
  { match: /^permission_denied/, message: 'You cannot make that change here. Ask the Bachata Calendar team.' },
];

/**
 * Shown when a save failed and the server never answered (phone offline, or a
 * dropped connection such as "Failed to fetch"). The change may or may not have
 * been saved, so it must not read like a plain "try again".
 */
export const OFFLINE_SAVE_MESSAGE =
  'Your phone seems to be offline, so this may not have saved. Check your connection, then look at the date or event to see if your change is there before you save again. What you typed is still here.';

/** A failed fetch (supabase-js surfaces it as a TypeError or an error with no server code), or an offline phone. */
export function isNetworkFailure(error: unknown): boolean {
  if (isServerRefusal(error)) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  return (
    /failed to fetch|networkerror|network request failed|load failed|network connection was lost/i.test(text) ||
    (name === 'TypeError' && /fetch|network/i.test(text))
  );
}

export function commandErrorMessage(error: unknown): string {
  if (isNetworkFailure(error)) return OFFLINE_SAVE_MESSAGE;
  const message = error && typeof error === 'object' ? (error as { message?: unknown }).message : null;
  if (typeof message === 'string') {
    const text = message.trim();
    for (const c of COMMAND_COPY) {
      const hit = text.match(c.match);
      if (hit) return typeof c.message === 'string' ? c.message : c.message(hit);
    }
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

/**
 * admin_event_workspace_p5 refusing a caller who is not an owner/manager of the
 * series. A signed-out caller (authentication_required) is not this: signing in may fix it.
 */
export const isAccessRefusal = (error: unknown) =>
  !!error && typeof error === 'object' &&
  /^permission_denied(?!: authentication_required)/.test(String((error as { message?: unknown }).message ?? ''));

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
/** How someone becomes an owner. There is no "Make owner" control in R1: the owner hands the page over (B-N1). */
export const HAND_OVER_HOW = 'add them as a Manager, then open their name and tap Hand the page over';
const HAND_OVER_HOW_SENTENCE = `${HAND_OVER_HOW.charAt(0).toUpperCase()}${HAND_OVER_HOW.slice(1)}.`;
/** The add-member RPC's owner_only refusal, on EVERY screen that adds people (Team and the /page picker, A-S4). Managers add (decision 1). */
export const OWNER_ONLY_ADD = 'Only an owner or a manager of this page can add people. Ask one of them to add this person. Nothing was changed.';
/** What each role can do, on EVERY screen that explains roles (Person and the /page picker). No review step exists (D4, A-S5). */
export const ROLE_HELP = 'Owners and managers add people. Managers edit every event; contributors help edit events. Only the owner removes people, changes roles and hands the page over.';
/** The picker's owner refusal: a new person cannot be added straight in as an owner. */
export const USE_TRANSFER_ADD = `A new person cannot be added as an owner. ${HAND_OVER_HOW_SENTENCE}`;

export const TEAM_COPY: Record<string, string> = {
  authentication_required: 'Please sign in first.',
  organiser_id_required: 'Choose a page first.',
  user_id_required: 'Choose who to remove first.',
  not_authorised: 'Only an owner of this page can do that. As a manager you can add people, or leave this page.',
  organiser_not_found: 'That page no longer exists.',
  not_a_member: 'That person is no longer on the team. Reload the page.',
  cannot_remove_owner: 'Another owner cannot be removed here. They can leave themselves, or ask the Bachata Calendar team.',
  last_owner: LAST_OWNER_NOTE,
  request_id_required: 'Choose a request first.',
  invalid_decision: 'Something went wrong. Please try again.',
  invalid_member_role: 'Something went wrong. Please try again.',
  request_not_found: 'That request no longer exists. Reload the page.',
  request_not_open: 'That request was already answered. Reload the page.',
  note_too_long: 'Keep the note under 500 characters.',
  note_invalid: 'The note contains characters we cannot accept.',
  invalid_scope: 'Something went wrong. Please try again.',
  team_full: TEAM_FULL_COPY,
  owner_only: 'Only an owner of this page can do that. Owners and managers add people, and anyone on the team can leave this page.',
  use_transfer: `To make someone an owner, ${HAND_OVER_HOW}.`,
  target_is_owner: 'An owner\u2019s role cannot be changed here. They can transfer ownership, or ask the Bachata Calendar team.',
  already_owner: 'That person is already an owner.',
  user_not_found: 'No account has that email address. Ask them to sign up to Bachata Calendar first, then add them.',
  unconfirmed_email: 'That account has not confirmed its email address yet. Ask them to confirm it, then add them.',
  reason_required: 'Add a short reason first.',
  reason_too_long: 'Keep the reason under 500 characters.',
  reason_invalid: 'The reason contains characters we cannot accept.',
  primary_requires_owner: 'Something went wrong. Please try again.',
  invalid_target_rule: 'Something went wrong. Please try again.',
  // organiser_team_set_public_v1 (People arc A-DB2): the person's own public-team row.
  invalid_arguments: 'Something went wrong. Please try again.',
  profile_required: PROFILE_REQUIRED_NOTE,
  not_on_team: 'You are no longer on this team. Reload the page.',
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
 * screen is out of date with the server: the editor reloads the programme itself,
 * so the copy says it is loaded rather than asking for a reload.
 */
export const PROGRAMME_VERSION_CONFLICT = 'This date was changed somewhere else, so your changes were not saved. The latest schedule is now showing. Make your changes again.';

/** A line-up refusal that means the screen is out of date; the editor reloads the programme. */
export const PEOPLE_CHANGED_COPY = 'The line-up of this date changed since you opened it, so your changes were not saved. The latest schedule is now showing. Make your changes again.';
/** Any other line-up refusal: calm, and never naming anyone. */
export const PEOPLE_GENERIC_COPY = 'We could not save the line-up changes. Check the line-up and try again.';

export const PROGRAMME_COPY: Array<{ match: RegExp; message: string; reload?: boolean }> = [
  { match: /^version_conflict/, message: PROGRAMME_VERSION_CONFLICT, reload: true },
  { match: /^(permission_denied: )?authentication_required/, message: SESSION_ENDED },
  { match: /occurrence not found or caller is not an owner or manager/, message: 'You cannot change this date. It may have been removed, or you are no longer on this event\u2019s team.' },
  { match: /on a past date is admin-only/, message: 'This date has already happened, so its schedule can no longer be changed.', reload: true },
  { match: /on an ended or archived series is admin-only/, message: 'This event has ended or is archived, so its schedule cannot be changed here.', reload: true },
  { match: /on a cancelled date is not allowed/, message: 'This date is cancelled, so its schedule cannot be changed.', reload: true },
  { match: /on a multi-day event is not supported/, message: 'This event runs over more than one day. Ask the Bachata Calendar team to change its schedule.', reload: true },
  { match: /type is admin-only on an existing session/, message: 'Only the Bachata Calendar team can change the kind of an existing session.' },
  { match: /programme_incomplete|names a session that is not on this date|repeats a session already listed/, message: 'The schedule of this date has changed since you opened it, so your changes were not saved. The latest schedule is now showing. Make your changes again.', reload: true },
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
  { match: /would span more than 20 hours/, message: 'The schedule of this date would run for more than 20 hours. Check the times.' },
  { match: /sessions holds more than|sessions is larger than/, message: 'This schedule is too large to save here. Ask the Bachata Calendar team.' },
  // The line-up (admin 20261109700000). The server is deliberately vague and the copy is too: never name a person.
  { match: /people_remove names a person who is not on that session|people_remove person .* is not on this session|people_add person .* is already on this session/, message: PEOPLE_CHANGED_COPY, reload: true },
  { match: /people_add person .* is not an existing/, message: 'Someone you added can no longer be added to a line-up. Check the line-up and try again.' },
  { match: /would hold more than \d+ people/, message: 'A session can have up to 12 teachers and DJs.' },
  { match: /people_add|people_remove/, message: PEOPLE_GENERIC_COPY },
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
