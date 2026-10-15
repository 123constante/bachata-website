import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { useMyProfileVisibility } from "@/hooks/useMyProfileVisibility";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { isPlausibleEmail } from "@/modules/organiser/shared/emailShape";
import {
  ERASE_CONFIRM_WORD,
  canConfirmErase,
  downloadAccountExport,
  eraseAccount,
  eraseCheckFact,
  fetchEraseCheck,
  setProfileDisabled,
  type EraseBlocker,
  type EraseCode,
} from "@/lib/accountSettings";

/**
 * /account/settings, /account/settings/ownership, /account/settings/delete.
 *
 * Deliberately NOT behind the dancer-first gate: a person with an unfinished (or no)
 * dancer profile must still be able to sign out, hide the profile or erase the
 * account. lib/accountRouting isDancerGatedPath leaves these paths open.
 */

const PILL =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-[16px] text-[14px] font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50";
const OUTLINE =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border px-[16px] text-[14px] font-semibold text-foreground disabled:opacity-50";
const DANGER =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-destructive px-[16px] text-[14px] font-semibold text-white disabled:opacity-50";
const CARD = "space-y-2 rounded-xl border border-border bg-card p-3";
const NOTE = "text-[13px] text-muted-foreground";
const ERR = "text-[13px] text-destructive";

const SETTINGS_PATH = "/account/settings";
export const OWNERSHIP_PATH = "/account/settings/ownership";
export const DELETE_PATH = "/account/settings/delete";
export const DELETED_PATH = "/account/deleted";

type View = "home" | "ownership" | "delete";

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className={CARD} data-testid={testId}>
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Instant JSON download of everything held about the person (client-side Blob). */
function ExportButton({ testId, label = "Download my data" }: { testId: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const go = async () => {
    setBusy(true);
    setFailed(false);
    setDone(false);
    try {
      await downloadAccountExport();
      setDone(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <button type="button" className={OUTLINE} onClick={() => void go()} disabled={busy} data-testid={testId}>
        {busy ? <>Preparing your file&hellip;</> : label}
      </button>
      {done && <p role="status" className={NOTE}>Your file was saved to this device.</p>}
      {failed && (
        <p role="alert" className={ERR} data-testid={`${testId}-error`}>
          We couldn&rsquo;t prepare your file. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function SignOutSection() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true);
    setFailed(false);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === "failed") {
      setFailed(true);
      return;
    }
    navigate("/", { replace: true });
  };
  return (
    <Section title="Sign out">
      <p className={`${NOTE} break-all`}>{user?.email ? <>Signed in as {user.email}.</> : <>Signed in.</>}</p>
      {confirming ? (
        <div className="space-y-2">
          <button type="button" className={PILL} onClick={() => void go()} disabled={busy} data-testid="settings-signout-yes">
            {busy ? <>Signing out&hellip;</> : "Yes, sign out"}
          </button>
          <button type="button" className={OUTLINE} onClick={() => setConfirming(false)} disabled={busy}>
            Stay signed in
          </button>
        </div>
      ) : (
        <button type="button" className={OUTLINE} onClick={() => setConfirming(true)} data-testid="settings-signout">
          Sign out
        </button>
      )}
      {failed && (
        <p role="alert" className={ERR}>Sign-out did not complete. Check your connection and try again.</p>
      )}
    </Section>
  );
}

function EmailSection() {
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const current = user?.email ?? null;
  const pending = user?.new_email ?? sentTo;
  const typed = value.trim();
  const same = current !== null && typed.toLowerCase() === current.toLowerCase();
  const reason = !typed
    ? "Type the new email address you want to use."
    : !isPlausibleEmail(typed)
      ? "That doesn't look like an email address yet."
      : same
        ? "That's the email you already use. Type a new one."
        : null;

  const submit = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.updateUser({ email: typed });
      if (error) setFailed(true);
      else {
        setSentTo(typed);
        setValue("");
      }
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <Section title="Email address" testId="settings-email">
      <p className={`${NOTE} break-all`}>{current ? <>Your email is {current}.</> : "Your email isn't shown here."}</p>
      {pending && (
        <p role="status" className="text-[14px] text-foreground" data-testid="settings-email-pending">
          Almost there: check both inboxes. We sent a link to {current ?? "your current address"} and to {pending}.
          Open both links to switch to {pending}; until then you still sign in with {current ?? "your current email"}.
        </p>
      )}
      <label className="block text-[13px] font-semibold text-foreground" htmlFor="settings-email-input">
        New email
      </label>
      <input
        id="settings-email-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-[16px]"
        data-testid="settings-email-input"
      />
      <button
        type="button"
        className={PILL}
        disabled={busy || reason !== null}
        onClick={() => void submit()}
        data-testid="settings-email-submit"
      >
        {busy ? <>Sending&hellip;</> : "Change email"}
      </button>
      {reason && <p className={NOTE} data-testid="settings-email-reason">{reason}</p>}
      {failed && (
        <p role="alert" className={ERR} data-testid="settings-email-error">
          We could not change your email. If that address already has an account, use a different one. Otherwise check your connection and try again.
        </p>
      )}
    </Section>
  );
}

function VisibilitySection() {
  const vis = useMyProfileVisibility();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<boolean | null>(null); // true = hidden
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = vis.status;
  const hidden = local ?? (status === "hidden");
  const noProfile = status === "none";

  const apply = async (disable: boolean) => {
    setBusy(true);
    setError(null);
    const res = await setProfileDisabled(disable);
    setBusy(false);
    if ("code" in res) {
      setError(
        res.code === "no_profile"
          ? "You have no dancer profile, so there is nothing to hide."
          : res.code === "not_authenticated"
            ? "You've been signed out. Sign in again and retry."
            : "That didn't work. Check your connection and try again.",
      );
      return;
    }
    setLocal(res.disabled);
    setConfirming(false);
    void queryClient.invalidateQueries({ queryKey: ["my-profile-visibility"] });
  };

  return (
    <Section title="Hide your dancer profile" testId="settings-disable">
      {status === "loading" ? (
        <Skeleton className="h-11 w-full rounded-full" />
      ) : status === "error" ? (
        <div className="space-y-2">
          <p className={NOTE}>We couldn&rsquo;t check your profile just now.</p>
          <button type="button" className={OUTLINE} onClick={() => vis.refetch()}>Try again</button>
        </div>
      ) : noProfile ? (
        <p className={NOTE} data-testid="settings-disable-none">
          You have no dancer profile, so there is nothing to hide. You can still download your data or delete your account below.
        </p>
      ) : (
        <>
          <p className="text-[14px] text-foreground" data-testid="settings-disable-state">
            {hidden
              ? "Your dancer profile is hidden. Nobody else can see it. You can show it again any time."
              : "Your dancer profile is visible to everyone. Hiding it is not permanent: you can show it again any time."}
          </p>
          {hidden || !confirming ? (
            <button
              type="button"
              className={hidden ? PILL : OUTLINE}
              disabled={busy}
              onClick={() => (hidden ? void apply(false) : setConfirming(true))}
              data-testid="settings-disable-toggle"
            >
              {busy ? <>Working&hellip;</> : hidden ? "Show my profile again" : "Hide my profile"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className={NOTE}>Your profile will disappear from the site until you show it again.</p>
              <button type="button" className={PILL} disabled={busy} onClick={() => void apply(true)} data-testid="settings-disable-confirm">
                {busy ? <>Hiding&hellip;</> : "Yes, hide it"}
              </button>
              <button type="button" className={OUTLINE} disabled={busy} onClick={() => setConfirming(false)}>
                Keep it visible
              </button>
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className={ERR} data-testid="settings-disable-error">{error}</p>}
    </Section>
  );
}

function Home() {
  return (
    <div className="space-y-3">
      <EmailSection />
      <VisibilitySection />
      <Section title="Your data">
        <p className={NOTE}>Saves a file with what we hold about you: your profile, ratings and attendance.</p>
        <ExportButton testId="settings-export" />
      </Section>
      <Section title="Account ownership">
        <p className={NOTE}>Delete your account for good.</p>
        <Link to={OWNERSHIP_PATH} className={OUTLINE} data-testid="settings-ownership-link">
          Account ownership
        </Link>
      </Section>
      <SignOutSection />
    </div>
  );
}

function Ownership() {
  return (
    <div className="space-y-3">
      <Section title="Delete your account">
        <p className="text-[14px] text-foreground">
          Deleting your account is permanent. If you just want a break, hide your dancer profile instead: you can bring it back any time.
        </p>
        <Link to={SETTINGS_PATH} className={OUTLINE}>Back to settings</Link>
        <Link to={DELETE_PATH} className={OUTLINE} data-testid="ownership-delete-link">
          Delete account
        </Link>
      </Section>
    </div>
  );
}

function Blocked({ text, names, code }: { text: string; names: string[]; code: EraseCode | null }) {
  return (
    <div className="space-y-2 rounded-xl border border-destructive/60 p-3" data-testid="delete-blocked" data-code={code ?? ""}>
      <p className="text-[14px] text-foreground">{text}</p>
      {names.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-[14px] font-semibold text-foreground">
          {names.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

function Delete() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const check = useQuery({
    queryKey: ["account-erase-check", user?.id ?? null],
    queryFn: fetchEraseCheck,
    enabled: Boolean(user?.id),
    gcTime: 0,
    staleTime: 0,
  });
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [late, setLate] = useState<{ code: EraseCode | null; blockers: EraseBlocker[] } | null>(null);

  const fact = late
    ? eraseCheckFact({ can_erase: false, blockers: late.blockers, code: late.code })
    : check.data
      ? eraseCheckFact(check.data)
      : null;
  const loading = check.isLoading && !late;
  const failed = !late && (check.isError || (check.isPending && check.isPaused));
  const blocked = fact !== null && fact.kind !== "can_erase";
  const canType = fact?.kind === "can_erase";
  const enabled = canType && canConfirmErase(typed) && !busy;

  const erase = async () => {
    setBusy(true);
    setError(null);
    const out = await eraseAccount();
    if (out.kind === "erased") {
      // The session is gone server-side, so a failing sign-out is expected: ignore it.
      try {
        await signOut();
      } catch {
        /* ignored */
      }
      queryClient.clear();
      navigate(DELETED_PATH, { replace: true });
      return;
    }
    setBusy(false);
    if (out.kind === "blocked") setLate({ code: out.code, blockers: out.blockers });
    else if (out.kind === "media_failed") {
      setError("We couldn't delete your photos, so nothing was deleted. Please try again.");
    } else setError("Something went wrong and we couldn't confirm your account was deleted. Please try again.");
  };

  const reason = blocked
    ? "You cannot delete your account yet. See the reason above."
    : loading
      ? "Checking whether your account can be deleted..."
      : failed
        ? "We couldn't check your account. Try again first."
        : `The button works once you type ${ERASE_CONFIRM_WORD} in capital letters.`;

  return (
    <div className="space-y-3">
      <Section title="What you will lose" testId="delete-lost">
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-foreground">
          <li>Your dancer profile and photos</li>
          <li>Your ratings and your attendance history</li>
          <li>Your sign-in: you will not be able to log back in</li>
        </ul>
        <p className="text-[14px] font-semibold text-foreground">This happens straight away and cannot be undone.</p>
      </Section>
      <Section title="Keep a copy first?">
        <p className={NOTE}>Download your data now. After deleting, it is gone.</p>
        <ExportButton testId="delete-export" />
      </Section>
      <Section title="Or just hide your profile">
        <p className={NOTE}>Hiding is reversible and keeps your account.</p>
        <Link to={SETTINGS_PATH} className={OUTLINE} data-testid="delete-hide-instead">
          Hide my profile instead
        </Link>
      </Section>
      <Section title="Delete my account">
        {loading && <Skeleton className="h-11 w-full rounded-lg" />}
        {failed && (
          <div className="space-y-2" data-testid="delete-check-failed">
            <p className={ERR}>We couldn&rsquo;t check your account just now.</p>
            <button type="button" className={OUTLINE} onClick={() => void check.refetch()}>Try again</button>
          </div>
        )}
        {fact && blocked && <Blocked text={fact.text} names={fact.blockerNames} code={late ? late.code : (check.data?.code ?? null)} />}
        {canType && (
          <>
            <label htmlFor="delete-type-input" className="block text-[13px] font-semibold text-foreground">
              Type {ERASE_CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-type-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-[16px]"
              data-testid="delete-type-input"
            />
          </>
        )}
        <button type="button" className={DANGER} disabled={!enabled} onClick={() => void erase()} data-testid="delete-confirm">
          {busy ? <>Deleting&hellip;</> : "Delete my account for good"}
        </button>
        {!enabled && !busy && (
          <p className={NOTE} data-testid={blocked ? "delete-blocked-reason" : "delete-confirm-reason"}>{reason}</p>
        )}
        {error && <p role="alert" className={ERR} data-testid="delete-error">{error}</p>}
      </Section>
    </div>
  );
}

const TITLES: Record<View, string> = { home: "Settings", ownership: "Account ownership", delete: "Delete account" };
const CRUMBS = { home: "accountSettings", ownership: "accountSettings.ownership", delete: "accountSettings.delete" } as const;

export const AccountSettingsScreen = ({ view = "home" }: { view?: View }) => (
  <GlobalLayout breadcrumbs={buildBreadcrumbs(CRUMBS[view])}>
    <div className="px-4 pb-24 pt-3">
      <div className="mx-auto w-full max-w-md space-y-3">
        <h1 className="text-lg font-bold text-foreground">{TITLES[view]}</h1>
        {view === "home" ? <Home /> : view === "ownership" ? <Ownership /> : <Delete />}
      </div>
    </div>
  </GlobalLayout>
);

// Signed out -> /auth with returnTo. no dancer-first gate: see the header comment.
const AccountSettings = ({ view = "home" }: { view?: View }) => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <AccountSettingsScreen view={view} />
    </AuthGuard>
  );
};

export default AccountSettings;
