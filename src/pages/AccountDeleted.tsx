import { Link } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";

/** Shown after the account was erased. Public: the person is signed out by then. */
const AccountDeleted = () => {
  useNoindexMeta(true);
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs("accountDeleted")}>
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3" data-testid="account-deleted">
          <h1 className="text-lg font-bold text-foreground">Your account was deleted</h1>
          <p className="text-[14px] text-foreground">
            Your profile, photos, ratings and attendance are gone, and you&rsquo;re signed out. Thanks for dancing with us.
          </p>
          <p className="text-[13px] text-muted-foreground">You can still browse parties without an account.</p>
          <Link
            to="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-[16px] text-[14px] font-semibold text-black"
          >
            Back to the calendar
          </Link>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default AccountDeleted;
