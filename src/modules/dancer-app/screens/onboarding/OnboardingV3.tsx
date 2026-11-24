import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { APP_HOME_PATH, RETURN_TO_PARAM, onboardingEnd } from '@/lib/accountRouting';
import { Card } from '@/modules/organiser/ui';
import { diffDelta } from '../../api/delta';
import { toDancerError } from '../../api/errors';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE, dancerMessageUsUrl } from '../../api/messageUs';
import { saveMyBuyerRoles } from '../../api/rpc';
import type { BuyerRole, DancerDelta, MyDancerEdit } from '../../api/types';
import { resetDancerGate, useMyDancerEdit, usePutMyDancerEdit } from '../../api/useMyDancerEdit';
import { daConfetti } from '../../shell/confetti';
import { LINK_GHOST, LINK_PRIMARY } from '../blocks';
import { firstRequiredStage, type RequiredStage } from './model';
import { bandForYearV3, celebratesOnLeave, resumeStep, stepsFor, yearForBandV3, type StepV3, type YearBandV3 } from './modelV3';
import { CityCard, NameCard, RoleCard } from './steps';
import { RolesCardV3, StylesCardV3, YearsCardV3 } from './stepsV3';
import { PrimaryButton, WRAP } from './ui';

/** Same 3 lines as OnboardingScreen's leaveFor (copied, not exported: the old file stays untouched). */
const leaveFor = (qc: QueryClient, navigate: NavigateFunction, end: string) => {
  if (end !== APP_HOME_PATH) resetDancerGate(qc);
  navigate(end, { replace: true });
};

/** The sign-up questions asked before the code: the existing cards, unchanged. */
const PRE_STAGES: readonly RequiredStage[] = ['name', 'city', 'role'];

const Progress = ({ total, position }: { total: number; position: number }) =>
  position >= total ? null : (
    <div data-testid="onboarding-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={position + 1} className="mb-[12px] flex gap-[4px]">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-testid="onboarding-seg" data-filled={i <= position} className={`h-[6px] flex-1 rounded-full ${i <= position ? 'da-bar-fill' : 'bg-[var(--card2)]'}`} />
      ))}
    </div>
  );

/** /app/welcome with VITE_ENABLE_DANCER_ONBOARDING_V3: one question per screen (slice 2a: roles, styles, years). */
const OnboardingV3 = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const end = onboardingEnd(params.get(RETURN_TO_PARAM));
  const { data: profile, isPending, isError, isFetching, error: loadError, save, refetch } = useMyDancerEdit({ refetchOnMount: 'always', retry: false });
  const put = usePutMyDancerEdit();
  const [step, setStep] = useState<StepV3 | null>(null);
  const [roles, setRoles] = useState<BuyerRole[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [band, setBand] = useState<YearBandV3 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const pre = profile ? PRE_STAGES.find((s) => s === firstRequiredStage(profile.strength.missing)) ?? null : null;

  // Decide the starting screen ONCE, from the first server shape with the sign-up questions answered.
  if (profile && !pre && step === null && !leaving) {
    const start = resumeStep(profile);
    // s2b replaces: partner / photo / done all end the flow here until those screens exist.
    if (start === 'roles' || start === 'styles' || start === 'years') {
      setStep(start);
      setRoles(profile.buyer_roles.length > 0 ? profile.buyer_roles : ['dancer']);
      setStyles(profile.favorite_styles);
      setBand(bandForYearV3(profile.dance_started_year));
    } else {
      setLeaving(true);
    }
  }
  useEffect(() => {
    if (leaving) leaveFor(qc, navigate, end);
  }, [leaving, qc, navigate, end]);
  if (leaving) return null;

  if (isError) {
    const failure = toDancerError(loadError);
    const needsUs = failure.code === 'no_profile' || failure.code === 'profile_mismatch';
    return (
      <Card variant="padded" role="alert" testId="onboarding-load-error" className="grid gap-[8px]">
        <p className={`${WRAP} m-0`}>{failure.message}</p>
        {needsUs ? (
          <a href={dancerMessageUsUrl(failure.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE)} target="_blank" rel="noopener noreferrer" className={LINK_PRIMARY}>
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
  if (isPending || !profile || (!pre && step === null)) {
    return (
      <Card variant="padded" aria-busy="true" aria-label="Loading" testId="onboarding-skeleton" className="min-h-[240px]">
        <div className="h-[14px] w-[40%] rounded-[8px] bg-[var(--card2)]" />
        <div className="mt-[16px] h-[30px] w-[70%] rounded-[8px] bg-[var(--card2)]" />
        <div className="mt-[16px] h-[48px] rounded-[12px] bg-[var(--card2)]" />
      </Card>
    );
  }

  const run = async (work: () => Promise<MyDancerEdit>, from: StepV3 | null, to: StepV3 | 'end' | null) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (from && celebratesOnLeave(from, { bio: false, link: false })) daConfetti();
      if (to === 'end') setLeaving(true);
      else if (to) setStep(to);
    } catch (err) {
      setError(toDancerError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const list = stepsFor(roles);
  const position = step ? Math.max(0, list.indexOf(step)) : 0;
  const prev = step && position > 0 ? list[position - 1] : null;
  const nextAfter = (s: StepV3): StepV3 | 'end' => {
    const n = list[list.indexOf(s) + 1];
    // s2b replaces: only roles, styles and years exist in this slice; after years the flow ends.
    return n === 'styles' || n === 'years' ? n : 'end';
  };
  const toggleRole = (r: BuyerRole) => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const toggleStyle = (s: string) => setStyles((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const card = { busy, error };
  const saveDelta = (delta: DancerDelta) => save(diffDelta(profile, delta), profile);
  const preProps = { profile, busy, error, tag: null, onSubmit: (d: DancerDelta) => void run(() => saveDelta(d), null, null) };

  return (
    <section data-testid={pre ? `onboarding-${pre}` : `onboarding-${step}`} className={`${WRAP} mx-auto max-w-[520px]`}>
      {pre ? (
        <Card variant="padded" className="p-[12px]">
          {/* The save refreshes the cache; the next pre-stage (or the first v3 step) follows from the server shape. */}
          {pre === 'name' ? <NameCard {...preProps} /> : null}
          {pre === 'city' ? <CityCard {...preProps} /> : null}
          {pre === 'role' ? <RoleCard {...preProps} /> : null}
        </Card>
      ) : (
        <>
          <Progress total={list.length} position={position} />
          {prev ? (
            <button
              type="button"
              data-testid="onboarding-back"
              onClick={() => {
                setError(null);
                setStep(prev);
              }}
              className="mb-[8px] inline-flex min-h-[44px] cursor-pointer items-center gap-[2px] bg-transparent p-0 text-[15px] font-semibold text-[var(--mut)]"
            >
              <ChevronLeft size={18} aria-hidden /> Back
            </button>
          ) : null}
          <Card variant="padded" className="p-[12px]">
            {step === 'roles' ? (
              <RolesCardV3
                {...card}
                picked={roles}
                onToggle={toggleRole}
                onContinue={() =>
                  void run(
                    async () => {
                      const next = await saveMyBuyerRoles(roles, profile);
                      if (next !== profile) put(next);
                      return next;
                    },
                    'roles',
                    nextAfter('roles'),
                  )
                }
              />
            ) : null}
            {step === 'styles' ? (
              <StylesCardV3 {...card} picked={styles} onToggle={toggleStyle} onContinue={() => void run(() => saveDelta({ favorite_styles: styles }), 'styles', nextAfter('styles'))} />
            ) : null}
            {step === 'years' ? (
              <YearsCardV3
                {...card}
                band={band}
                onPick={setBand}
                onContinue={() =>
                  // The saved band re-sent would replace a real year with the band's: an untouched answer sends nothing.
                  void run(() => (band === bandForYearV3(profile.dance_started_year) ? Promise.resolve(profile) : saveDelta({ dance_started_year: yearForBandV3(band as YearBandV3) })), 'years', nextAfter('years'))
                }
              />
            ) : null}
          </Card>
        </>
      )}
    </section>
  );
};

export default OnboardingV3;
