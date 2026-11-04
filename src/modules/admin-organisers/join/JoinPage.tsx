// The Option B join on /invite: the person never leaves the invite page. Email -> code -> (about) ->
// one Join tap -> done, every step DERIVED from server truth (deriveJoinStep) on each render. Action
// outcomes that stop the journey (a refused code, a blocked domain, not_linked) show as a JoinStop
// over the derived step until the person acts. The invite token stays in the URL until the link is
// finished with, so a reload, the back button or a second device all resume where the server says.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { profileCompletionQueryKey, useProfileCompletion } from '@/hooks/useProfileCompletion';
import { flags } from '@/lib/featureFlags';
import { claimAtSignIn, type ClaimOutcome } from '@/lib/claimMyDancerProfile';
import { OTP_RESEND_COOLDOWN_SECONDS } from '@/lib/auth-otp-routing';
import { ORGANISER_HOME_KEY, fetchOrganiserHome, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { hintMatchesEmail, newLinkResultCopy, ownPageForName } from '../inviteModel';
import { requestNewInvite } from '../inviteRedeemApi';
import { AboutStep } from './AboutStep';
import { JOIN_COPY } from './joinCopy';
import { attemptRedeem, bindInviteEmail, joinPreviewQueryKey, recordJoinRoles, reportJoinFailure, sendJoinCode, stripToken, verifyJoinCode } from './joinApi';
import { afterProfileRefusal, checkTypedEmail, classifySendError, classifyVerifyError, codeStepFromSearch, codeStepSearch, deriveJoinStep, isPersonBound, joinProgress, redeemAction, type JoinRedeemOutcome, type JoinPreview, type JoinStop } from './joinModel';
import { buildSignInHref } from '@/lib/authRouting';
import { BTN, Checking, CodeStep, DeadScreen, DoneScreen, GHOST, doneTarget, EmailStep, ErrorLine, Heading, JoinStepScreen, Lead, NoProfileScreen, PersonCard, Progress, StepFrame, StopScreen, Strip, WrongAccountScreen } from './JoinScreens';

/** How long the join card waits for the person's own page list before it shows Join anyway. */
const HOME_WAIT_MS = 1500;

export type PreviewState = 'loading' | 'failed' | JoinPreview | null;

/** "Ask <inviter> for a new one": request_new_invite_v1, one line of outcome, no dead end. */
function NewLinkRequest({ token, label, small = false }: { token: string; label: string; small?: boolean }) {
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
  if (state.result?.ok) return <p className="text-[14px] font-medium" role="status" data-testid="invite-new-link-done">{state.result.text}</p>;
  return (
    <>
      <button type="button" className={small ? GHOST : BTN} disabled={state.busy} onClick={() => void ask()} data-testid="invite-new-link">{label}</button>
      <ErrorLine id="invite-new-link-error">{state.result?.text ?? null}</ErrorLine>
    </>
  );
}

export default function JoinPage({ token, preview, refetchPreview }: { token: string; preview: PreviewState; refetchPreview: () => Promise<unknown> }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const queryClient = useQueryClient();
  const { user, authStatus, signOut } = useAuth();
  // After the code is verified the claim runs BEFORE anything reads the persona (the /auth/callback order):
  // the completeness read is paused until it has.
  const [linking, setLinking] = useState(false);
  const completion = useProfileCompletion({ paused: linking });
  const info = typeof preview === 'object' ? preview : null;
  const open = info?.status === 'open';

  const [stop, setStop] = useState<JoinStop | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  // undefined = nothing redeemed here; null = redeemed with no new seat (already a member) or no id: the plain organiser home.
  const [redeemedOrgId, setRedeemedOrgId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const claimRef = useRef<ClaimOutcome | null>(null);
  const [linkedHere, setLinkedHere] = useState(false);
  // The server refused the Join tap with profile_incomplete and the re-read sent the person to About: About says why.
  const [aboutRefused, setAboutRefused] = useState(false);

  // Membership before the tap: the person's own page list matched by name (the preview carries no ids). Best
  // effort: a slow or failing list leaves the Join card (the server still answers already_member on Join).
  const ownList = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: Boolean(user) && (open || info?.status === 'used') && !redeemed, retry: false, networkMode: 'always', staleTime: 60_000 });
  const [listGaveUp, setListGaveUp] = useState(false);
  const [usedResolved, setUsedResolved] = useState(false);
  useEffect(() => {
    if (!ownList.isPending || !ownList.isEnabled) return;
    const t = setTimeout(() => setListGaveUp(true), HOME_WAIT_MS);
    return () => clearTimeout(t);
  }, [ownList.isPending, ownList.isEnabled]);
  // (review 1291-r1 F1) redeem reads entity_members and answers already_member BEFORE used/revoked/expired, so a
  // `dead` answer on a used link is FINAL: not on the team, whatever a same-named page in their own list says.
  const [usedRefused, setUsedRefused] = useState(false);
  const member: boolean | null = !user || !info ? null
    : usedRefused ? false
    : ownList.isSuccess ? ownPageForName(ownList.data?.organisers, info.organiserName) != null
    : ownList.isError || (listGaveUp && (info.status !== 'used' || usedResolved)) ? false : null;
  // (review r1 F2) On a USED link a slow list never reads as "not on the team" while redeem is still out; once it
  // came back without a verdict (profile gate, network) the 1.5 s give-up applies again (review 1291-r1 F3).

  // A used link opened by a signed-in person: redeem answers already_member (used by me) without using the link.
  // One call per page (attemptRedeem dedupes per token, so StrictMode's second effect run is the same call).
  const usedStarted = useRef(false);
  const usedByMe = Boolean(user) && authStatus === 'ready' && info?.status === 'used';
  useEffect(() => {
    if (!usedByMe || usedStarted.current) return;
    usedStarted.current = true;
    void attemptRedeem(token).then((o) => {
      if (o.kind === 'done') {
        setRedeemed(true);
        // (review r1 F4) a used link's already_member names the invite's own page: land on that page's home.
        setRedeemedOrgId(o.organiserId);
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      } else if (o.kind === 'dead') {
        setUsedRefused(true);
      }
      setUsedResolved(true);
    });
  }, [usedByMe, token, queryClient]);

  // Resend cooldown ticks once a second while it runs.
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil, now]);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const derived = deriveJoinStep({
    preview,
    authStatus: authStatus === 'resolving' ? 'resolving' : 'ready',
    user,
    url: { step: new URLSearchParams(search).get('step'), email: codeStepFromSearch(search) },
    completion: linking ? 'loading' : completion.status,
    member,
    redeemed,
    usedCheckPending: !usedResolved,
  });
  const step = derived.step;

  // The Done link's organiser: the redeem's own id; else, only when exactly ONE of the person's pages matches the
  // invite's name (two same-named pages cannot say which), that page. Otherwise null: the plain organiser home.
  const ownPages = ownList.isSuccess ? ownList.data?.organisers : null;
  const nameMatch = info ? ownPageForName(ownPages, info.organiserName) : null;
  const nameIsUnique = nameMatch != null && info != null && ownPageForName(ownPages?.filter((o) => o !== nameMatch), info.organiserName) == null;
  const doneOrgId = redeemedOrgId !== undefined ? redeemedOrgId : nameIsUnique ? nameMatch.id : null;

  // A finished-with link: the token leaves the address bar.
  useEffect(() => {
    if (step === 'done' || step === 'dead') stripToken();
  }, [step]);

  // Slice U: a USED link that turned out to be the person's own (redeem's already_member, or their page list) goes
  // straight to their page's home, replacing this entry so Back never lands on the link again. A first redeem
  // (status open) still shows Done.
  // (review r1 F1) "used" as FIRST seen: a first-time joiner's preview refetches as used later, and must keep Done.
  // (review r1 F3) only when the organiser area is on: with it off, Done's plain words stay.
  const arrivedUsed = useRef<boolean | null>(null);
  if (arrivedUsed.current === null && info) arrivedUsed.current = info.status === 'used';
  const returning = step === 'done' && arrivedUsed.current === true && flags.organiserSelfServe;
  useEffect(() => {
    if (!returning) return;
    const { to, state } = doneTarget(info?.organiserName ?? 'the team', { organiserP3: flags.organiserP3, organiserSelfServe: flags.organiserSelfServe }, doneOrgId);
    navigate(to, { replace: true, state });
  }, [returning, info?.organiserName, doneOrgId, navigate]);
  const usedViewer = info?.status === 'used' && authStatus !== 'resolving' ? (user ? 'other_account' : 'signed_out') : null;

  const clearStep = useCallback(() => navigate(pathname, { replace: true }), [navigate, pathname]);

  const fail = (from: string, s: JoinStop) => {
    reportJoinFailure(from, s.kind === 'refused' ? s.reason : s.kind === 'wrong_account' ? 'email_mismatch' : s.kind);
    setStop(s);
  };

  /** Email step: bind (unbound link), then one signInWithOtp for new and returning people alike. */
  const send = async (typed: string, resend = false) => {
    if (!info || busy) return;
    const check = checkTypedEmail(typed);
    if (check.ok === false) {
      const reason = check.reason;
      setEmailError(reason === 'not_ascii' ? JOIN_COPY.email.notAscii : JOIN_COPY.email.badShape);
      return;
    }
    setBusy(true);
    setEmailError(null);
    setCodeNotice(null);
    // The bind is permanent: once it tied this link to the typed email, a refused send cannot be fixed with another email.
    let locked = false;
    try {
      if (!resend && info.emailHint == null) {
        const bound = await bindInviteEmail(token, check.email);
        if (bound.kind === 'failed') return fail('bind', { kind: 'network', from: 'bind' });
        if (bound.kind === 'status') {
          locked = bound.status === 'bound';
          if (bound.status === 'bad_email') return setEmailError(JOIN_COPY.email.badShape);
          if (bound.status === 'rate_limited') return fail('bind', { kind: 'rate_limited', from: 'code' });
          if (bound.status === 'not_open') {
            await refetchPreview();
            return;
          }
          if (bound.status === 'already_bound') {
            // Bound meanwhile (a second tab, a double tap): fine for the same address; otherwise this link is not theirs.
            const fresh = (await queryClient.fetchQuery({ queryKey: joinPreviewQueryKey(token), queryFn: () => refetchPreview().then(() => queryClient.getQueryData<JoinPreview | null>(joinPreviewQueryKey(token)) ?? null), staleTime: 0 })) as JoinPreview | null;
            if (!fresh?.emailHint || !hintMatchesEmail(fresh.emailHint, check.email)) return fail('bind', { kind: 'already_bound' });
          }
        }
        // unavailable: the function is not on the server yet; the redeem still guards the address.
      }
      const { error } = await sendJoinCode(check.email, token).catch((e: unknown) => ({ error: e instanceof Error ? e : new Error('network') }));
      if (error) {
        const s = classifySendError(error);
        if (resend && s.kind === 'rate_limited') return setCodeError(JOIN_COPY.code.rateLimited);
        if (resend && s.kind === 'network') return setCodeError(JOIN_COPY.code.resendFailed);
        return fail('send', (s.kind === 'invite_only' || s.kind === 'blocked_domain') && locked ? { ...s, locked } : s);
      }
      setCooldownUntil(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      if (resend) setCodeNotice(JOIN_COPY.code.resent);
      else navigate(`${pathname}${codeStepSearch(check.email)}`, { replace: true });
    } finally {
      setBusy(false);
    }
  };

  /** ONE place that acts on a redeem answer, for the Join tap and the post-sign-in safety stop alike. */
  const applyRedeem = async (outcome: JoinRedeemOutcome, from: 'join' | 'claim') => {
    const action = redeemAction(outcome);
    switch (action.act) {
      case 'done':
        setRedeemed(true);
        setRedeemedOrgId(action.alreadyMember ? null : action.organiserId);
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
        return;
      case 'stop': return fail(from, action.stop);
      case 'refetch_preview': await refetchPreview(); return;
      case 'refetch_completion': {
        // Never silent: incomplete -> About says what to do; still complete (stale) -> a plain retry stop.
        const stale = afterProfileRefusal((await completion.refetch()).status);
        if (stale) return fail(from, stale);
        setAboutRefused(true);
        return;
      }
      case 'sign_out': await signOut(); clearStep(); return;
    }
  };

  /** Code step: verify, then claim BEFORE any persona read, then the silent roles, then the server decides the step. */
  const verify = async (code: string) => {
    const email = codeStepFromSearch(search);
    if (!email || busy) return;
    setBusy(true);
    setCodeError(null);
    setCodeNotice(null);
    // Paused BEFORE verifyOtp: the SIGNED_IN event fires inside it, and a render with a session and no pause
    // would read the persona before the claim (the /auth/callback order, PLAN.md section 4).
    setLinking(true);
    const { data, error } = await verifyJoinCode(email, code).catch((e: unknown) => ({ data: null, error: e instanceof Error ? e : new Error('network') }));
    if (error) {
      setLinking(false);
      setBusy(false);
      const why = classifyVerifyError(error);
      if (why === 'wrong_code') return setCodeError(JOIN_COPY.code.wrong);
      if (why === 'rate_limited') return setCodeError(JOIN_COPY.code.rateLimited);
      return fail('verify', { kind: 'network', from: 'verify' });
    }
    try {
      const claim = await claimAtSignIn(queryClient);
      claimRef.current = claim;
      if (claim.status === 'linked') setLinkedHere(true);
      await recordJoinRoles(data?.user);
      void queryClient.invalidateQueries({ queryKey: profileCompletionQueryKey(data?.user?.id) });
      clearStep();
      // Person-bound invite whose claim did not land: the safety stop. The one redeem call makes "we've told" real
      // (A2 records the not_linked attempt and keeps the invite open); a server that seats them anyway is honoured.
      if (isPersonBound(info) && (claim.status === 'no_match' || claim.status === 'ambiguous')) {
        await applyRedeem(await attemptRedeem(token), 'claim');
      }
    } finally {
      setLinking(false);
      setBusy(false);
    }
  };

  /** The one consent tap. Idempotent on the server: already_member is the same success screen. */
  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await applyRedeem(await attemptRedeem(token), 'join');
    } finally {
      setBusy(false);
    }
  };

  /** Sign out and stay on the invite (never a hop to /auth): the email step follows, the link still unused. */
  const switchAccount = async () => {
    setBusy(true);
    setSignOutError(null);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === 'failed') return setSignOutError(JOIN_COPY.signOutFailed);
    claimRef.current = null;
    setLinkedHere(false);
    setStop(null);
    clearStep();
  };

  const retry = async () => {
    if (!stop) return;
    const s = stop;
    setStop(null);
    if (s.kind === 'network' && s.from === 'join') return join();
    // Only a retryable refusal (the unknown-reason fallback, login audit L4) shows Try again; it redeems again.
    // A redeem rate limit shows it disabled (L6), so it never retries from here.
    if (s.kind === 'refused' || s.kind === 'profile_stale') return join();
    // A code/bind/send failure returns to the email box (the typed email is kept in the box); a verify failure to the code box.
    if (s.kind === 'network' && s.from === 'verify') return;
    clearStep();
  };

  // ---- render ---------------------------------------------------------------------------------
  const progress = info ? joinProgress(step, completion.status) : null;
  const title = info ? JOIN_COPY.pageTitle(info.organiserName) : null;
  const header = info && open && step !== 'done' ? <Strip preview={info} /> : null;

  if (stop) {
    return (
      <StepFrame step={step} stop={stop.kind}>
        {header}
        <StopScreen stop={stop} preview={info} signedInAs={user?.email ?? 'another account'} busy={busy} error={signOutError} onRetry={() => void retry()} onSwitch={() => void switchAccount()} onDismiss={() => { setStop(null); clearStep(); }} />
      </StepFrame>
    );
  }

  let body: React.ReactNode;
  switch (step) {
    case 'checking':
      body = <Checking />;
      break;
    case 'unreachable':
      body = (
        <>
          <Heading>{JOIN_COPY.network.heading}</Heading>
          <p className="text-[14px] text-muted-foreground">{JOIN_COPY.network.body}</p>
          <button type="button" className={BTN} onClick={() => { void refetchPreview(); if (user) void completion.refetch(); }} data-testid="join-retry">{JOIN_COPY.network.button}</button>
        </>
      );
      break;
    case 'dead':
      body = (
        <DeadScreen
          reason={derived.step === 'dead' ? derived.reason : 'invalid'}
          preview={info}
          newLink={info ? <NewLinkRequest token={token} label={`Ask ${info.inviterFirstName ?? 'the sender'} for a new one`} small={usedViewer !== null} /> : null}
          usedViewer={usedViewer}
          signInHref={buildSignInHref(`/invite/${token}`)}
          busy={busy}
          onSwitch={() => void switchAccount()}
        />
      );
      break;
    case 'email':
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{title}</Heading>
          {info && isPersonBound(info) && <PersonCard preview={info} />}
          {info?.emailHint && <Lead testId="join-email-hint">{JOIN_COPY.inviteSentTo(info.emailHint)}</Lead>}
          <EmailStep initial="" busy={busy} error={emailError} onSend={(typed) => void send(typed)} />
        </>
      );
      break;
    case 'code': {
      const email = codeStepFromSearch(search) ?? '';
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{JOIN_COPY.code.heading}</Heading>
          <CodeStep email={email} verifying={busy} error={codeError} notice={codeNotice} cooldown={cooldown} onVerify={(c) => void verify(c)} onResend={() => void send(email, true)} onChangeEmail={clearStep} />
        </>
      );
      break;
    }
    case 'about':
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{JOIN_COPY.about.heading}</Heading>
          {aboutRefused && <Lead testId="join-about-refused">{JOIN_COPY.about.refusedNotice}</Lead>}
          {info && <AboutStep completion={completion} preview={info} linked={linkedHere} onSaved={() => completion.refetch()} />}
        </>
      );
      break;
    case 'join':
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{info ? JOIN_COPY.join.heading(info.organiserName) : null}</Heading>
          {info && <JoinStepScreen preview={info} busy={busy} signOutError={signOutError} onJoin={() => void join()} onNotYou={() => void switchAccount()} />}
        </>
      );
      break;
    case 'done':
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{title}</Heading>
          <DoneScreen org={info?.organiserName ?? 'the team'} flags={{ organiserP3: flags.organiserP3, organiserSelfServe: flags.organiserSelfServe }} organiserId={doneOrgId} />
        </>
      );
      break;
    case 'wrong_account':
      body = <WrongAccountScreen signedInAs={user?.email ?? 'another account'} hint={info?.emailHint ?? ''} busy={busy} error={signOutError} onSwitch={() => void switchAccount()} />;
      break;
    case 'no_profile':
      body = <NoProfileScreen />;
      break;
  }
  return (
    <StepFrame step={step}>
      {header}
      {body}
    </StepFrame>
  );
}
