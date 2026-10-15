import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { APP_HOME_PATH, RETURN_TO_PARAM, onboardingEnd, onboardingEndLabel } from '@/lib/accountRouting';
import { diffDelta } from '../../api/delta';
import { toDancerError } from '../../api/errors';
import type { DancerDelta, MyDancerEdit } from '../../api/types';
import { trackDancerEvent } from '../../analytics/events';

import { REQUIRED_STAGES, requiredMissing, stageAfterSave, stageAfterSkip, stageFor, stageForBoost, optionalStagesLeft, type Stage } from './model';
import FirstCardNotes from './notes';
import { StylesCard, YearsCard } from './optional';
import { CityCard, NameCard, PhotoCard, RoleCard } from './steps';
import { GhostButton, Meter, PrimaryButton, Question, Tag, wrap } from './ui';
import { resetDancerGate, useMyDancerEdit } from '../../api/useMyDancerEdit';

const gradientCard: CSSProperties = {
  background: 'linear-gradient(145deg, var(--da-gradient-from) 0%, var(--da-gradient-to) 100%)',
  color: 'var(--da-on-gradient)',
  borderRadius: 16,
  padding: 14,
};

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
  const { data: profile, isPending, isError, error: loadError, save } = useMyDancerEdit({ refetchOnMount: 'always', retry: false });
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

  // Already finished on arrival: straight on to the end.
  useEffect(() => {
    if (redirectHome) leaveFor(qc, navigate, end);
  }, [redirectHome, qc, navigate, end]);

  if (redirectHome) return null;

  if (isError) {
    return (
      <section className="da-card" role="alert" data-testid="onboarding-load-error">
        <p style={{ ...wrap, margin: 0 }}>{toDancerError(loadError).message}</p>
      </section>
    );
  }
  if (isPending || !profile || stage === null) {
    return (
      <section className="da-card" aria-busy="true" aria-label="Loading" data-testid="onboarding-skeleton" style={{ minHeight: 240 }}>
        <div style={{ height: 14, width: '40%', borderRadius: 8, background: 'var(--da-surface-2)' }} />
        <div style={{ height: 30, width: '70%', borderRadius: 8, background: 'var(--da-surface-2)', marginTop: 16 }} />
        <div style={{ height: 48, borderRadius: 12, background: 'var(--da-surface-2)', marginTop: 16 }} />
      </section>
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

  return (
    <section data-testid={`onboarding-${stage}`} style={{ ...wrap, maxWidth: 520, margin: '0 auto' }}>
      <Meter profile={profile} />
      {stage === 'in' ? (
        <div style={gradientCard} data-testid="onboarding-in-card">
          <Tag onGradient>{profile.strength.pct}% &middot; you&rsquo;re past the line</Tag>
          <Question>You&rsquo;re in, {nameOf(profile)}</Question>
          <p style={{ fontSize: 15, margin: '0 0 14px' }}>
            Your page is live and Going and Interested are unlocked.
            {left > 0 ? ` ${left === 2 ? 'Two quick questions' : 'One quick question'} will make it stronger.` : ''}
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {left > 0 ? <PrimaryButton testId="onboarding-boost" onClick={() => go(stageForBoost(profile))}>Boost to 100%</PrimaryButton> : null}
            <GhostButton testId="onboarding-home" onClick={() => leaveFor(qc, navigate, end)}>{endLabel}</GhostButton>
          </div>
        </div>
      ) : stage === 'nice' ? (
        <div className="da-card" data-testid="onboarding-nice-card">
          <Question>Nice work, {nameOf(profile)}</Question>
          <p style={{ fontSize: 15, margin: '0 0 14px' }}>Your profile is at {profile.strength.pct}%. Add a bio and links any time from Me.</p>
          <PrimaryButton testId="onboarding-home" onClick={() => leaveFor(qc, navigate, end)}>{endLabel}</PrimaryButton>
        </div>
      ) : (
        <div className="da-card">
          {stage === 'name' ? <NameCard {...card} /> : null}
          {stage === 'city' ? <CityCard {...card} /> : null}
          {stage === 'role' ? <RoleCard {...card} /> : null}
          {stage === 'photo' ? <PhotoCard tag={tag} returnTo={returnTo} /> : null}
          {stage === 'years' ? <YearsCard {...card} onSkip={() => go(stageAfterSkip(profile, 'years'))} /> : null}
          {stage === 'styles' ? <StylesCard {...card} onSkip={() => go(stageAfterSkip(profile, 'styles'))} /> : null}
          {first ? <FirstCardNotes linked={profile.linked_from_admin} /> : null}
        </div>
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
