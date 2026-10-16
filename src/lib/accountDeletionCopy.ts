// The words of delete = hide (admin PR #820). Kept OUT of lib/accountDeletion, which
// lib/accountRouting (every page's first load) imports: only the screens that show
// these words load them.
import type { RestoreOutcome } from "./accountDeletion";

/**
 * Where a full erase, or a restore after 30 days, is asked for: the address the /privacy
 * page (Website PR #762) names. The ONE copy: every screen and mailto reads this constant.
 */
export const ACCOUNT_CONTACT_EMAIL = "support@bachatacalendar.co.uk";
export const accountContactHref = (subject: string): string =>
  `mailto:${ACCOUNT_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/**
 * "Sign out of all devices" (and the delete, which does the same) when only THIS device signed
 * out: the global revoke did not reach the server, so other devices may still be signed in.
 * Never let the person believe otherwise (a lost phone is the reason to press it).
 */
export const OTHER_DEVICES_NOT_SIGNED_OUT =
  "This device is signed out, but we couldn't reach the server to sign out your other devices. Sign in and try again.";

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
      // _member_rate_check_v1('account_delete', 3, interval '1 day'): a rolling 24 hours, not a calendar day.
      return "You've tried this several times. Please wait 24 hours and try again.";
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
