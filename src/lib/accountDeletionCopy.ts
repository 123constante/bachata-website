// The words of delete = hide (admin PR #820). Kept OUT of lib/accountDeletion, which
// lib/accountRouting (every page's first load) imports: only the screens that show
// these words load them.
import type { RestoreOutcome } from "./accountDeletion";

/**
 * Where a full erase, or a restore after 30 days, is asked for. NEEDS OWNER: there is
 * no /privacy page on the site yet; when it exists it must name this same address.
 */
export const ACCOUNT_CONTACT_EMAIL = "privacy@bachatacalendar.co.uk";
export const accountContactHref = (subject: string): string =>
  `mailto:${ACCOUNT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/** The words each restore outcome shows. One mapping, read by the restore screen and its tests. */
export const restoreMessage = (out: RestoreOutcome): string => {
  switch (out.kind) {
    case "restored":
      return "Welcome back, your account is restored.";
    case "admin_archived":
      return `An admin has hidden this profile, so we can't restore it from here. Contact us at ${ACCOUNT_CONTACT_EMAIL}.`;
    case "window_closed":
      return "More than 30 days have passed, so this account stays hidden.";
    case "nothing_to_restore":
      return "Your account is not hidden. Nothing needed restoring.";
    default:
      return "We couldn't restore your account just now. Check your connection and try again.";
  }
};

/** One human message per refusal; anything unknown is the generic retry line. */
export const deleteRefusalMessage = (code: string | null): string => {
  switch (code) {
    case "admin_account":
      return "This is an admin account, so it can't be deleted here. You can still hide your dancer profile instead.";
    case "sole_organiser_owner":
      return "You're the only owner of the organiser page(s) below. Add another owner, or remove the page, then come back to delete your account.";
    case "already_archived":
      return `An admin has already hidden this profile, so there is nothing to delete here. Contact us at ${ACCOUNT_CONTACT_EMAIL} if you need help.`;
    case "rate_limited":
      return "You've tried this several times today. Please wait until tomorrow and try again.";
    default:
      return "Something went wrong and your account was not deleted. Please try again.";
  }
};

/** "15 October 2026" in London time: the date a deleted card names. */
export const formatDeletedOn = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
};
