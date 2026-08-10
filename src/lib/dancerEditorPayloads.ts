import {
  danceStartedYearFromDateString,
  dateStringFromDanceStartedYear,
  type SaveMyDancerProfileInput,
} from "@/lib/saveMyDancerProfile";
import { serializePhotoValue } from "@/lib/utils";

/**
 * Pure form -> `save_my_dancer_profile_v1` payload mapping for the two complex
 * self-serve editors (DancerDashboard, CreateProfile).
 *
 * It lives outside both screens because every data-loss finding of the funnel arc
 * came from this mapping, and a builder no test can reach without mounting a
 * 1,600-line component is a builder nobody tests. Its rules are read off the live
 * function body, not inferred:
 *
 * - The sidecar ARRAY fields are read as
 *   `CASE WHEN details ? 'k' THEN ARRAY(SELECT jsonb_array_elements_text(...))`.
 *   A key present with a JSON null therefore reaches
 *   `jsonb_array_elements_text('null')`, which is a HARD ERROR, not a no-op.
 *   Both screens used to send `x.length ? x : null`. Arrays go as ARRAYS, always.
 * - The sidecar TEXT fields have no NULLIF, so "" is a real value and CLEARS
 *   them -- unlike the ten identity scalars, where "" means "leave unchanged" and
 *   being unable to clear is accepted debt. Deleting a blurb must delete it.
 * - `partner_details` is a TEXT column. `serializePartnerDetails` produces an
 *   object and `->>` would store its literal JSON, which the reader hands back to
 *   the textarea -- gaining a wrapper on every save.
 * - `avatar_url` is TEXT while `serializePhotoValue` returns `string[]`.
 * - `dance_started_year` is a CALENDAR YEAR under a CHECK of 1950..current year;
 *   `EXPERIENCE_LEVEL_YEARS` is a DURATION. The wizard assigned one to the other,
 *   which is how "Intermediate" meant the year 4 AD.
 */

/**
 * The role vocabulary the badges speak. `Both` is the UI's word for what the DB
 * stores as `Lead and Follow`: `dancer_profiles_dance_role_check` admits only
 * Leader / Follower / Lead and Follow, and `normalize_dance_role` maps our `Both`
 * onto the third.
 */
export type DancerRoleChoice = "Leader" | "Follower" | "Both" | "";

const ROLE_BY_STORED_VALUE: Record<string, DancerRoleChoice> = {
  lead: "Leader",
  leader: "Leader",
  follow: "Follower",
  follower: "Follower",
  both: "Both",
  "lead and follow": "Both",
  "lead & follow": "Both",
  "lead/follow": "Both",
  "either leader or follower": "Both",
};

/**
 * Stored role -> badge value.
 *
 * The two hand-rolled copies this replaces had no `lead and follow` case, so the
 * canonical stored form of "Both" read back as "no role selected" -- and an
 * unselected badge saves as null, so the NEXT save cleared the role the user had
 * just set. Unreachable while the writes were failing; live the moment they work.
 *
 * It accepts a SUPERSET of `normalize_dance_role`, not a mirror: `lead` and
 * `follow` have no case in the SQL helper, which returns NULL for them. Harmless,
 * because `dancer_profiles_dance_role_check` admits only Leader / Follower /
 * Lead and Follow, so neither bare form can ever be stored to read back. Stated
 * because an earlier version of this comment claimed parity and no test enforces
 * it -- the case below asserts only that JS accepts what SQL accepts, which stays
 * green if the SQL side ever drops one.
 */
export const dancerRoleFromStored = (value?: string | null): DancerRoleChoice => {
  // Whitespace class, not a literal space. The SQL helper collapses `\s+`, so a
  // value carrying a tab or newline normalises there and would NOT have here --
  // it would miss the map, return "", and the identity editor turns "" into
  // `dance_role: null`, which the function key-tests and uses to BLANK the
  // column. The mirror has to be total in both directions to be a mirror.
  const key = (value || "").trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
  if (!key) return "";
  if (!Object.prototype.hasOwnProperty.call(ROLE_BY_STORED_VALUE, key)) return "";
  return ROLE_BY_STORED_VALUE[key];
};

/** Handle, bare domain or full URL -> a URL. Shared so the two copies cannot drift. */
export const normalizeSocialUrl = (kind: "instagram" | "facebook" | "website", value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (kind === "instagram") {
    const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
    // A dot does NOT make it a URL. Instagram usernames legally contain "." and
    // "_", so the old `includes(".")` test sent "@ana.dance" to https://ana.dance
    // -- a dead domain stored as the user's profile link. A handle is anything
    // with no path separator, no scheme, and no instagram.com in it.
    const looksLikeUrl =
      withoutAt.includes("/") ||
      withoutAt.startsWith("http://") ||
      withoutAt.startsWith("https://") ||
      withoutAt.toLowerCase().includes("instagram.com");
    if (!looksLikeUrl) {
      return `https://instagram.com/${withoutAt}`;
    }
    if (!withoutAt.startsWith("http://") && !withoutAt.startsWith("https://")) {
      return `https://${withoutAt}`;
    }
    return withoutAt;
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

/** Years of dancing per level -- a DURATION, never a year. */
export const EXPERIENCE_LEVEL_YEARS: Record<string, number> = {
  Beginner: 1,
  Improver: 2,
  Intermediate: 4,
  Advanced: 7,
  Professional: 10,
};

/**
 * The picker's options, DERIVED from the durations rather than written out
 * beside them. A level with no duration converts to null and the user's answer
 * is dropped in silence, so the two lists must not be able to drift.
 */
export const EXPERIENCE_LEVEL_OPTIONS = Object.keys(EXPERIENCE_LEVEL_YEARS);

/**
 * Duration -> calendar year. `currentYear` is a parameter so the conversion is
 * testable without freezing the clock.
 */
export const danceStartedYearFromExperienceLevel = (
  level: string | null | undefined,
  currentYear: number,
): number | null => {
  // OWN keys only. A bare index reaches the prototype, so 'constructor' (and
  // 'toString', 'valueOf') resolves to a Function, slips past an `=== undefined`
  // guard and makes `currentYear - years` NaN -- which JSON.stringify writes as
  // null and the save drops in silence. `experience_level` is restored from
  // UNVALIDATED localStorage, so those keys are reachable without the picker.
  if (!level || !Object.prototype.hasOwnProperty.call(EXPERIENCE_LEVEL_YEARS, level)) return null;
  const years = EXPERIENCE_LEVEL_YEARS[level];
  if (typeof years !== "number" || !Number.isFinite(years)) return null;
  return currentYear - years;
};

/** The DancerDashboard editor form. One shape, so the builders can stay pure. */
export type DancerEditorForm = {
  first_name: string;
  surname: string;
  city: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  website: string;
  dancing_start_date: string;
  partner_role: string;
  achievements: string[];
  favorite_songs: string[];
  partner_search_role: string;
  partner_search_level: string[];
  partner_practice_goals: string[];
  partner_details: string;
  favorite_styles: string[];
  looking_for_partner: boolean;
  photo_url: string;
};

export type DashboardEditorSection = "identity" | "career" | "partner" | "social";

/**
 * One dashboard section -> its payload. Sections stay narrow on purpose: a save
 * must never carry fields the open editor did not show, because the form behind a
 * closed section is not guaranteed to be hydrated.
 */
export const buildDashboardSectionPayload = (
  section: DashboardEditorSection,
  form: DancerEditorForm,
  ctx: { cityId?: string } = {},
): SaveMyDancerProfileInput => {
  if (section === "identity") {
    return {
      first_name: form.first_name.trim(),
      surname: form.surname.trim(),
      based_city_id: ctx.cityId,
      // Key-tested by the function, so "" and null both blank the column.
      dance_role: form.partner_role || null,
      // TEXT column fed by an array helper: take the first entry, or the column
      // stores the literal text of a JSON array.
      avatar_url: serializePhotoValue(form.photo_url)?.[0],
      dancer_details: {
        dance_started_year: danceStartedYearFromDateString(form.dancing_start_date),
      },
    };
  }

  if (section === "career") {
    return {
      dancer_details: {
        favorite_styles: form.favorite_styles,
        favorite_songs: form.favorite_songs,
        achievements: form.achievements,
      },
    };
  }

  if (section === "partner") {
    return {
      dancer_details: {
        looking_for_partner: form.looking_for_partner,
        // "" clears; see the header. Deliberately NOT narrowed to the two badge
        // values, so a legacy "Both" survives instead of being wiped on save.
        partner_search_role: form.partner_search_role,
        partner_search_level: form.partner_search_level,
        partner_practice_goals: form.partner_practice_goals,
        // TEXT column: the text itself, never serializePartnerDetails' object.
        partner_details: form.partner_details,
      },
    };
  }

  if (section === "social") {
    return {
      instagram: normalizeSocialUrl("instagram", form.instagram),
      facebook: normalizeSocialUrl("facebook", form.facebook),
      whatsapp: form.whatsapp,
      website_url: normalizeSocialUrl("website", form.website),
    };
  }

  // Exhaustiveness, not decoration. As an unguarded fall-through, adding a fifth
  // section and forgetting its arm shipped the SOCIAL payload built from that
  // editor's form -- overwriting four contact columns under a green "Profile
  // updated". TypeScript could not catch it, because the fall-through satisfies
  // the return type. This module exists to stop silent divergence; that was the
  // one place it could still grow.
  const unhandled: never = section;
  throw new Error(`buildDashboardSectionPayload: no arm for section ${String(unhandled)}`);
};

/** The subset of the CreateProfile wizard's form that reaches the database. */
export type CreateProfileFormValues = {
  photo_url?: string;
  city?: string;
  nationality?: string;
  experience_level?: string;
  dancing_start_date?: string;
  favorite_styles?: string[];
  partner_role?: string;
  favorite_songs_text?: string;
  achievements_text?: string;
  looking_for_partner?: boolean;
  partner_search_role?: string;
  partner_search_level?: string[];
  partner_practice_goals?: string[];
  partner_details?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
};

const linesOf = (value: string | undefined): string[] =>
  (value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

/**
 * The whole wizard in one payload. `currentYear` is injected rather than read so
 * the year mapping is testable and clock-independent.
 */
export const buildCreateProfilePayload = (
  values: CreateProfileFormValues,
  ctx: { firstName: string; surname: string; cityId: string; currentYear: number },
): SaveMyDancerProfileInput => {
  // An explicit start date always wins; the experience level is the fallback for
  // the user who only answered the quick question.
  const startYear =
    danceStartedYearFromDateString(values.dancing_start_date) ??
    danceStartedYearFromExperienceLevel(values.experience_level, ctx.currentYear);

  return {
    first_name: ctx.firstName,
    surname: ctx.surname,
    based_city_id: ctx.cityId,
    nationality: values.nationality || "",
    dance_role: values.partner_role || null,
    avatar_url: serializePhotoValue(values.photo_url)?.[0],
    instagram: normalizeSocialUrl("instagram", values.instagram || ""),
    facebook: normalizeSocialUrl("facebook", values.facebook || ""),
    whatsapp: values.whatsapp || "",
    website_url: normalizeSocialUrl("website", values.website || ""),
    dancer_details: {
      favorite_styles: values.favorite_styles || [],
      favorite_songs: linesOf(values.favorite_songs_text),
      achievements: linesOf(values.achievements_text),
      looking_for_partner: values.looking_for_partner || false,
      partner_search_role: values.partner_search_role || "",
      partner_search_level: values.partner_search_level || [],
      partner_practice_goals: values.partner_practice_goals || [],
      partner_details: values.partner_details || "",
      dance_started_year: startYear,
    },
  };
};

/** The stored columns the wizard prefills from. */
export type StoredDancerRow = {
  avatar_url?: string | string[] | null;
  based_city_id?: string | null;
  nationality?: string | null;
  dance_started_year?: number | null;
  favorite_styles?: string[] | null;
  dance_role?: string | null;
  favorite_songs?: string[] | null;
  achievements?: string[] | null;
  looking_for_partner?: boolean | null;
  partner_search_role?: string | null;
  partner_search_level?: string[] | null;
  partner_practice_goals?: string[] | null;
  partner_details?: unknown;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  website_url?: string | null;
  website?: string | null;
};

const linesFrom = (value: unknown): string =>
  Array.isArray(value) ? value.filter(Boolean).join("\n") : "";

/**
 * Field-wise merge of the stored row into the wizard's CURRENT values.
 *
 * Extracted and pure because the blanket `form.reset` it replaces was the
 * highest-severity finding of the round-1 review and had no way to be tested.
 * That reset had to be gated on completeness, since resetting from a blank stub
 * wiped the pre-auth draft just restored from localStorage -- and the gate is
 * what left a row carrying sidecar content but no basics UNHYDRATED. The wizard
 * then showed empty lists, and because an empty list is a real value to the
 * sidecar arm, submitting DELETED the stored styles, songs, achievements and
 * blurb. Merging needs no gate: a stored value only ever fills a field the user
 * has not TOUCHED.
 *
 * `touched` is the discriminator, and it has to be. An earlier draft keyed on
 * emptiness (`typed || stored`), which cannot tell "unanswered" from
 * "deliberately off": it forced a switch the user had turned OFF back on, and
 * restored a list they had deliberately emptied -- so a returning user could
 * never REMOVE anything through the wizard, including the very sidecar fields
 * this arc made clearable. Pass react-hook-form's dirtyFields keys.
 */
export const mergeStoredDancerIntoWizardForm = <T extends CreateProfileFormValues>(
  current: T,
  stored: StoredDancerRow,
  touched: ReadonlySet<string>,
): T => {
  const text = (field: string, typed: string | undefined, storedValue: string): string =>
    touched.has(field) ? typed || "" : storedValue || typed || "";
  const list = (field: string, typed: string[] | undefined, storedValue: string[]): string[] =>
    touched.has(field) ? typed || [] : storedValue.length ? storedValue : typed || [];

  return {
    ...current,
    photo_url: text(
      "photo_url",
      current.photo_url,
      Array.isArray(stored.avatar_url) ? stored.avatar_url[0] || "" : stored.avatar_url || "",
    ),
    city: text("city", current.city, stored.based_city_id || ""),
    nationality: text("nationality", current.nationality, stored.nationality || ""),
    // `dancing_start_date` is not a column; the stored value is an integer year.
    dancing_start_date: text(
      "dancing_start_date",
      current.dancing_start_date,
      dateStringFromDanceStartedYear(stored.dance_started_year),
    ),
    favorite_styles: list("favorite_styles", current.favorite_styles, stored.favorite_styles || []),
    // The DB spells "Both" as "Lead and Follow", which matches no badge.
    partner_role: text("partner_role", current.partner_role, dancerRoleFromStored(stored.dance_role)),
    favorite_songs_text: text(
      "favorite_songs_text",
      current.favorite_songs_text,
      linesFrom(stored.favorite_songs),
    ),
    achievements_text: text("achievements_text", current.achievements_text, linesFrom(stored.achievements)),
    // Touched wins even when it is FALSE -- a switch the user deliberately turned
    // off is an answer, not an absence.
    looking_for_partner: touched.has("looking_for_partner")
      ? Boolean(current.looking_for_partner)
      : Boolean(stored.looking_for_partner),
    // RAW: free text with no CHECK and no DB normaliser, so the role codec would
    // map an unrecognised value to "", and "" clears the column.
    partner_search_role: text(
      "partner_search_role",
      current.partner_search_role,
      stored.partner_search_role || "",
    ),
    partner_search_level: list(
      "partner_search_level",
      current.partner_search_level,
      stored.partner_search_level || [],
    ),
    partner_practice_goals: list(
      "partner_practice_goals",
      current.partner_practice_goals,
      stored.partner_practice_goals || [],
    ),
    partner_details: text(
      "partner_details",
      current.partner_details,
      typeof stored.partner_details === "string" ? stored.partner_details : "",
    ),
    instagram: text("instagram", current.instagram, stored.instagram || ""),
    facebook: text("facebook", current.facebook, stored.facebook || ""),
    whatsapp: text("whatsapp", current.whatsapp, stored.whatsapp || ""),
    // website_url is the writable column; `website` is only its mirror.
    website: text("website", current.website, stored.website_url || stored.website || ""),
  };
};
