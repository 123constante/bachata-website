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
import { PROFILE_INCOMPLETE_CODE } from '@/lib/accountRouting';
import { buildSignInHref } from '@/lib/authRouting';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { finishProfileHref } from '@/lib/profileCompletion';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { clearInvitePrefill, rememberInvitePrefill } from '@/lib/invitePrefill';
import { rememberCodeStep } from '@/components/MagicLinkConfirmation';
import { redeemOrganiserInvite } from './adminApi';
import { fetchInvitePreview, invitePreviewQueryKey, requestNewInvite, sendInviteSignInEmail } from './inviteRedeemApi';
import { INVITE_PATH, REDEEM_COPY, TOKEN_RE, interpretRedeem, joiningAsName, newLinkResultCopy, reasonScreen, type InvitePreview, type RedeemCopy, type RedeemOutcome } from './inviteModel';

/**
 * One in-flight redeem per token for the whole page lifetime. StrictMode mounts
 * effects twice and a refresh remounts the page; the RPC must run once (a second
 * call would answer already_member or used and hide the real outcome). Keyed by
 * token, holds only the promise, and is cleared when the attempt settles.
 */
const inFlight = new Map<string, Promise<RedeemOutcome>>();

/** The one redeem call per token (see inFlight). Shared by the Join press and the used-link check. */
function attemptRedeem(t: string): Promise<RedeemOutcome> {
  let attempt = inFlight.get(t);
  if (!attempt) {
    attempt = redeemOrganiserInvite(t)
      .then(({ data, error }) => interpretRedeem(data, error))
      .catch(() => interpretRedeem(null, { message: 'network' }))
      .finally(() => { inFlight.delete(t); });
    inFlight.set(t, attempt);
  }
  return attempt;
}

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
      {copy.body && <p className="text-sm text-muted-foreground" data-testid="invite-body">{copy.body}</p>}
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
  // Never leak the token in a Referer header to anything this page links or loads (also while the preview loads).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  const { token = '' } = useParams<{ token: string }>();
  const valid = TOKEN_RE.test(token);
  // Who sent it and what it is for, before sign-in (screen 2a). A failed lookup is not fatal: the page falls back to the plain flow.
  const preview = useQuery({ queryKey: invitePreviewQueryKey(token), queryFn: () => fetchInvitePreview(token), enabled: valid, retry: false, staleTime: 60_000 });
  // A malformed token can never work: say so for everyone, before the gate sends anyone to finish a profile for it.
  if (!valid) return <InvalidLink />;
  const checking = <GlobalLayout><div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div></GlobalLayout>;
  if (preview.isPending) return checking;
  // No preview ({} for an unknown link, the pre-arc-1 server's {} for a used / revoked / expired one, or a failed
  // lookup): the plain flow, and redeem's answer after Join decides the screen. A garbled link still ends at 2f
  // (redeem answers invalid) with no "ask" button; a well-formed token is never called garbled on a guess.
  const info = preview.data ?? null;
  // A link already finished with is shown as such; the signed-in used-by-me person is sent Home first.
  if (info && info.status !== 'open') return <BrokenLink token={token} preview={info} />;
  // A BOUND link redeems before the dancer questions (the server skips its profile check for the proven address),
  // so the sender's pre-fill can reach them; every other link keeps the dancer-first gate.
  const bound = info?.emailHint != null;
  if (bound) return <InviteRedeem preview={info} />;
  return (
    <DancerProfileGate fallback={checking}>
      <InviteRedeem preview={info} />
    </DancerProfileGate>
  );
}

/** "Ask for a new one": request_new_invite_v1, one line of outcome, no dead end. */
function NewLinkRequest({ token, label }: { token: string; label: string }) {
  const [state, setState] = useState<{ busy: boolean; result: { ok: boolean; text: string } | null }>({ busy: false, result: null });
  const ask = async () => {
    setState({ busy: true, result: null });
    try {
      const { data, error } = await requestNewInvite(token);
      setState({ busy: false, result: newLinkResultCopy(data, error) });
    } catch {
      setState({ busy: false, result: newLinkResultCopy(null, new Error('network')) });
    }
  };
  if (state.result?.ok) return <p className="text-sm font-medium" role="status" data-testid="invite-new-link-done">{state.result.text}</p>;
  return (
    <>
      <button type="button" className={BTN} disabled={state.busy} onClick={() => void ask()} data-testid="invite-new-link">{label}</button>
      {state.result && <p className="text-sm text-destructive" role="alert" data-testid="invite-new-link-error">{state.result.text}</p>}
    </>
  );
}

/**
 * A refused or already-finished link, from EITHER source (the preview before sign-in, or redeem's
 * answer after Join): ONE screen built from reasonScreen(). Garbled links offer no ask button.
 */
function RefusedCard({ token, reason, preview, emailHint }: { token: string; reason: string; preview: InvitePreview | null; emailHint?: string | null }) {
  const screen = reasonScreen(reason, { organiserName: preview?.organiserName, inviterFirstName: preview?.inviterFirstName, emailHint: emailHint ?? preview?.emailHint });
  return (
    <Card copy={screen}>
      {screen.action === 'sign_in' && <Link to={buildSignInHref(`${INVITE_PATH}/${token}`)} className={BTN} data-testid="invite-sign-in">Sign in</Link>}
      {screen.action === 'switch_account' && <SwitchAccount token={token} reason={reason} label={screen.switchLabel ?? 'Sign in'} />}
      {screen.offerNewLink && <NewLinkRequest token={token} label={screen.newLinkLabel} />}
      <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>
    </Card>
  );
}

/**
 * 2d / 2e: the way out for a signed-in person the server refused. A plain link to /auth would loop
 * (/auth sends a signed-in person straight back here, to the same refusal), so this signs out first
 * with the shared signOut (it also clears the person's storage), then opens this invite's sign-in,
 * the link still unused. 2e (email_unproven: the RIGHT email, not proven) first emails a sign-in
 * code/link to that same address and lands on the code box; 2d leaves the email to the person.
 */
function SwitchAccount({ token, reason, label }: { token: string; reason: string; label: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    const here = `${INVITE_PATH}/${token}`;
    const email = user?.email?.trim() ?? '';
    const sendLink = reason === 'email_unproven' && email !== '';
    if (sendLink) {
      const sent = await sendInviteSignInEmail(email, here).catch(() => ({ error: new Error('network') }));
      if (sent.error) {
        setBusy(false);
        setError('We could not send the email. Check your connection and try again.');
        return;
      }
    }
    const outcome = await signOut();
    if (outcome === 'failed') {
      setBusy(false);
      setError('You are still signed in. Check your connection and try again.');
      return;
    }
    // After the sign-out (which clears the code step with the rest of the person's storage), so /auth reopens the code box.
    if (sendLink) rememberCodeStep(email, 'signin');
    navigate(buildSignInHref(here), { replace: true });
  };
  return (
    <>
      <button type="button" className={BTN} disabled={busy} onClick={() => void go()} data-testid="invite-switch-account">{label}</button>
      {error && <p className="text-sm text-destructive" role="alert" data-testid="invite-switch-error">{error}</p>}
    </>
  );
}

function BrokenLink({ token, preview }: { token: string; preview: InvitePreview }) {
  const { user, authStatus } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [home, setHome] = useState<'checking' | 'no'>('checking');
  useEffect(() => { stripToken(); }, []);
  // Used by this person (or they are on the team already): redeem answers already_member without using the link. Home, no error.
  const mayBeMine = Boolean(user) && preview.status === 'used';
  useEffect(() => {
    if (authStatus === 'resolving' || !mayBeMine) return;
    let live = true;
    void attemptRedeem(token).then((o) => {
      if (!live) return;
      if (o.kind === 'redeemed') {
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
        navigate(ORG_PATHS.home, { replace: true });
      } else setHome('no');
    });
    return () => { live = false; };
  }, [authStatus, mayBeMine, token, navigate, queryClient]);
  if (authStatus === 'resolving' || (mayBeMine && home === 'checking')) return <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}><div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-checking"><Skeleton className="h-6 w-48" /><Skeleton className="h-16 w-full" /></div></GlobalLayout>;
  return <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}><RefusedCard token={token} reason={preview.status} preview={preview} /></GlobalLayout>;
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

function InviteRedeem({ preview }: { preview: InvitePreview | null }) {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authStatus, signOut } = useAuth();
  const [refusal, setRefusal] = useState<{ reason: string; copy: RedeemCopy; emailHint: string | null } | null>(null);
  const [failed, setFailed] = useState<RedeemCopy | null>(null);
  const copy = refusal?.copy ?? failed;
  const [busy, setBusy] = useState(false);
  // M57 (owner decision): the link is bearer-style -- whoever is signed in joins -- so it is
  // used only once the person has seen who they are joining as and pressed Join.
  const [joining, setJoining] = useState(false);
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

  const run = useCallback(async () => {
    const t = tokenRef.current;
    if (!TOKEN_RE.test(t)) {
      setRefusal({ reason: 'invalid', copy: REDEEM_COPY.invalid, emailHint: null });
      stripToken();
      return;
    }
    setBusy(true);
    const outcome = await attemptRedeem(t);
    setBusy(false);
    if (outcome.kind === 'redeemed') {
      stripToken();
      // The sender's name + city for the dancer questions: a bound link only, redeemed here BEFORE the dancer
      // gate (the welcome page's). An unbound link met the gate first, so anything it carries is dropped.
      rememberInvitePrefill(preview?.emailHint != null ? outcome.prefill : null, user?.id ?? '');
      // The person may have opened Home in the last minute and cached "no organisers": refetch it before they land.
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      // A new seat lands on the welcome (Arc 1 1d for a first page, 7c for another); already a member: Home.
      navigate(outcome.alreadyMember ? ORG_PATHS.home : ORG_PATHS.welcome(outcome.organiserId), { replace: true });
      return;
    }
    if (outcome.copy.terminal) stripToken();
    // A redeem that did not land must not leave an earlier invite's prefill behind. email_mismatch is the one
    // exception: the signed-in person is not who this link is for, so it says nothing about THEIR stored entry.
    if (!(outcome.kind === 'refused' && outcome.reason === 'email_mismatch')) clearInvitePrefill();
    if (outcome.kind === 'refused') {
      setRefusal({ reason: outcome.reason, copy: outcome.copy, emailHint: outcome.emailHint });
      setFailed(null);
    } else {
      setFailed(outcome.copy);
      setRefusal(null);
    }
  }, [navigate, queryClient, preview, user]);

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
      <Card copy={preview ? { title: `${preview.organiserName} invited you`, body: 'Sign in, then you manage its events.', action: 'sign_in', terminal: false } : { title: 'Join your organiser team', body: 'Someone has invited you to manage an organiser on Bachata Calendar. Sign in with your own email, then you will come straight back here and the link is used.', action: 'sign_in', terminal: false }}>
        {preview?.emailHint && <p className="text-sm font-medium" data-testid="invite-email-hint">This invite is for {preview.emailHint}. Sign in with that email.</p>}
        <Link to={buildSignInHref(here)} className={BTN} data-testid="invite-sign-in">Sign in</Link>
      </Card>
    );
  } else if (user && !joining) {
    body = (
      <Card copy={preview ? { ...JOIN_COPY, title: `Join ${preview.organiserName}`, body: preview.inviterFirstName ? `${preview.inviterFirstName} invited you to manage it on Bachata Calendar.` : JOIN_COPY.body } : JOIN_COPY}>
        <p className="text-sm font-medium" data-testid="invite-joining-as">You are joining as {joiningAsName(nameRow.data, user.email)}</p>
        <button type="button" className={BTN} onClick={join} data-testid="invite-join">Join the team</button>
        <button type="button" className={LINK} onClick={() => void notYou()} data-testid="invite-not-you">Not you? Sign out</button>
        {signOutError && <p className="text-sm text-destructive" role="alert" data-testid="invite-signout-error">{signOutError}</p>}
      </Card>
    );
  } else if (refusal && refusal.reason !== 'sign_in_required' && refusal.reason !== 'authentication_required' && refusal.reason !== PROFILE_INCOMPLETE_CODE && refusal.reason !== 'rate_limited' && refusal.reason !== 'unconfirmed_account') {
    body = <RefusedCard token={token} reason={refusal.reason} preview={preview} emailHint={refusal.emailHint} />;
  } else if (copy || !user) {
    body = (
      <Card copy={copy ?? REDEEM_COPY.invalid}>
        {copy?.action === 'sign_in' && <Link to={buildSignInHref(TOKEN_RE.test(token) ? `${INVITE_PATH}/${token}` : null)} className={BTN} data-testid="invite-sign-in">Sign in</Link>}
        {copy?.action === 'retry' && <button type="button" className={BTN} disabled={busy} onClick={() => void run()} data-testid="invite-retry">Try again</button>}
        {copy?.action === 'finish_profile' && <Link to={finishProfileHref(`${INVITE_PATH}/${token}`)} className={BTN} data-testid="invite-finish-profile">Finish profile</Link>}
        {copy?.action !== 'retry' && copy?.action !== 'finish_profile' && <Link to="/" className={LINK} data-testid="invite-home">Go to Bachata Calendar</Link>}
      </Card>
    );
  } else {
    body = <div className="mx-auto max-w-md space-y-2 px-4 pt-10" data-testid="invite-working" role="status" aria-live="polite"><p className="text-sm text-muted-foreground">Using your link&hellip;</p><Skeleton className="h-16 w-full" /></div>;
  }
  return <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>{body}</GlobalLayout>;
}
