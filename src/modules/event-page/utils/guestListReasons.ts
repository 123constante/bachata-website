/**
 * Every rejection `submit_guest_list_entry` can return, and the message a dancer sees for it.
 *
 * WHY THIS FILE EXISTS. The submit hook used to `switch` over six reasons with no `default:`.
 * The server could already return an eighth (`capacity_full` has been reachable since the P2a
 * capacity chokepoint shipped), and any reason the switch did not name fell through in
 * silence -- the optimistic pill was removed and NOTHING was said. The dancer watched their
 * name vanish and had no idea why. That is finding-class A of the guest-list arc, and the fix
 * is structural rather than "add the two missing cases": one map, one lookup, and an
 * `UNKNOWN_REASON` fallback that always says something.
 *
 * The reason union below is the SERVER's union, transcribed from the installed body of
 * public.submit_guest_list_entry on 2026-08-27. `guestListReasonMessage` accepts an arbitrary
 * string on purpose -- a server that grows a ninth reason before this file learns about it
 * must still produce a toast, not a silent rollback.
 */

/** The reasons public.submit_guest_list_entry returns today. */
export const SUBMIT_GUEST_LIST_REASONS = [
  'name_required',
  'name_too_long',
  'event_not_found',
  'guest_list_not_enabled',
  'cutoff_passed',
  'capacity_full',
  'duplicate_name',
  'rate_limited',
] as const;

export type SubmitGuestListReason = (typeof SUBMIT_GUEST_LIST_REASONS)[number];

export type GuestListReasonMessage = {
  title: string;
  description?: string;
  /** Shown as a destructive (red) toast unless this is false. */
  destructive: boolean;
  /**
   * The rejection implies our cached copy of the list is out of date (the list closed, the
   * event changed, someone else took the last slot), so the query is refetched after it.
   */
  invalidates: boolean;
  /**
   * Handled by the calling component instead of by a toast. Only `duplicate_name`, which
   * renders the collision card so the dancer can disambiguate their name in place.
   */
  handledByCaller: boolean;
};

const base = {
  destructive: true,
  invalidates: false,
  handledByCaller: false,
} satisfies Omit<GuestListReasonMessage, 'title'>;

export const GUEST_LIST_REASON_MESSAGES: Record<SubmitGuestListReason, GuestListReasonMessage> = {
  name_required: {
    ...base,
    title: 'Please enter your first name',
  },
  name_too_long: {
    ...base,
    title: 'That name is too long',
    description: 'Keep it under 80 characters.',
  },
  event_not_found: {
    ...base,
    title: 'Event not found',
  },
  guest_list_not_enabled: {
    ...base,
    title: 'Guest list is not available',
    invalidates: true,
  },
  cutoff_passed: {
    ...base,
    title: 'Guest list is closed',
    description: 'Sign-ups for this night have closed.',
    invalidates: true,
  },
  capacity_full: {
    ...base,
    title: 'The guest list is full',
    description: 'Every spot for this night has gone. Try again next time.',
    // The last slot went to someone else while this dancer was typing, so our cached
    // counts are stale by definition.
    invalidates: true,
  },
  rate_limited: {
    ...base,
    title: 'Too many sign-ups from this connection',
    description: 'Give it a few minutes and try again.',
  },
  duplicate_name: {
    ...base,
    title: 'That name is already on the list',
    handledByCaller: true,
  },
};

/**
 * The fallback. A reason this build has never heard of still produces a visible, honest
 * message -- the dancer is told the sign-up did not go through, which is the one thing the
 * old switch failed to do.
 */
export const UNKNOWN_REASON_MESSAGE: GuestListReasonMessage = {
  title: "Couldn't add your name",
  description: 'Something went wrong on our end. Please try again.',
  destructive: true,
  invalidates: true,
  handledByCaller: false,
};

export const isKnownGuestListReason = (reason: string): reason is SubmitGuestListReason =>
  Object.prototype.hasOwnProperty.call(GUEST_LIST_REASON_MESSAGES, reason);

/** Total: never returns undefined, which is the entire point of this module. */
export const guestListReasonMessage = (reason: string | null | undefined): GuestListReasonMessage => {
  if (typeof reason === 'string' && isKnownGuestListReason(reason)) {
    return GUEST_LIST_REASON_MESSAGES[reason];
  }
  return UNKNOWN_REASON_MESSAGE;
};
