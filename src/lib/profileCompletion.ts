import { sanitizeReturnTo } from "@/lib/authRouting";
import { WHATSAPP_GET_LISTED_URL } from "@/lib/contactLinks";

/**
 * "Is this person's dancer profile finished?" -- the ONE client mapping of that
 * fact. The Finish-your-profile screen, the site-wide reminder banner and the
 * party-rating gate all read it from here, so they cannot disagree.
 *
 * The definition is the server's: `profile_complete_v1(uuid)` (admin
 * 20261109950000) = first_name, based_city_id, dance_role and avatar_url all
 * non-empty after trimming. The boolean comes from that RPC; the list of WHICH
 * fields are missing is re-derived here only to know what to ask for.
 *
 * The profile id is `_my_dancer_profile_id_v1()` (a linked admin-made profile
 * through claimed_by, else the caller's own row), never assumed to be
 * auth.uid() -- see useProfileCompletion.
 */

export type ProfileField = "first_name" | "based_city_id" | "dance_role" | "avatar_url";

export const PROFILE_FIELDS: readonly ProfileField[] = ["first_name", "based_city_id", "dance_role", "avatar_url"];

export const PROFILE_FIELD_LABEL: Record<ProfileField, string> = {
  first_name: "first name",
  based_city_id: "city",
  dance_role: "dance role",
  avatar_url: "photo",
};

export type ProfileRow = Partial<Record<ProfileField, string | null>>;

/** Mirrors profile_complete_v1: a value counts only when it is non-empty after trimming. No row = all missing. */
export const missingProfileFields = (row: ProfileRow | null | undefined): ProfileField[] => {
  if (!row) return [...PROFILE_FIELDS];
  return PROFILE_FIELDS.filter((field) => !(typeof row[field] === "string" && row[field]!.trim().length > 0));
};

export type ProfileCompletionStatus =
  | "signed_out"
  | "loading"
  | "complete"
  | "incomplete"
  /** Signed in, but `_my_dancer_profile_id_v1` found no dancer profile -- nothing the person can fill in. */
  | "no_profile"
  /** The check itself failed. Every surface fails OPEN: no banner, rating not blocked. */
  | "error";

export type ProfileCompletion = {
  status: ProfileCompletionStatus;
  missing: ProfileField[];
  profileId: string | null;
};

/** The shared fact. Banner shown, rating blocked and screen-has-work are all exactly this. */
export const needsFinishing = (c: Pick<ProfileCompletion, "status">): boolean =>
  c.status === "incomplete" || c.status === "no_profile";

/** "photo", "dance role and photo", "first name, city and photo". */
export const listFieldLabels = (fields: readonly ProfileField[]): string => {
  const labels = fields.map((f) => PROFILE_FIELD_LABEL[f]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

export const FINISH_PROFILE_PATH = "/finish-profile";

export const finishProfileHref = (returnTo?: string | null): string => {
  const safe = sanitizeReturnTo(returnTo ?? null);
  return safe ? `${FINISH_PROFILE_PATH}?returnTo=${encodeURIComponent(safe)}` : FINISH_PROFILE_PATH;
};

export const RATE_BLOCKED_REASON = "Finish your profile to rate";
export const NO_PROFILE_REASON = "Your account has no dancer profile yet, so it can\u2019t rate";
export const NO_PROFILE_CONTACT_LABEL = "Message us on WhatsApp";
export const NO_PROFILE_CONTACT_URL = WHATSAPP_GET_LISTED_URL;

// One flat shape, not a union on `allowed`: this repo compiles without
// strictNullChecks, where a boolean discriminant does not narrow.
export type RatingGate = { allowed: boolean; reason: string; linkLabel: string; href: string; external: boolean };

const RATING_ALLOWED: RatingGate = { allowed: true, reason: "", linkLabel: "", href: "", external: false };

/** Rating tiles: disabled WITH a reason and a way forward whenever needsFinishing. */
export const ratingGate = (c: ProfileCompletion, returnTo?: string): RatingGate => {
  if (c.status === "incomplete") {
    return { allowed: false, reason: RATE_BLOCKED_REASON, linkLabel: "Finish your profile", href: finishProfileHref(returnTo), external: false };
  }
  if (c.status === "no_profile") {
    return { allowed: false, reason: NO_PROFILE_REASON, linkLabel: NO_PROFILE_CONTACT_LABEL, href: NO_PROFILE_CONTACT_URL, external: true };
  }
  return RATING_ALLOWED;
};

/** What ProfileCompletionChrome publishes to the rating card (ProfileGateContext in hooks/useAuth). */
export const profileGateValue = (c: ProfileCompletion): { status: ProfileCompletionStatus; gateFor: (returnTo: string) => RatingGate } => ({
  status: c.status,
  gateFor: (returnTo: string) => ratingGate(c, returnTo),
});

export type BannerModel = {
  title: string;
  body: string;
  cta: { kind: "link"; label: string; href: string } | { kind: "external"; label: string; href: string };
};

const BANNER_HIDDEN_ON = (pathname: string) =>
  pathname === FINISH_PROFILE_PATH || pathname === "/auth" || pathname.startsWith("/auth/");

/** The reminder banner. `dismissed` is per page view; it never outlives a navigation. */
export const bannerModel = (
  c: ProfileCompletion,
  opts: { dismissed: boolean; pathname: string; returnTo?: string },
): BannerModel | null => {
  if (!needsFinishing(c) || opts.dismissed || BANNER_HIDDEN_ON(opts.pathname)) return null;
  if (c.status === "no_profile") {
    return {
      title: "Your dancer profile is missing",
      body: "Your account has no dancer profile yet, so you can\u2019t rate parties. Message us and we\u2019ll set it up.",
      cta: { kind: "external", label: NO_PROFILE_CONTACT_LABEL, href: NO_PROFILE_CONTACT_URL },
    };
  }
  return {
    title: "Finish your profile",
    body: `Add your ${listFieldLabels(c.missing)} to rate parties.`,
    cta: { kind: "link", label: "Finish profile", href: finishProfileHref(opts.returnTo ?? opts.pathname) },
  };
};

export type FinishScreenMode =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done" }
  | { kind: "no_profile" }
  | { kind: "form"; fields: ProfileField[] };

export const finishScreenMode = (c: ProfileCompletion): FinishScreenMode => {
  switch (c.status) {
    case "incomplete":
      return { kind: "form", fields: c.missing };
    case "no_profile":
      return { kind: "no_profile" };
    case "loading":
    case "signed_out":
      return { kind: "loading" };
    case "error":
      return { kind: "error" };
    default:
      return { kind: "done" };
  }
};

// The session flags live in lib/auth-otp-routing (import-free, shared with the
// sign-up path and /auth/callback); re-exported so every surface reads this module.
export {
  POST_LOGIN_PROMPT_KEY,
  SKIP_FINISH_PROFILE_KEY,
  armPostLoginPrompt,
  clearPostLoginPrompt,
  isFinishProfileSkipped,
  isPostLoginPromptArmed,
  skipFinishProfileForSession,
} from "@/lib/auth-otp-routing";

export type PostLoginDecision = "none" | "wait" | "redirect" | "clear";

/** Right after sign-in, once: hop to the Finish screen if there is something to finish. */
export const postLoginDecision = (input: {
  pending: boolean;
  skipped: boolean;
  status: ProfileCompletionStatus;
  pathname: string;
}): PostLoginDecision => {
  if (!input.pending) return "none";
  if (input.pathname === "/auth" || input.pathname.startsWith("/auth/")) return "wait";
  if (input.status === "loading" || input.status === "signed_out") return "wait";
  if (input.skipped || input.pathname === FINISH_PROFILE_PATH) return "clear";
  return needsFinishing(input) ? "redirect" : "clear";
};
