import { ORG_PATHS } from "@/modules/organiser/shell/paths";
import {
  CLAIM_TOAST_MS,
  claimedNoticeText,
  notYouOrganiserHref,
  stashClaimNotice,
  type ClaimedOrganiser,
} from "@/lib/claimMyOrganisers";

// What BOTH sign-in paths (AuthCallback: emailed link; AuthStepper: typed code) do with the pages
// the claim just joined. One copy, so the two cannot drift.

/**
 * Where a claim lands when there is no return path: organiser Home after a claim, else null. Stashes
 * the notice (once) for Home, which draws it in its own flow with a Close.
 */
export const claimLandingPath = (claimed: readonly ClaimedOrganiser[], noticeShown: boolean): string | null => {
  if (claimed.length === 0) return null;
  if (!noticeShown) stashClaimNotice(claimed);
  return ORG_PATHS.home;
};

/** True when a short toast should say it: landing anywhere but Home, and not said already. */
export const shouldToastClaim = (claimed: readonly ClaimedOrganiser[], noticeShown: boolean, path: string): boolean =>
  claimed.length > 0 && !noticeShown && path.split(/[?#]/)[0] !== ORG_PATHS.home;

/** The short toast (never Infinity: the shared toast sits mid-screen). */
export const claimToastProps = (claimed: readonly ClaimedOrganiser[]) => ({
  title: claimedNoticeText(claimed),
  // A plain link in the description, not ToastAction: importing components/ui/toast here
  // split it into its own first-load chunk on every route (check:first-load-requests).
  description: (
    <span>
      Not you?{" "}
      <a className="inline-flex min-h-[44px] items-center px-2 underline" href={notYouOrganiserHref(claimed)} target="_blank" rel="noopener noreferrer">Tell us</a>
    </span>
  ),
  duration: CLAIM_TOAST_MS,
});
