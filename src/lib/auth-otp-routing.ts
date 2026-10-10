// Pure auth-routing decisions for the magic-link flow, kept out of the page
// components so they can be unit-tested without a Supabase client.

// Shown when sign-in mode discovers the email has no account (Lever 2 walk B3).
/**
 * Digits in the emailed sign-in code. Must equal Supabase auth
 * `mailer_otp_length` (production: 8). Single source: the code box, its
 * labels and the tests all derive from this.
 */
export const OTP_CODE_LENGTH = 8;

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
export const SIGNUP_INVITE_ONLY_TITLE = "Sign-up is invite-only for now";
export const SIGNUP_INVITE_ONLY_DESCRIPTION =
  "This beta is limited to approved organisers. If you run bachata events and want in, ask us to add your email, then try again.";

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
// With organiser self-serve on, /account opens on "Which organiser are you?",
// which is the wrong first screen for a dancer who signed up to rate a class.
// So: organiser-type roles go to /account, dancers go home, and a sign-in that
// carries no role at all (older accounts) goes to /account only when the user
// already manages an organiser. `managesOrganiser` is `null` until looked up;
// the caller does the lookup only when `needsOrganiserLookup` says so.
const LEGACY_ROLE_ROUTES: Record<string, string> = {
  organiser: "/create-organiser-profile",
  videographer: "/create-videographer-profile",
};

export function normalizeLandingRole(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const role = raw.trim().toLowerCase();
  return role || null;
}

export function needsOrganiserLookup(input: { organiserSelfServe: boolean; role: string | null }): boolean {
  return input.organiserSelfServe && input.role === null;
}

export function landingPathAfterAuth(input: {
  organiserSelfServe: boolean;
  role: string | null;
  managesOrganiser: boolean | null;
}): string {
  const { organiserSelfServe, role, managesOrganiser } = input;
  if (!organiserSelfServe) {
    if (role && role !== "dancer" && LEGACY_ROLE_ROUTES[role]) return LEGACY_ROLE_ROUTES[role];
    return "/profile";
  }
  if (role === "dancer") return "/";
  if (role) return "/account";
  return managesOrganiser === false ? "/" : "/account";
}

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

export const armPostLoginPrompt = () => writeFlag(POST_LOGIN_PROMPT_KEY, true);
export const clearPostLoginPrompt = () => writeFlag(POST_LOGIN_PROMPT_KEY, false);
export const isPostLoginPromptArmed = () => readFlag(POST_LOGIN_PROMPT_KEY);
export const skipFinishProfileForSession = () => writeFlag(SKIP_FINISH_PROFILE_KEY, true);
export const isFinishProfileSkipped = () => readFlag(SKIP_FINISH_PROFILE_KEY);
