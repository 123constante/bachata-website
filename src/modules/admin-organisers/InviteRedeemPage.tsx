import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { DancerProfileGate } from '@/components/account/DancerProfileGate';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { supabase } from '@/integrations/supabase/client';
import { buildSignInHref } from '@/lib/authRouting';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { finishProfileHref } from '@/lib/profileCompletion';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { redeemOrganiserInvite } from './adminApi';
import { EMAIL_UNPROVEN_REASON, SIGN_IN_AGAIN_REASONS, interpretRedeemWithMismatch } from './redeemMismatch';
import { fetchInvitePreview } from './invitePreview';
import { INVITE_PATH, REDEEM_COPY, TOKEN_RE, interpretRedeem, joiningAsName, type RedeemCopy } from './inviteModel';

/**
 * One in-flight redeem per token for the whole page lifetime. StrictMode mounts
 * effects twice and a refresh remounts the page; the RPC must run once (a second
 * call would answer already_member or used and hide the real outcome). Keyed by
 * token, holds only the promise, and is cleared when the attempt settles.
 */
const inFlight = new Map<string, Promise<ReturnType<typeof interpretRedeemWithMismatch>>>();

const BTN = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground';
const LINK = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium';

const JOIN_COPY: RedeemCopy = {
  title: 'Join your organiser team',
  body: 'Someone has invited you to manage an organiser on Bachata Calendar. Whoever uses this link joins the team.',
  action: null,
  terminal: false,
};

/** The signed-in person's dancer name for the join card; null when the row cannot be read (the card falls back to the e-mail). */
const fetchJoiningAsRow = async (profileId: string) => {
  const { data, error } = await supabase.from('dancer_profiles').select('first_name, display_name').eq('id', profileId).maybeSingle();
  if (error) throw error;
  return data as { first_name: string | null; display_name: string | null } | null;
};

/** The token leaves the address bar (and so history, the share sheet and Referer) once the link is finished with. */
const stripToken = () => {
  try {
    window.history.replaceState(window.history.state, '', INVITE_PATH);
  } catch {
    /* a sandboxed frame may refuse; the page works either way */
  }
};

function Card({ copy, children }: { copy: RedeemCopy; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 pt-10 text-center" data-testid="invite-card" role="status">
      <h1 className="text-lg font-semibold" data-testid="invite-title">{copy.title}</h1>
      <p className="text-sm text-muted-foreground" data-testid="invite-body">{copy.body}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Joining an organiser team is organiser onboarding, so a signed-in person with
 * an unfinished dancer profile finishes it first (DancerProfileGate; the token
 * rides in returnTo and the link is used on the way back). Signed out passes
 * through to the page's own sign-in card.
 */
export default function InviteRedeemPage() {
  useNoindexMeta(true);
  const { token = '' } = useParams<{ token: string }>();
  // A malformed token can never work: say so for everyone, before the gate sends anyone to finish a profile for it.
  if (!TOKEN_RE.test(token)) return <InvalidLink />;
  return (
    <DancerProfileGate fallback={<GlobalLayout><div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div></GlobalLayout>}>
      <InviteRedeem />
    </DancerProfileGate>
  );
}

function InvalidLink() {
  useEffect(() => { stripToken(); }, []);
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>
      <Card copy={REDEEM_COPY.invalid}>
        <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>
      </Card>
    </GlobalLayout>
  );
}

function InviteRedeem() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authStatus, signOut } = useAuth();
  const [copy, setCopy] = useState<RedeemCopy | null>(null);
  const [busy, setBusy] = useState(false);
  // M57 (owner decision): the link is bearer-style -- whoever is signed in joins -- so it is
  // used only once the person has seen who they are joining as and pressed Join.
  const [joining, setJoining] = useState(false);
  // The sign-in-again refusal on screen (email_mismatch or email_unproven), null for any other answer.
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { profileId } = useProfileCompletion();
  const nameEnabled = Boolean(user && profileId);
  const nameRow = useQuery({
    queryKey: ['invite-joining-as', profileId],
    queryFn: () => fetchJoiningAsRow(profileId as string),
    enabled: nameEnabled,
    retry: false,
    staleTime: 60_000,
  });
  const tokenRef = useRef(token);
  if (token) tokenRef.current = token;

  // Signed out: say who the invite is for, as a MASKED hint only (D36). Held in state, not the
  // query cache (the token is the key). No hint on any failure; the sign-in card is unchanged.
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const signedOut = authStatus !== 'resolving' && !user;
  useEffect(() => {
    if (!signedOut || !TOKEN_RE.test(token)) return;
    let live = true;
    void fetchInvitePreview(token).then((p) => { if (live) setEmailHint(p?.emailHint ?? null); });
    return () => { live = false; };
  }, [signedOut, token]);

  // Never leak the token in a Referer header to anything this page links or loads.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const run = useCallback(async () => {
    const t = tokenRef.current;
    if (!TOKEN_RE.test(t)) {
      setCopy(REDEEM_COPY.invalid);
      stripToken();
      return;
    }
    setBusy(true);
    let attempt = inFlight.get(t);
    if (!attempt) {
      attempt = redeemOrganiserInvite(t)
        .then(({ data, error }) => interpretRedeemWithMismatch(data, error))
        .catch(() => interpretRedeem(null, { message: 'network' }))
        .finally(() => { inFlight.delete(t); });
      inFlight.set(t, attempt);
    }
    const outcome = await attempt;
    setBusy(false);
    if (outcome.kind === 'redeemed') {
      stripToken();
      // The person may have opened Home in the last minute and cached "no organisers": refetch it before they land.
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      // A new seat lands on the welcome (Arc 1 1d for a first page, 7c for another); already a member: Home.
      navigate(outcome.alreadyMember ? ORG_PATHS.home : ORG_PATHS.welcome(outcome.organiserId), { replace: true });
      return;
    }
    if (outcome.copy.terminal) stripToken();
    setMismatch(outcome.kind === 'refused' && SIGN_IN_AGAIN_REASONS.includes(outcome.reason) ? outcome.reason : null);
    setCopy(outcome.copy);
  }, [navigate, queryClient]);

  const join = () => {
    setJoining(true);
    void run();
  };

  // "Not you? Sign out": the one shared sign-out (it also clears the person's storage), then
  // this invite's sign-in, the link still unused. A failed sign-out stays here and says so.
  const notYou = async () => {
    setSignOutError(null);
    const outcome = await signOut();
    if (outcome === 'failed') {
      setSignOutError('You are still signed in. Check your connection and try again.');
      return;
    }
    navigate(buildSignInHref(`${INVITE_PATH}/${tokenRef.current}`), { replace: true });
  };

  let body: React.ReactNode;
  if (authStatus === 'resolving' || (user && !joining && nameEnabled && nameRow.isPending)) {
    body = <div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div>;
  } else if (!user && TOKEN_RE.test(token)) {
    const here = `${INVITE_PATH}/${token}`;
    body = (
      <Card copy={{ title: 'Join your organiser team', body: 'Someone has invited you to manage an organiser on Bachata Calendar. Sign in with your own email, then you will come straight back here and the link is used.', action: 'sign_in', terminal: false }}>
        {emailHint && <p className="text-sm font-medium" data-testid="invite-email-hint">This invite is for {emailHint}. Sign in with that email.</p>}
        <Link to={buildSignInHref(here)} className={BTN} data-testid="invite-sign-in">Sign in</Link>
      </Card>
    );
  } else if (user && !joining) {
    body = (
      <Card copy={JOIN_COPY}>
        <p className="text-sm font-medium" data-testid="invite-joining-as">You are joining as {joiningAsName(nameRow.data, user.email)}</p>
        <button type="button" className={BTN} onClick={join} data-testid="invite-join">Join the team</button>
        <button type="button" className={LINK} onClick={() => void notYou()} data-testid="invite-not-you">Not you? Sign out</button>
        {signOutError && <p className="text-sm text-destructive" role="alert" data-testid="invite-signout-error">{signOutError}</p>}
      </Card>
    );
  } else if (copy || !user) {
    body = (
      <Card copy={copy ?? REDEEM_COPY.invalid}>
        {copy?.action === 'sign_in' && <Link to={buildSignInHref(TOKEN_RE.test(token) ? `${INVITE_PATH}/${token}` : null)} className={BTN} data-testid="invite-sign-in">Sign in</Link>}
        {copy?.action === 'retry' && <button type="button" className={BTN} disabled={busy} onClick={() => void run()} data-testid="invite-retry">Try again</button>}
        {copy?.action === 'finish_profile' && <Link to={finishProfileHref(`${INVITE_PATH}/${token}`)} className={BTN} data-testid="invite-finish-profile">Finish profile</Link>}
        {mismatch && <button type="button" className={BTN} onClick={() => void notYou()} data-testid="invite-mismatch-signout">{mismatch === EMAIL_UNPROVEN_REASON ? 'Sign in with the email link' : 'Sign out'}</button>}
        {signOutError && mismatch && <p className="text-sm text-destructive" role="alert">{signOutError}</p>}
        {copy?.action !== 'retry' && copy?.action !== 'finish_profile' && <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>}
      </Card>
    );
  } else {
    body = <div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-working" role="status" aria-live="polite"><p className="text-sm text-muted-foreground">Using your link&hellip;</p><Skeleton className="h-16 w-full" /></div>;
  }
  return <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>{body}</GlobalLayout>;
}
