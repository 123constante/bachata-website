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
import { checkTypedEmail, classifySendError, classifyVerifyError, codeStepFromSearch, codeStepSearch, deriveJoinStep, isPersonBound, joinProgress, type JoinPreview, type JoinStop } from './joinModel';
import { BTN, Checking, CodeStep, DeadScreen, DoneScreen, EmailStep, ErrorLine, Heading, JoinStepScreen, NoProfileScreen, PersonCard, Progress, StepFrame, StopScreen, Strip, WrongAccountScreen } from './JoinScreens';

/** How long the join card waits for the person's own page list before it shows Join anyway. */
const HOME_WAIT_MS = 1500;

export type PreviewState = 'loading' | 'failed' | JoinPreview | null;

/** "Ask <inviter> for a new one": request_new_invite_v1, one line of outcome, no dead end. */
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
  if (state.result?.ok) return <p className="text-[14px] font-medium" role="status" data-testid="invite-new-link-done">{state.result.text}</p>;
  return (
    <>
      <button type="button" className={BTN} disabled={state.busy} onClick={() => void ask()} data-testid="invite-new-link">{label}</button>
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
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const claimRef = useRef<ClaimOutcome | null>(null);
  const [linkedHere, setLinkedHere] = useState(false);

  // Membership before the tap: the person's own page list matched by name (the preview carries no ids). Best
  // effort: a slow or failing list leaves the Join card (the server still answers already_member on Join).
  const ownList = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: Boolean(user) && open && !redeemed, retry: false, networkMode: 'always', staleTime: 60_000 });
  const [listGaveUp, setListGaveUp] = useState(false);
  useEffect(() => {
    if (!ownList.isPending || !ownList.isEnabled) return;
    const t = setTimeout(() => setListGaveUp(true), HOME_WAIT_MS);
    return () => clearTimeout(t);
  }, [ownList.isPending, ownList.isEnabled]);
  const member: boolean | null = !user || !info ? null : ownList.isSuccess ? ownPageForName(ownList.data?.organisers, info.organiserName) != null : ownList.isError || listGaveUp ? false : null;

  // A used link opened by a signed-in person: redeem answers already_member (used by me) without using the link.
  // One call per page (attemptRedeem dedupes per token, so StrictMode's second effect run is the same call).
  const usedStarted = useRef(false);
  const [usedResolved, setUsedResolved] = useState(false);
  const usedByMe = Boolean(user) && authStatus === 'ready' && info?.status === 'used';
  useEffect(() => {
    if (!usedByMe || usedStarted.current) return;
    usedStarted.current = true;
    void attemptRedeem(token).then((o) => {
      if (o.kind === 'done') {
        setRedeemed(true);
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
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

  // A finished-with link: the token leaves the address bar.
  useEffect(() => {
    if (step === 'done' || step === 'dead') stripToken();
  }, [step]);

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
      setEmailError(reason === 'not_ascii' ? JOIN_COPY.email.notAscii : reason === 'bad_shape' ? JOIN_COPY.email.badShape : JOIN_COPY.email.why);
      return;
    }
    setBusy(true);
    setEmailError(null);
    setCodeNotice(null);
    try {
      if (!resend && info.emailHint == null) {
        const bound = await bindInviteEmail(token, check.email);
        if (bound.kind === 'failed') return fail('bind', { kind: 'network', from: 'bind' });
        if (bound.kind === 'status') {
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
        return fail('send', s);
      }
      setCooldownUntil(Date.now() + OTP_RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      if (resend) setCodeNotice(JOIN_COPY.code.resent);
      else navigate(`${pathname}${codeStepSearch(check.email)}`, { replace: true });
    } finally {
      setBusy(false);
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
        const outcome = await attemptRedeem(token);
        if (outcome.kind === 'done') setRedeemed(true);
        else fail('claim', { kind: 'not_linked' });
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
      const outcome = await attemptRedeem(token);
      switch (outcome.kind) {
        case 'done':
          setRedeemed(true);
          void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
          return;
        case 'not_linked': return fail('join', { kind: 'not_linked' });
        case 'dead': await refetchPreview(); return;
        case 'wrong_account': return fail('join', { kind: 'wrong_account', emailHint: outcome.emailHint });
        case 'email_unproven': return fail('join', { kind: 'email_unproven' });
        case 'rate_limited': return fail('join', { kind: 'rate_limited', from: 'join' });
        case 'profile_incomplete': await completion.refetch(); return;
        case 'sign_in': await signOut(); clearStep(); return;
        case 'refused': return fail('join', { kind: 'refused', reason: outcome.reason, emailHint: outcome.emailHint });
        default: return fail('join', { kind: 'network', from: 'join' });
      }
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
    if (s.kind === 'refused') return join();
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
      body = <DeadScreen reason={derived.step === 'dead' ? derived.reason : 'invalid'} preview={info} newLink={info ? <NewLinkRequest token={token} label={`Ask ${info.inviterFirstName ?? 'the sender'} for a new one`} /> : null} />;
      break;
    case 'email':
      body = (
        <>
          {progress && <Progress {...progress} />}
          <Heading>{title}</Heading>
          {info && isPersonBound(info) && <PersonCard preview={info} />}
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
          <DoneScreen org={info?.organiserName ?? 'the team'} selfServe={flags.organiserSelfServe} />
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
