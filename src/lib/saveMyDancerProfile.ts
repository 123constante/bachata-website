import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { captureException } from "@/lib/sentry";

/**
 * The ONE self-serve write path for a signed-in user's own dancer profile.
 *
 * `authenticated` holds no INSERT and no UPDATE grant on `dancer_profiles`, so
 * every direct-to-table write from the client failed with 42501 -- which is why
 * no new signup could complete onboarding. Granting the privilege is NOT the
 * fix: `dancer_profiles.id` has no default and a BEFORE trigger mints
 * `public.person` from it, so a granted INSERT only moves the error from 42501
 * to 23502. `save_my_dancer_profile_v1` is SECURITY DEFINER, EXECUTE-able by
 * `authenticated`, and resolves the caller's own row via
 * `resolve_my_person_id_v1()` -- there is no id parameter to get wrong.
 *
 * Five properties of the live function that the call sites depend on. All read
 * off `pg_get_functiondef`, not inferred:
 *
 * 1. It is UPDATE-only; there is no INSERT arm. The row must already exist, and
 *    it does: `trg_handle_new_dancer_profile` mints the stub synchronously at
 *    signup, keyed `dancer_profiles.id = auth.users.id`. A missing row is a real
 *    failure, never a create-on-demand cue -- see MissingDancerProfileError.
 *
 * 2. An empty string means "leave this column unchanged", because every identity
 *    column is written as COALESCE(NULLIF(payload->>'x',''), dp.x). A scalar
 *    field therefore CANNOT be cleared through this path and the save still
 *    reports success when you try. Accepted debt (Ricky, 2026-08-08). The
 *    sidecar ARRAYS are different: they take a presence test, so [] does clear.
 *    The unclearable set is instagram, facebook, whatsapp, website_url,
 *    nationality, surname, first_name, based_city_id AND avatar_url -- the last
 *    is worth calling out because a stale profile PHOTO is far more visible than
 *    a stale handle, and JSON null does not clear it either (->> yields SQL NULL,
 *    which the COALESCE then falls back from). `dance_role` is the sole
 *    exception: the function key-tests it, so null blanks the column.
 *
 *    The sidecar is NOT uniformly clearable either, and the split runs by TYPE,
 *    not by location. Its lists and its TEXT fields have no NULLIF, so [] and ''
 *    are real values there and do clear -- but `dance_started_year` is a sidecar
 *    SCALAR under the same COALESCE as the identity columns
 *    (NULLIF(x,'')::integer), so it belongs with the unclearable set: emptying
 *    the identity editor's start date is a silent no-op that still reports
 *    success. This list read as "identity unclearable, sidecar clearable", and a
 *    caller trusting that shape would get the year wrong.
 *
 * 3. `website_url` and `avatar_url` are the writable columns. `website` and
 *    `photo_url` are MIRRORED from them on every save, so sending the mirrored
 *    names is a silent no-op. So is a top-level `favorite_styles` or `roles`:
 *    the first belongs to the sidecar, the second is overwritten by the
 *    function.
 *
 * 4. There is NO `meta_data` arm. The client can no longer stamp
 *    `meta_data.onboarding_status`, and does not need to:
 *    `inferOnboardingStatusFromDancer` falls back to first_name + based_city_id.
 *    Do not reintroduce an explicit status write -- because the RPC cannot clear
 *    a field, an "in_progress" stamp would LATCH and re-close the funnel while
 *    every save kept reporting success.
 *
 * 5. The sidecar mirror is unconditional and survivor-authoritative: a save
 *    against a sidecar-less row seeds the sidecar empty and then overwrites the
 *    legacy arrays from it. Harmless at the measured 0 sidecar-less rows;
 *    re-measure before assuming it stays that way.
 */

/** The caller has no resolvable person at all (`no_canonical_person`). */
export class UnresolvedPersonError extends Error {
  constructor() {
    super("We could not find the profile attached to your account.");
    this.name = "UnresolvedPersonError";
  }
}

/**
 * The person resolved but no `dancer_profiles` row matched, which means
 * `trg_handle_new_dancer_profile` did not fire for this account.
 *
 * This is the one failure the arc cannot recover from on its own: there is no
 * longer any client path that creates the row, by design. It must therefore be
 * distinguishable in Sentry from an ordinary save failure -- otherwise a broken
 * trigger looks exactly like a flaky network and nobody goes looking.
 */
export class MissingDancerProfileError extends Error {
  constructor() {
    super(
      "Your dancer profile has not been set up yet. This is a fault on our side, not something you can fix by trying again.",
    );
    this.name = "MissingDancerProfileError";
  }
}

export type DancerDetailsInput = {
  partner_search_role?: string | null;
  partner_search_level?: string[];
  partner_practice_goals?: string[];
  /**
   * A TEXT column, so send TEXT. Passing the `{ text: ... }` object that
   * serializePartnerDetails produces makes the function's `->>` store the literal
   * JSON, and parsePartnerDetails hands a string straight back to the UI -- so the
   * blurb renders as raw JSON and gains another wrapper on every save.
   */
  partner_details?: string | null;
  looking_for_partner?: boolean;
  dance_started_year?: number | null;
  favorite_styles?: string[];
  favorite_songs?: string[];
  achievements?: string[];
};

/**
 * `dance_started_year` is an INTEGER year on the sidecar; every picker in the app
 * speaks ISO date strings. Both directions live here, next to the type that
 * declares the field, because three hand-rolled copies of the forward conversion
 * and two of the inverse had already drifted apart -- one of them silently wiping
 * the year on every re-submit.
 *
 * Read the year off the STRING. `new Date('2018-01-01')` parses as UTC while
 * getFullYear() reads back in local time, so west of UTC the year decrements by
 * one on every save with no edit at all.
 */
export const danceStartedYearFromDateString = (value?: string | null): number | null => {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
};

/** 1 January is the honest reconstruction of a year-granular value. */
export const dateStringFromDanceStartedYear = (year?: number | null): string =>
  year ? `${year}-01-01` : "";

export type SaveMyDancerProfileInput = {
  first_name?: string;
  surname?: string;
  avatar_url?: string;
  based_city_id?: string;
  nationality?: string;
  /** The one clearable scalar: the function key-tests it, so null blanks the column. */
  dance_role?: string | null;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website_url?: string;
  dancer_details?: DancerDetailsInput;
};

const IDENTITY_KEYS = [
  "first_name",
  "surname",
  "avatar_url",
  "based_city_id",
  "nationality",
  "dance_role",
  "instagram",
  "facebook",
  "whatsapp",
  "website_url",
] as const;

const DETAIL_KEYS = [
  "partner_search_role",
  "partner_search_level",
  "partner_practice_goals",
  "partner_details",
  "looking_for_partner",
  "dance_started_year",
  "favorite_styles",
  "favorite_songs",
  "achievements",
] as const;

/**
 * Pure payload builder, exported for tests. Drops `undefined` so an absent key
 * never reaches the function as an empty string -- the two mean the same thing
 * to it today, but only by accident of the COALESCE, and a caller that means
 * "I am not touching this" should not depend on that.
 */
export const buildDancerProfilePayload = (
  input: SaveMyDancerProfileInput,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  for (const key of IDENTITY_KEYS) {
    const value = input[key];
    if (value === undefined) continue;
    payload[key] = value;
  }

  if (input.dancer_details) {
    const details: Record<string, unknown> = {};
    for (const key of DETAIL_KEYS) {
      const value = input.dancer_details[key];
      if (value === undefined) continue;
      details[key] = value;
    }
    if (Object.keys(details).length > 0) payload.dancer_details = details;
  }

  return payload;
};

const NO_CANONICAL_PERSON = "no_canonical_person";

/**
 * Exported for tests: the token can arrive in any of three PostgREST fields.
 *
 * Whole-token match, not a substring: `no_canonical_personx` is a different
 * name and must not be swallowed as this error. Implemented by splitting on
 * non-identifier characters rather than with a word-boundary regex, because
 * this repo's heredoc write path eats a backslash level and turned the first
 * attempt's word boundary into a literal backspace escape that matched nothing.
 */
export const isUnresolvedPerson = (error: unknown): boolean => {
  const e = (error ?? {}) as { message?: unknown; details?: unknown; hint?: unknown };
  return [e.message, e.details, e.hint].some(
    (field) => typeof field === "string" && field.split(/[^0-9A-Za-z_]+/).includes(NO_CANONICAL_PERSON),
  );
};

/**
 * Saves the signed-in user's own dancer profile and returns the canonical row.
 * Throws UnresolvedPersonError / MissingDancerProfileError rather than
 * resolving to null, so a caller cannot mistake "nothing was written" for a
 * successful save -- the failure mode that kept this bug invisible.
 */
export const saveMyDancerProfile = async (
  input: SaveMyDancerProfileInput,
): Promise<Record<string, unknown>> => {
  const payload = buildDancerProfilePayload(input);

  const { data, error } = await supabase.rpc("save_my_dancer_profile_v1", {
    p_payload: payload as Json,
  });

  if (error) {
    // PostgREST spreads a raised exception across message/details/hint depending
    // on how it was raised, so matching `message` alone misses the token when it
    // lands in DETAIL. Anchor the match too: a bare substring test would also
    // misclassify any unrelated error that merely mentions the name.
    if (isUnresolvedPerson(error)) throw new UnresolvedPersonError();
    throw error;
  }

  // The function returns SQL NULL -- not an error -- when the person resolves
  // but no dancer_profiles row matches it.
  if (data === null || data === undefined) {
    const missing = new MissingDancerProfileError();
    // Reported here rather than at each call site, so a trigger that stops
    // firing surfaces under one searchable context no matter which screen hit it.
    captureException(missing, { context: "saveMyDancerProfile.signupTriggerDidNotFire" });
    throw missing;
  }

  return data as Record<string, unknown>;
};
