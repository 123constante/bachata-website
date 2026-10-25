import { Link, useLocation } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { EmailText } from "@/components/account/EmailText";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { buildSignInHref } from "@/lib/authRouting";
import { ACCOUNT_RESTORE_PATH } from "@/lib/accountRouting";
import { ACCOUNT_CONTACT_EMAIL, OTHER_DEVICES_NOT_SIGNED_OUT } from "@/lib/accountDeletionCopy";

const BTN = "inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-[16px] text-[14px] font-semibold";

/** Shown after the account was deleted (= hidden, admin PR #820). Public: the person is signed out by then. */
const AccountDeleted = () => {
  useNoindexMeta(true);
  // The delete (pages/AccountSettings) signs out everywhere; when only this device got out, say so.
  const otherDevicesSignedIn = Boolean((useLocation().state as { otherDevicesSignedIn?: boolean } | null)?.otherDevicesSignedIn);
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs("accountDeleted")} showGradientBg={false}>
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3" data-testid="account-deleted">
          <h1 className="text-lg font-bold text-foreground">Your account was deleted</h1>
          <p className="text-[14px] text-foreground" data-testid="account-deleted-copy">
            Your profile is hidden now, and you&rsquo;re signed out. Sign in within 30 days to undo. After that it stays
            hidden; ask us at <EmailText email={ACCOUNT_CONTACT_EMAIL} className="font-semibold" /> for a full erase.
          </p>
          {otherDevicesSignedIn && (
            <p role="alert" className="text-[14px] font-semibold text-foreground" data-testid="account-deleted-other-devices">
              {OTHER_DEVICES_NOT_SIGNED_OUT}
            </p>
          )}
          {/* L21: the undo the copy promises. A deleted login lands on /account/restore after sign-in anyway
              (accountRouting signInLanding); the returnTo keeps that true if the deletion read is slow. */}
          <Link to={buildSignInHref(ACCOUNT_RESTORE_PATH)} className={`${BTN} bg-primary text-black`} data-testid="account-deleted-signin">
            Sign in to undo
          </Link>
          <p className="text-[13px] text-muted-foreground">You can still browse parties without an account.</p>
          <Link to="/" className={`${BTN} border border-border text-foreground`}>
            Back to the calendar
          </Link>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default AccountDeleted;
