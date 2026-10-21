// Pure auth-routing decisions for the magic-link flow, kept out of the page
// components so they can be unit-tested without a Supabase client.
import { WHATSAPP_GET_LISTED_URL, dancerMessageUsUrl } from "@/lib/contactLinks";
import { AREA_PATHS } from "@/lib/areaPaths";

// Shown when sign-in mode discovers the email has no account (Lever 2 walk B3).
/**
 * Digits in the emailed sign-in code. Must equal Supabase auth
 * `mailer_otp_length` (production: 8). Single source: the code box, its
 * labels and the tests all derive from this.
 */
export const OTP_CODE_LENGTH = 8;

/**
 * Seconds before "Resend code" works again. Supabase refuses a second send to
 * the same address inside its per-address interval (default 60 s), so a shorter
 * cooldown only offers a button that fails (audit H7). One value for every code box.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Supabase's 429 (`over_email_send_rate_limit`, "For security purposes..."). */
export function isOtpRateLimitedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown };
  const text = typeof message === "string" ? message.toLowerCase() : "";
  return status === 429 || code === "over_email_send_rate_limit" || text.includes("rate limit") || text.includes("for security purposes");
}

/** Said under the code box (or the e-mail form) when a send was refused as too soon. */
export const OTP_RATE_LIMITED_MESSAGE = "We sent you a code a moment ago. Wait a minute, then try again.";

// The one WhatsApp number, with a prefill that fits a person signing up (not the
// organiser "list my events" one): derived from the shared link, never a 2nd copy.
const whatsAppWith = (text: string) => `${WHATSAPP_GET_LISTED_URL.split("?")[0]}?text=${encodeURIComponent(text)}`;
export const SIGNUP_HELP_WHATSAPP_URL = whatsAppWith("Hi! I'm trying to create an account on Bachata Calendar.");

export const OTP_NO_ACCOUNT_NOTICE = "No account for this email yet. Create one to continue.";

// signInWithOtp({ shouldCreateUser: false }) for an email with no account
// answers 422 { code: "otp_disabled", message: "Signups not allowed for otp" }.
// That is the ONLY reliable "no account" signal on the sign-in path:
// account_exists_by_email is deliberately not anon-callable (no email
// enumeration), so the pre-lookup always answers "unknown". Match the code
// first and the message as a fallback for older auth servers that omit it.
export function isOtpSignupDisabledError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "otp_disabled") return true;
  const text = typeof message === "string" ? message.toLowerCase() : "";
  return text.includes("signups not allowed") || text.includes("signup not allowed");
}

// The Before User Created hook refuses an unlisted email on the create-account
// path with HTTP 403 "Sign-up is limited to approved organisers.". Only a
// create attempt can be an allowlist refusal -- a 403 on the login path
// (shouldCreateUser false) is something else and keeps the generic copy.
// Neutral copy (audit M18): the person refused is usually a dancer, not an organiser.
export const SIGNUP_INVITE_ONLY_TITLE = "We can't create an account for this email yet";
export const SIGNUP_INVITE_ONLY_DESCRIPTION =
  "New accounts are open to invited people for now. Message us and we'll add your email, then try again.";

export function isSignupAllowlistRefusal(error: unknown, shouldCreateUser: boolean): boolean {
  if (!shouldCreateUser || !error || typeof error !== "object") return false;
  const { status, message } = error as { status?: unknown; message?: unknown };
  const text = typeof message === "string" ? message.toLowerCase() : "";
  return text.includes("limited to approved organisers") || status === 403;
}

// Should the callback send the user back to the page that sent them to /auth?
// A sign-in always does. A sign-up historically did not (it went on to the
// create-<role>-profile pages), but with organiser self-serve on those pages
// are retired and the destination is /account, so a brand-new organiser who
// came from "Sign in to claim" must land back on the claim card instead.
export function shouldHonorReturnTo(input: {
  returnTo: string | null;
  isSignupFlow: boolean;
  organiserSelfServe: boolean;
}): boolean {
  if (!input.returnTo) return false;
  return !input.isSignupFlow || input.organiserSelfServe;
}

// What /auth shows after /auth/callback bounced the visitor back with
// `callbackError` (Lever 2 walk S5: an expired magic link used to land on the
// plain sign-in form with no explanation). Unknown reasons show nothing.
export function callbackErrorCopy(reason: string | null): string | null {
  switch (reason) {
    case "expired":
      return "That sign-in link has expired or was already used. Enter your email and we'll send you a new one.";
    case "invalid":
      return "That sign-in link didn't work. Enter your email and we'll send you a new one.";
    case "timeout":
      return "Signing you in took too long. Enter your email and we'll send you a new link.";
    case "manual":
      return "To sign in, enter your email and we'll send you a link.";
    default:
      return null;
  }
}

// Where the callback lands a user who has no returnTo (honoured or pending).
// Owner workflow 2026-10-15: every sign-in, and a dancer sign-up, goes to
// /account/continue (CONTINUE_AS_PATH in lib/accountRouting, asserted equal in
// accountSidesRouting.test.ts; restated because this module is import-free).
// That page reads the person's sides -- their organisers, then their dancer
// profile -- and goes straight to the only one, or shows "Continue as...".
// A sign-UP for an organiser-type role still goes to the organiser onboarding,
// exactly as before. Judged on the sign-up, not the role alone: an existing
// account whose metadata says "organiser" signs in to the chooser too.
const LEGACY_ROLE_ROUTES: Record<string, string> = {
  organiser: "/create-organiser-profile",
  videographer: "/create-videographer-profile",
};

export const SIGNED_IN_LANDING_PATH = "/account/continue";

export function normalizeLandingRole(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const role = raw.trim().toLowerCase();
  return role || null;
}

export function landingPathAfterAuth(input: {
  organiserSelfServe: boolean;
  role: string | null;
  isSignup?: boolean;
}): string {
  const { organiserSelfServe, role, isSignup = false } = input;
  if (!organiserSelfServe) {
    if (role && role !== "dancer" && LEGACY_ROLE_ROUTES[role]) return LEGACY_ROLE_ROUTES[role];
    // /profile was unrouted 2026-09-12 (a 404 straight after sign-in); home, as for a dancer.
    return "/";
  }
  // A non-dancer sign-up meant to set up an organiser: to the organiser
  // onboarding. Dancer first: /account/o's DancerProfileGate sends a new account
  // on to /finish-profile?returnTo=/account/o (DancerFirstGate.matrix.test.tsx).
  if (isSignup && role && role !== "dancer") return "/account/o";
  return SIGNED_IN_LANDING_PATH;
}

// ---- "What do you do?" at sign-up (people arc B-WEB4) -----------------------
// The sign-up multi-select. What is chosen rides to /auth/callback the way the
// sign-up's other answers do (sign-up metadata, plus this browser's storage for
// the typed-code path), is recorded ONCE there with set_my_role_intent_v1, and
// changes only where the new account lands. Choosing Organiser grants nothing
// (C12: an organiser is a person with an owner/manager seat).

/** The values account_role_intent admits, in screen order. */
export type SignupRole = "dancer" | "organiser" | "teacher" | "dj";

export const SIGNUP_ROLE_OPTIONS: readonly { value: SignupRole; label: string; description: string }[] = [
  { value: "dancer", label: "Dancer", description: "I go to classes, socials and festivals" },
  { value: "organiser", label: "Organiser", description: "I run events, socials or a school" },
  { value: "teacher", label: "Teacher", description: "I teach classes or workshops" },
  { value: "dj", label: "DJ", description: "I play music at events" },
];

/** Dancer is on by default. */
export const DEFAULT_SIGNUP_ROLES: readonly SignupRole[] = ["dancer"];

/** The reason under the disabled Continue when nothing is chosen. */
export const SIGNUP_ROLES_REQUIRED_ERROR = "Choose at least one";

const SIGNUP_ROLE_ORDER = SIGNUP_ROLE_OPTIONS.map((o) => o.value);

/** Known values only, once each, in screen order. Not a list, or nothing known in it: null. */
export const parseSignupRoles = (raw: unknown): SignupRole[] | null => {
  if (!Array.isArray(raw)) return null;
  const roles = SIGNUP_ROLE_ORDER.filter((v) => raw.includes(v));
  return roles.length > 0 ? roles : null;
};

export const toggleSignupRole = (roles: readonly SignupRole[], role: SignupRole): SignupRole[] =>
  SIGNUP_ROLE_ORDER.filter((v) => (v === role ? !roles.includes(v) : roles.includes(v)));

/**
 * The single sign-up `user_type` the older routing reads (hasOrganiserIntent, landingPathAfterAuth):
 * organiser when Organiser is ticked, else dancer. Teacher and DJ land by the roles, not by this.
 */
export const signupUserType = (roles: readonly SignupRole[]): "organiser" | "dancer" =>
  roles.includes("organiser") ? "organiser" : "dancer";

/** Where the chosen roles wait for /auth/callback in this browser (the typed-code path never reads metadata first). */
export const PENDING_ROLE_INTENT_KEY = "pending_role_intent";
/** The sign-up metadata key that carries them through the e-mailed link. */
export const ROLE_INTENT_META_KEY = "role_intent";

/** The roles a sign-up chose: this browser's stash first, then the metadata. Both are user-shaped input. */
export const readSignupRoles = (stored: string | null, meta: unknown): SignupRole[] | null => {
  let fromStore: SignupRole[] | null = null;
  if (stored) {
    try {
      fromStore = parseSignupRoles(JSON.parse(stored));
    } catch {
      fromStore = null;
    }
  }
  return fromStore ?? parseSignupRoles(meta);
};

export const SET_MY_ROLE_INTENT_RPC = "set_my_role_intent_v1";

/** set_my_role_intent_v1 answers my_role_intent_v1() plus `changed`; anything without a roles list is a failure. */
export const parseRoleIntentResult = (data: unknown): boolean =>
  !!data && typeof data === "object" && Array.isArray((data as { roles?: unknown }).roles);

/** organiser_home_v1 lists the organisers the person holds an owner/manager seat on. Unreadable: null. */
export const holdsSeatFromOrganiserHome = (data: unknown): boolean | null => {
  if (!data || typeof data !== "object") return null;
  const organisers = (data as { organisers?: unknown }).organisers;
  return Array.isArray(organisers) ? organisers.length > 0 : null;
};

/** Teacher or DJ chosen: the only choices that move the landing or show the "Already listed?" step. */
export const choseTeacherOrDj = (roles: readonly SignupRole[] | null): boolean =>
  !!roles && (roles.includes("teacher") || roles.includes("dj"));

/**
 * Where a sign-up lands once no returnTo was honoured (a returnTo is decided
 * before this and always wins). `todays` is the landing it got before the
 * multi-select: the organiser home after a claim, else landingPathAfterAuth
 * (an Organiser-only sign-up keeps its create/ask-for-a-page path there).
 * An organiser seat keeps today's landing; else Teacher; else DJ; else today's.
 * An unknown seat (the read failed) also keeps today's: never a guess.
 */
export const signupIntentLanding = (input: {
  roles: readonly SignupRole[] | null;
  holdsOrganiserSeat: boolean | null;
  todays: string;
}): string => {
  const { roles, holdsOrganiserSeat, todays } = input;
  if (!roles || holdsOrganiserSeat !== false) return todays;
  if (roles.includes("teacher")) return AREA_PATHS.teacher;
  if (roles.includes("dj")) return AREA_PATHS.dj;
  return todays;
};

/**
 * C13: before landing, one "Already listed?" screen -- Teacher or DJ chosen and
 * the dancer claim found NO person for this email. Never after a claim that
 * linked a record, and not when the claim could not tell (unavailable, ambiguous).
 */
export const showsAlreadyListedStep = (input: { roles: readonly SignupRole[] | null; claimStatus: string }): boolean =>
  choseTeacherOrDj(input.roles) && input.claimStatus === "no_match";

export const ALREADY_LISTED_TITLE = "Already listed on Bachata Calendar?";
export const ALREADY_LISTED_BODY =
  "If you teach or DJ at events we list, you may already have a profile here. Ask us and we'll link it to your account.";
export const ALREADY_LISTED_LINK_LABEL = "Ask us to link your profile";
export const ALREADY_LISTED_URL = dancerMessageUsUrl(
  "Hi! I've just made a Bachata Calendar account and I think I'm already listed. Please can you link my profile?",
);

// ---- Sign-up profile data + the post-login Finish-your-profile prompt --------
// Shared by both sign-up screens, /auth/callback and /finish-profile. It lives
// in THIS module (import-free, already its own chunk on /auth/callback) because
// a module of its own was one more first-load request there
// (perf-budgets.json chunk ratchet).

/**
 * Dance role -- the values `dancer_profiles_dance_role_check` admits, read off
 * prod (2026-10-10): NULL, 'Leader', 'Follower', 'Lead and Follow'. The labels
 * are the site's existing badge words (PARTNER_ROLE_OPTIONS in
 * components/profile/dancerConstants: Leader / Follower / Both); what is SENT
 * is always the stored spelling, so nothing depends on the server's
 * normalize_dance_role mapping "Both".
 */
export type DanceRoleValue = "Leader" | "Follower" | "Lead and Follow";

export const DANCE_ROLE_OPTIONS: readonly { value: DanceRoleValue; label: string }[] = [
  { value: "Leader", label: "Leader" },
  { value: "Follower", label: "Follower" },
  { value: "Lead and Follow", label: "Both" },
];

/** What a stored dance_role reads as on screen: the picker's own label. An unknown value shows as stored. */
export const danceRoleLabel = (value: string): string => DANCE_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? value;

export const isDanceRoleValue = (value: unknown): value is DanceRoleValue =>
  typeof value === "string" && DANCE_ROLE_OPTIONS.some((o) => o.value === value);

export const DANCE_ROLE_REQUIRED_ERROR = "Choose your dance role.";

// ---- Session flags ---------------------------------------------------------
// sessionStorage, not localStorage: "Skip for now" lasts the browser session,
// and the post-login prompt belongs to one sign-in.

/** Set by a successful sign-in; consumed by the one hop to the Finish screen. */
export const POST_LOGIN_PROMPT_KEY = "finish_profile_prompt_pending";
/** Set by "Skip for now". Stops the hop for the session; the banner stays. */
export const SKIP_FINISH_PROFILE_KEY = "finish_profile_skipped";

const readFlag = (key: string): boolean => {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key: string, on: boolean) => {
  try {
    if (on) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* storage blocked: the banner still offers the screen */
  }
};

/**
 * Is this the account's FIRST sign-in? The hop to /finish-profile is armed only
 * then (owner decision 2026-10-10: "shown ONCE right after first login, then only
 * the banner"); every later sign-in gets the banner alone.
 *
 * Read off the session's own user object, no table: the first sign-in is the one
 * that confirms the email, so email_confirmed_at and last_sign_in_at are the same
 * moment (seconds apart). A later sign-in moves last_sign_in_at on. A user object
 * that has not recorded any sign-in yet is the first one. When it cannot be told
 * (no confirmation stamp, unparseable values) the answer is no: the banner still
 * offers the screen, and re-hopping a returning user is the failure being fixed.
 * Known miss: an account pre-confirmed when it was created gets the banner, not
 * the hop, on its first sign-in.
 */
export const FIRST_SIGN_IN_WINDOW_MS = 60_000;

export const isFirstSignIn = (
  user: { email_confirmed_at?: string | null; last_sign_in_at?: string | null } | null | undefined,
): boolean => {
  if (!user?.email_confirmed_at) return false;
  const confirmed = Date.parse(user.email_confirmed_at);
  if (Number.isNaN(confirmed)) return false;
  if (!user.last_sign_in_at) return true;
  const lastSignIn = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(lastSignIn)) return false;
  return Math.abs(lastSignIn - confirmed) <= FIRST_SIGN_IN_WINDOW_MS;
};

export const armPostLoginPrompt = () => writeFlag(POST_LOGIN_PROMPT_KEY, true);
export const clearPostLoginPrompt = () => writeFlag(POST_LOGIN_PROMPT_KEY, false);
export const isPostLoginPromptArmed = () => readFlag(POST_LOGIN_PROMPT_KEY);
export const skipFinishProfileForSession = () => writeFlag(SKIP_FINISH_PROFILE_KEY, true);
export const isFinishProfileSkipped = () => readFlag(SKIP_FINISH_PROFILE_KEY);
