import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { APP_HOME_PATH, RETURN_TO_PARAM, onboardingEnd, onboardingEndLabel } from '@/lib/accountRouting';
import { diffDelta } from '../../api/delta';
import { toDancerError } from '../../api/errors';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';
import { HIDDEN_STATE_LINE } from '../../copy/sharedCopy';
import type { DancerDelta, MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';

import { REQUIRED_STAGES, requiredMissing, stageAfterSave, stageAfterSkip, stageFor, stageForBoost, optionalStagesLeft, type Stage } from './model';
import FirstCardNotes from './notes';
import { StylesCard, YearsCard } from './optional';
import { CityCard, NameCard, PhotoCard, RoleCard } from './steps';
import { Card } from '@/modules/organiser/ui';
import { LINK_GHOST, LINK_PRIMARY } from '../blocks';
import { GhostButton, Meter, PrimaryButton, Question, Tag, WRAP } from './ui';
import { resetDancerGate, useMyDancerEdit } from '../../api/useMyDancerEdit';
import { daConfetti } from '../../shell/confetti';

const nameOf = (p: MyDancerEdit) => p.first_name?.trim() || 'there';

/**
 * Leave onboarding for its end. A gated end (anything but Home, e.g. /account/o) first
 * drops the dancer gate's cached answer (review F1): a stale "incomplete" -- the profile
 * finished in another tab, or by a save this tab never saw -- would send the gate back to
 * /finish-profile -> /app/welcome -> here again until the cache went stale.
 *
 * EVERY end replaces /app/welcome (owner decision, matrix M10/M24): browser Back from
 * the end never re-opens the "You're in" card.
 */
const leaveFor = (qc: QueryClient, navigate: NavigateFunction, end: string) => {
  if (end !== APP_HOME_PATH) resetDancerGate(qc);
  navigate(end, { replace: true });
};

/**
 * /app/welcome: one question per card, driven by the server's strength.missing (decision 5).
 * ?returnTo= (the organiser link's /account/o) is where it ends, after the full setup; with
 * none it ends on Home. lib/accountRouting onboardingEnd() decides; it rides the photo step too.
 */
const OnboardingCards = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const returnTo = params.get(RETURN_TO_PARAM);
  const end = onboardingEnd(returnTo);
  const endLabel = onboardingEndLabel(end);
  const { data: profile, isPending, isError, isFetching, error: loadError, save, refetch } = useMyDancerEdit({ refetchOnMount: 'always', retry: false });
  const [stage, setStage] = useState<Stage | null>(null);
  const [firstStage, setFirstStage] = useState<Stage | null>(null);
  const [requiredStart, setRequiredStart] = useState<Stage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectHome, setRedirectHome] = useState(false);


  // Decide the starting card ONCE, from the first server shape (adjusting state during render,
  // React's documented pattern); later cards come from save results.
  if (profile && stage === null && !redirectHome) {
    const start = stageFor(profile);
    if (start === 'done') {
      setRedirectHome(true);
    } else {
      setStage(start);
      setFirstStage(start);
      setRequiredStart(REQUIRED_STAGES.filter((s) => requiredMissing(profile, s)));
    }
  }

  useEffect(() => {
    if (stage) trackDancerEvent('onboarding_step', { step: stage });
  }, [stage]);
  // Funnel counter: the setup is finished when the person reaches an end card ("You're in" / "Nice work"),
  // once per visit. The photo hand-off re-opens this page on the end card, so an arrival there counts too; a profile
  // that was already 100% redirects before any card and does not.
  const finishRecorded = useRef(false);
  useEffect(() => {
    if ((stage === 'in' || stage === 'nice') && !finishRecorded.current) {
      finishRecorded.current = true;
      // Loaded on demand: a static import made it a chunk of its own in /app/*'s first load (bundle-budget).
      void import('@/lib/trackAuthStep').then((m) => m.trackAuthStep({ step: 'onboarding_end', outcome: 'ok' }), () => undefined);
    }
  }, [stage]);
  // D121: confetti on "You're in" (a no-op under reduced motion).
  useEffect(() => {
    if (stage === 'in') daConfetti();
  }, [stage]);

  // Already finished on arrival: straight on to the end.
  useEffect(() => {
    if (redirectHome) leaveFor(qc, navigate, end);
  }, [redirectHome, qc, navigate, end]);

  if (redirectHome) return null;

  if (isError) {
    // Audit M23: never a dead end. Try again re-reads; the calendar is always a way out. A profile the
    // server cannot find (or match) is not fixed by retrying, so its copy's "Message us" is a real link.
    const failure = toDancerError(loadError);
    const needsUs = failure.code === 'no_profile' || failure.code === 'profile_mismatch';
    return (
      <Card variant="padded" role="alert" testId="onboarding-load-error" className="grid gap-[8px]">
        <p className={`${WRAP} m-0`}>{failure.message}</p>
        {needsUs ? (
          <a
            href={dancerMessageUsUrl(failure.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE)}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_PRIMARY}
          >
            Message us on WhatsApp
          </a>
        ) : (
          <PrimaryButton testId="onboarding-retry" disabled={isFetching} onClick={() => void refetch()}>
            Try again
          </PrimaryButton>
        )}
        <Link to="/" className={LINK_GHOST}>
          Back to the calendar
        </Link>
      </Card>
    );
  }
  if (isPending || !profile || stage === null) {
    return (
      <Card variant="padded" aria-busy="true" aria-label="Loading" testId="onboarding-skeleton" className="min-h-[240px]">
        <div className="h-[14px] w-[40%] rounded-[8px] bg-[var(--card2)]" />
        <div className="mt-[16px] h-[30px] w-[70%] rounded-[8px] bg-[var(--card2)]" />
        <div className="mt-[16px] h-[48px] rounded-[12px] bg-[var(--card2)]" />
      </Card>
    );
  }

  const at = requiredStart.indexOf(stage);
  const tag = at >= 0 ? `${at + 1} of ${requiredStart.length}` : null;

  const run = async (delta: DancerDelta, from: Stage) => {
    setBusy(true);
    setError(null);
    try {
      // profile_strength_70 fires inside save() (api/useMyDancerEdit writeMyDancerEdit), on every path.
      const next = await save(diffDelta(profile, delta), profile);
      setStage(stageAfterSave(next, from));
    } catch (err) {
      setError(toDancerError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const go = (next: Stage) => {
    setError(null);
    setStage(next);
  };
  const card = { profile, busy, error, onSubmit: (d: DancerDelta) => void run(d, stage), tag };
  const first = stage === firstStage;
  const left = optionalStagesLeft(profile.strength.missing).length;
  const quick = left === 2 ? 'Two quick questions' : 'One quick question';

  return (
    <section data-testid={`onboarding-${stage}`} className={`${WRAP} mx-auto max-w-[520px]`}>
      <Meter profile={profile} />
      {stage === 'in' ? (
        <div className="da-hero" data-testid="onboarding-in-card">
          {/* Audit M8/M24: the server's own pct, plain words, and no claim about RSVPs (the RSVP RPC has no
              profile rule). A hidden profile is not called live. The button says what it opens. */}
          <Tag onGradient>
            {profile.strength.pct}%{profile.is_active ? <> &middot; Your profile is live</> : null}
          </Tag>
          <Question>You&rsquo;re in, {nameOf(profile)}</Question>
          <p className={`${WRAP} mx-0 mb-[14px] mt-0 text-[15px]`}>
            {profile.is_active ? 'People can find your page now.' : HIDDEN_STATE_LINE}
            {left > 0 ? ` ${quick} will make it stronger.` : ''}
          </p>
          <div className="grid gap-[8px]">
            {left > 0 ? <PrimaryButton testId="onboarding-boost" onClick={() => go(stageForBoost(profile))}>{quick}</PrimaryButton> : null}
            <GhostButton testId="onboarding-home" onClick={() => leaveFor(qc, navigate, end)}>{endLabel}</GhostButton>
          </div>
        </div>
      ) : stage === 'nice' ? (
        <Card variant="padded" testId="onboarding-nice-card">
          <Question>Nice work, {nameOf(profile)}</Question>
          <p className="mx-0 mb-[14px] mt-0 text-[15px]">Your profile is at {profile.strength.pct}%. Add a bio and links any time from Me.</p>
          <PrimaryButton testId="onboarding-home" onClick={() => leaveFor(qc, navigate, end)}>{endLabel}</PrimaryButton>
        </Card>
      ) : (
        <Card variant="padded" className="p-[12px]">
          {stage === 'name' ? <NameCard {...card} /> : null}
          {stage === 'city' ? <CityCard {...card} /> : null}
          {stage === 'role' ? <RoleCard {...card} /> : null}
          {stage === 'photo' ? <PhotoCard tag={tag} returnTo={returnTo} /> : null}
          {stage === 'years' ? <YearsCard {...card} onSkip={() => go(stageAfterSkip(profile, 'years'))} /> : null}
          {stage === 'styles' ? <StylesCard {...card} onSkip={() => go(stageAfterSkip(profile, 'styles'))} /> : null}
          {first ? <FirstCardNotes linked={profile.linked_from_admin} /> : null}
        </Card>
      )}
    </section>
  );
};

/** The route's root carries the id every dancer screen carries (shell reachability tests look for it). */
const OnboardingScreen = () => (
  <div data-testid="dancer-screen-welcome">
    <OnboardingCards />
  </div>
);

export default OnboardingScreen;
