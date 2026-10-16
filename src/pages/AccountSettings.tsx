import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailText } from "@/components/account/EmailText";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/hooks/useAuth";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { useMyProfileVisibility } from "@/hooks/useMyProfileVisibility";
import { getSupabase } from "@/integrations/supabase/getSupabase";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { isPlausibleEmail } from "@/modules/organiser/shared/emailShape";
import {
  APP_OPTIONS_PATH,
  BACK_TO_OPTIONS_LABEL,
  ERASE_CONFIRM_WORD,
  canConfirmErase,
  isFromApp,
  withFromApp,
  downloadAccountExport,
  eraseAccount,
  eraseCheckFact,
  fetchEraseCheck,
  setProfileDisabled,
  type DeleteRefusalCode,
  type EraseBlocker,
  type EraseCode,
} from "@/lib/accountSettings";
import { ACCOUNT_CONTACT_EMAIL, OTHER_DEVICES_NOT_SIGNED_OUT, deleteRefusalMessage } from "@/lib/accountDeletionCopy";
import { toast } from "@/hooks/use-toast";
import { SIGN_OUT_FAILED, useSignOutToHome } from "@/components/account/profiles/signOutToHome";
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL } from "@/lib/accountRouting";

/**
 * /account/settings, /account/settings/ownership, /account/settings/delete.
 *
 * Deliberately NOT behind the dancer-first gate: a person with an unfinished (or no)
 * dancer profile must still be able to sign out, hide the profile or delete the
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
/** Old address of the delete step (audit M21): it now opens the delete view itself, so old links still work. */
export const OWNERSHIP_PATH = "/account/settings/ownership";
export const DELETE_PATH = "/account/settings/delete";
export const DELETED_PATH = "/account/deleted";

type View = "home" | "ownership" | "delete";

/** Came from the dancer app (`?from=app`, audit M4): keep that context on every in-settings link. */
const useFromApp = () => isFromApp(useLocation().search);

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

// Review #789 B1: both buttons go through the one sign-out path (leave first, then sign out),
// so AuthGuard cannot send the person to "Welcome back" first.
export function SignOutSection() {
  const { user } = useAuth();
  const { signOutToHome, busy } = useSignOutToHome();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setFailed(false);
    if ((await signOutToHome()) === "failed") setFailed(true);
  };
  return (
    <Section title="Sign out">
      <p className={NOTE}>{user?.email ? <>Signed in as <EmailText email={user.email} />.</> : <>Signed in.</>}</p>
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
        <p role="alert" className={ERR}>{SIGN_OUT_FAILED}</p>
      )}
      <SignOutEverywhere />
    </Section>
  );
}

/** D6: ends every session of this account (other phones and laptops too), then this one. */
function SignOutEverywhere() {
  const { signOutToHome, busy } = useSignOutToHome();
  const [note, setNote] = useState<string | null>(null);
  const go = async () => {
    setNote(null);
    const outcome = await signOutToHome({ everywhere: true });
    if (outcome === "failed") {
      setNote(SIGN_OUT_FAILED);
      return;
    }
    // "signed-out-locally": this device is out, the global revoke did not land. Say so: the page
    // has gone by now, so the words ride a toast that outlives it.
    if (outcome === "signed-out-locally") {
      toast({ title: "Other devices may still be signed in", description: OTHER_DEVICES_NOT_SIGNED_OUT, variant: "destructive", duration: 20000 });
    }
  };
  return (
    <div className="space-y-2 border-t border-border pt-2">
      <p className={NOTE}>Lost a phone, or signed in somewhere else? This signs you out everywhere, this device included.</p>
      <button type="button" className={OUTLINE} onClick={() => void go()} disabled={busy} data-testid="settings-signout-all">
        {busy ? <>Signing out&hellip;</> : "Sign out of all devices"}
      </button>
      {note && <p role="alert" className={ERR} data-testid="settings-signout-all-error">{note}</p>}
    </div>
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
      <p className={NOTE}>{current ? <>Your email is <EmailText email={current} />.</> : "Your email isn't shown here."}</p>
      {pending && (
        <p role="status" className="text-[14px] text-foreground" data-testid="settings-email-pending">
          Almost there: check both inboxes. We sent a link to {current ? <EmailText email={current} /> : "your current address"} and to{" "}
          <EmailText email={pending} />. Open both links to switch to <EmailText email={pending} />; until then you still sign in with{" "}
          {current ? <EmailText email={current} /> : "your current email"}.
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
              ? `${HIDDEN_STATE_LINE} You can show it again any time.`
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
              {busy ? <>Working&hellip;</> : hidden ? SHOW_AGAIN_LABEL : "Hide my profile"}
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
  const fromApp = useFromApp();
  return (
    <div className="space-y-3">
      <EmailSection />
      <VisibilitySection />
      <Section title="Your data">
        <p className={NOTE}>Saves a file with what we hold about you: your profile, ratings and attendance.</p>
        <ExportButton testId="settings-export" />
      </Section>
      <Section title="Delete account" testId="settings-delete">
        <p className={NOTE}>Your account is hidden from everyone at once. Sign in within 30 days to undo it.</p>
        <Link to={withFromApp(DELETE_PATH, fromApp)} className={OUTLINE} data-testid="settings-delete-link">
          Delete account
        </Link>
      </Section>
      <SignOutSection />
    </div>
  );
}

function Blocked({ text, names, code }: { text: string; names: string[]; code: EraseCode | DeleteRefusalCode | null }) {
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

export function Delete() {
  const { user } = useAuth();
  const { signOutToHome } = useSignOutToHome();
  const fromApp = useFromApp();
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
  const [late, setLate] = useState<{ code: DeleteRefusalCode; blockers: EraseBlocker[] } | null>(null);

  // A late refusal (the edge function's code) reads through the same one mapping as the check.
  const fact = late
    ? { kind: "refused" as const, text: deleteRefusalMessage(late.code), blockerNames: late.blockers.map((b) => b.name) }
    : check.data
      ? eraseCheckFact(check.data)
      : null;
  const loading = check.isLoading && !late;
  const failed = !late && (check.isError || (check.isPending && check.isPaused));
  const blocked = fact !== null && fact.kind !== "can_erase";
  const canType = fact?.kind === "can_erase";
  const enabled = canType && canConfirmErase(typed) && !busy;

  const erase = async () => {
    if (!enabled) return;
    setBusy(true);
    setError(null);
    const out = await eraseAccount();
    if (out.kind === "hidden") {
      // Hidden now; every device is signed out (signing in again within 30 days restores it).
      // Review #789 B1: leave for /account/deleted FIRST, then sign out (the one sign-out path),
      // or AuthGuard sends the person to the sign-in form. The account is hidden either way, so a
      // failed sign-out stays on the deleted page, which says the other devices may be signed in.
      const outcome = await signOutToHome({ everywhere: true, to: DELETED_PATH, onFailed: "stay" });
      queryClient.clear();
      if (outcome !== "signed-out") navigate(DELETED_PATH, { replace: true, state: { otherDevicesSignedIn: true } });
      return;
    }
    setBusy(false);
    if (out.kind === "refused") setLate({ code: out.code, blockers: out.blockers });
    else setError(deleteRefusalMessage(null));
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
      <Section title="What happens" testId="delete-lost">
        <ul className="list-disc space-y-1 pl-5 text-[14px] text-foreground">
          <li>Your profile is hidden from everyone straight away, and you are signed out on every device.</li>
          <li>Sign in within 30 days to undo it: your account comes back as it was.</li>
          <li>
            After that it stays hidden. For a full erase of your data, ask us at{" "}
            <EmailText email={ACCOUNT_CONTACT_EMAIL} className="font-semibold" />.
          </li>
        </ul>
      </Section>
      <Section title="Keep a copy first?">
        <p className={NOTE}>Download your data now, while you are signed in.</p>
        <ExportButton testId="delete-export" />
      </Section>
      <Section title="Or just hide your profile">
        <p className={NOTE}>Hiding is reversible and keeps your account.</p>
        <Link to={withFromApp(SETTINGS_PATH, fromApp)} className={OUTLINE} data-testid="delete-hide-instead">
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
          // M3: Enter / the keyboard's Done submits; erase() refuses unless the word is typed.
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void erase();
            }}
          >
            <label htmlFor="delete-type-input" className="block text-[13px] font-semibold text-foreground">
              Type {ERASE_CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-type-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-[16px]"
              data-testid="delete-type-input"
            />
          </form>
        )}
        <button type="button" className={DANGER} disabled={!enabled} onClick={() => void erase()} data-testid="delete-confirm">
          {busy ? <>Deleting&hellip;</> : "Delete my account"}
        </button>
        {!enabled && !busy && (
          <p className={NOTE} data-testid={blocked ? "delete-blocked-reason" : "delete-confirm-reason"}>{reason}</p>
        )}
        {error && <p role="alert" className={ERR} data-testid="delete-error">{error}</p>}
      </Section>
    </div>
  );
}

// The old ownership step is gone (M21): its address shows the delete view, with the delete crumbs.
const TITLES: Record<View, string> = { home: ACCOUNT_SETTINGS_LABEL, ownership: "Delete account", delete: "Delete account" };
const CRUMBS = { home: "accountSettings", ownership: "accountSettings.delete", delete: "accountSettings.delete" } as const;

export const AccountSettingsScreen = ({ view = "home" }: { view?: View }) => {
  const fromApp = useFromApp();
  return (
    // L7: a task page; no floating decoration under the form text.
    // S1 (review #789): the "Account settings" crumb keeps ?from=app, or "Back to Options" is lost one tap later.
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs(CRUMBS[view]).map((c) => (c.path === SETTINGS_PATH ? { ...c, path: withFromApp(c.path, fromApp) } : c))}
      showGradientBg={false}
    >
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3">
          {fromApp && (
            <Link
              to={APP_OPTIONS_PATH}
              className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-primary underline underline-offset-2"
              data-testid="settings-back-to-options"
            >
              {BACK_TO_OPTIONS_LABEL}
            </Link>
          )}
          <h1 className="text-lg font-bold text-foreground">{TITLES[view]}</h1>
          {view === "home" ? <Home /> : <Delete />}
        </div>
      </div>
    </GlobalLayout>
  );
};

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
