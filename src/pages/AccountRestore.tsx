import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { CONTINUE_AS_PATH } from "@/lib/accountRouting";
import { DELETION_STATUS_KEY, deletionLanding, fetchDeletionStatus, restoreAccount, type RestoreOutcome } from "@/lib/accountDeletion";
import { ACCOUNT_CONTACT_EMAIL, accountContactHref, formatDeletedOn, restoreMessage } from "@/lib/accountDeletionCopy";

/**
 * /account/restore -- where signInLanding sends a person whose account is deleted
 * (= hidden, admin PR #820). Within 30 days it restores at once and says so; an
 * admin archive is never undone here; after 30 days it shows the deleted card.
 * Not behind the dancer-first gate: a hidden account has no live dancer profile.
 */

const PILL =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-[16px] text-[14px] font-semibold text-black";
const OUTLINE =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-[16px] text-[14px] font-semibold text-foreground";
const CARD = "space-y-2 rounded-xl border border-border bg-card p-3";

/** After 30 days: hidden and kept. Both actions go to the one contact address. */
export function DeletedCard({ deletedAt }: { deletedAt: string | null }) {
  const on = formatDeletedOn(deletedAt);
  return (
    <section className={CARD} data-testid="restore-deleted-card">
      <h2 className="text-[15px] font-semibold text-foreground">{on ? <>This account was deleted on {on}</> : "This account was deleted"}</h2>
      <p className="text-[14px] text-foreground">
        It is hidden from everyone and more than 30 days have passed, so signing in no longer brings it back. We still
        keep it, hidden. Write to us at <span className="break-all font-semibold">{ACCOUNT_CONTACT_EMAIL}</span> and we will help.
      </p>
      <a className={PILL} href={accountContactHref("Please restore my account")} data-testid="restore-ask-restore">
        Ask us to restore it
      </a>
      <a className={OUTLINE} href={accountContactHref("Please erase my account")} data-testid="restore-ask-erase">
        Ask us to erase it
      </a>
    </section>
  );
}

export function RestoreResult({ outcome, onRetry }: { outcome: RestoreOutcome; onRetry: () => void }) {
  const text = restoreMessage(outcome);
  if (outcome.kind === "window_closed") return <DeletedCard deletedAt={outcome.status?.requested_at ?? null} />;
  return (
    <section className={CARD} data-testid={`restore-${outcome.kind}`}>
      <p role={outcome.kind === "failed" ? "alert" : "status"} className="text-[14px] font-semibold text-foreground">{text}</p>
      {outcome.kind === "admin_archived" && (
        <a className={PILL} href={accountContactHref("An admin hid my profile")} data-testid="restore-contact">
          Contact us
        </a>
      )}
      {outcome.kind === "failed" ? (
        <button type="button" className={PILL} onClick={onRetry} data-testid="restore-retry">
          Try again
        </button>
      ) : outcome.kind === "admin_archived" ? (
        <Link to="/" className={OUTLINE}>Back to the calendar</Link>
      ) : (
        <Link to={CONTINUE_AS_PATH} replace className={PILL} data-testid="restore-continue">
          Continue
        </Link>
      )}
    </section>
  );
}

export const AccountRestoreScreen = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: [DELETION_STATUS_KEY, user?.id ?? null],
    queryFn: fetchDeletionStatus,
    enabled: Boolean(user?.id),
    staleTime: 0,
  });
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null);
  const started = useRef(false);
  const landing = status.data === undefined ? undefined : deletionLanding(status.data);

  const restore = async () => {
    setOutcome(null);
    const out = await restoreAccount();
    // The profile and sides are back: every cached read of them is stale.
    if (out.kind === "restored") await queryClient.invalidateQueries();
    setOutcome(out);
  };

  useEffect(() => {
    if (landing !== "restore" || started.current) return;
    started.current = true;
    void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing]);

  let body;
  if (status.isError) {
    body = (
      <section className={CARD} data-testid="restore-status-failed">
        <p role="alert" className="text-[14px] text-foreground">We couldn&rsquo;t check your account just now.</p>
        <button type="button" className={PILL} onClick={() => void status.refetch()}>Try again</button>
      </section>
    );
  } else if (landing === undefined || (landing === "restore" && !outcome)) {
    body = <Skeleton className="h-24 w-full rounded-xl" />;
  } else if (landing === "deleted-card") {
    body = <DeletedCard deletedAt={status.data?.requested_at ?? null} />;
  } else if (outcome) {
    body = <RestoreResult outcome={outcome} onRetry={() => void restore()} />;
  } else {
    body = <RestoreResult outcome={{ kind: "nothing_to_restore" }} onRetry={() => void restore()} />;
  }

  return (
    <div className="px-4 pb-24 pt-3">
      <div className="mx-auto w-full max-w-md space-y-3" data-testid="account-restore">
        <h1 className="text-lg font-bold text-foreground">Your account</h1>
        {body}
      </div>
    </div>
  );
};

const AccountRestore = () => {
  useNoindexMeta(true);
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs("accountRestore")}>
      <AuthGuard>
        <AccountRestoreScreen />
      </AuthGuard>
    </GlobalLayout>
  );
};

export default AccountRestore;
