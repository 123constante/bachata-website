import { useEffect, useState, type ReactNode } from 'react';
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
import { bandForYearV3, celebratesOnLeave, partnerDelta, partnerDraftFrom, resumeStep, stepsFor, yearForBandV3, type PartnerDraftV3, type StepV3, type YearBandV3 } from './modelV3';
import { CityCard, NameCard, RoleCard, photoHandoff } from './steps';
import { bioLinkResult, linkPrefill } from './bioModel';
import { BioLinksCardV3, PartnerCardV3, PartnerSheetV3, PhotoCardV3, RolesCardV3, StylesCardV3, YearsCardV3 } from './stepsV3';
import { PrimaryButton, WRAP } from './ui';
import { LockedHome } from '../home/lockedMode';
import { DANCER_ONBOARDING_V3_ENABLED } from './onboardingV3Flag';
import { NeonFrame } from './neon/NeonFrame';
import { RolesNeon, StylesNeon, YearsNeon } from './neon/NeonSteps';
import { NeonPartner } from './neon/NeonPartner';
import { BioNeon, PhotoNeon } from './neon/NeonPhotoBio';
import { YoureIn } from './neon/YoureIn';
import { boom } from './neon/neonConfetti';
import { CONFETTI_DELAY_MS } from './neonMotion';

/** Same 3 lines as OnboardingScreen's leaveFor (copied, not exported: the old file stays untouched). */
const leaveFor = (qc: QueryClient, navigate: NavigateFunction, end: string) => {
  if (end !== APP_HOME_PATH) resetDancerGate(qc);
  navigate(end, { replace: true });
};

/** The sign-up questions asked before the code: the existing cards, unchanged. */
const PRE_STAGES: readonly RequiredStage[] = ['name', 'city', 'role'];

/** Set when the photo tile hands off, so coming back lands on the photo step (with the photo shown), not Home. */
const PHOTO_FLAG = 'da-onboarding-v3-photo';
const flag = (op: 'get' | 'set' | 'clear'): boolean => {
  try {
    if (op === 'set') window.sessionStorage.setItem(PHOTO_FLAG, '1');
    else if (op === 'clear') window.sessionStorage.removeItem(PHOTO_FLAG);
    else return window.sessionStorage.getItem(PHOTO_FLAG) === '1';
  } catch {
    /* storage can be blocked: the resume rule still works from server data */
  }
  return false;
};

/** Set once the "You're in" moment has shown, so a reload does not repeat it. */
const SEEN_FLAG = 'da-onboarding-v8-youre-in';
const seen = (set?: boolean): boolean => {
  try {
    if (set) window.sessionStorage.setItem(SEEN_FLAG, '1');
    else return window.sessionStorage.getItem(SEEN_FLAG) === '1';
  } catch {
    /* blocked storage: the moment may repeat, nothing breaks */
  }
  return false;
};

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
  /** ?step=bio (Home's "Add"): only the bio + links screen, even on a complete profile. */
  const bioOnly = params.get('step') === 'bio';
  const { data: profile, isPending, isError, isFetching, error: loadError, save, refetch } = useMyDancerEdit({ refetchOnMount: 'always', retry: false });
  const put = usePutMyDancerEdit();
  const [step, setStep] = useState<StepV3 | null>(null);
  const [roles, setRoles] = useState<BuyerRole[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [band, setBand] = useState<YearBandV3 | null>(null);
  const [partner, setPartner] = useState<PartnerDraftV3>({ answer: null, kinds: [], role: null, years: null, details: '' });
  const [bio, setBio] = useState('');
  const [link, setLink] = useState('');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** ?step=peek: the locked real Home. B3 owns the trigger; the screen itself only shows while photo, years and styles are all missing. */
  const [peekDone, setPeekDone] = useState(false);
  /** v8 phase flow: 'in' (2s moment) then 'peek'; null = no moment. Decided once with the starting step. */
  const [phase, setPhase] = useState<'in' | 'peek' | null>(null);

  const pre = profile ? PRE_STAGES.find((s) => s === firstRequiredStage(profile.strength.missing)) ?? null : null;

  // Decide the starting screen ONCE, from the first server shape with the sign-up questions answered.
  if (profile && !pre && step === null && !leaving) {
    const resumed = bioOnly ? 'bio' : resumeStep(profile);
    // Back from the photo screen with a photo: stay on the photo step (the person pressed Continue next).
    const start: StepV3 | 'done' = resumed === 'done' && flag('get') ? 'photo' : resumed;
    if (start !== 'done') {
      setStep(start);
      if (DANCER_ONBOARDING_V3_ENABLED && !params.get('step') && !seen() && profile.avatar_url === null && profile.dance_started_year === null && profile.favorite_styles.length === 0) setPhase('in');
      setPartner(partnerDraftFrom(profile));
      setRoles(profile.buyer_roles.length > 0 ? profile.buyer_roles : ['dancer']);
      setStyles(profile.favorite_styles);
      setBand(bandForYearV3(profile.dance_started_year));
      setBio(profile.bio ?? '');
      setLink(linkPrefill(profile));
    } else {
      setLeaving(true);
    }
  }
  useEffect(() => {
    if (phase === 'in') seen(true);
  }, [phase]);
  useEffect(() => {
    if (leaving) flag('clear');
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

  if (phase === 'in' && !pre) return <YoureIn firstName={(profile.first_name ?? profile.display_name ?? '').trim() || 'there'} onDone={() => setPhase('peek')} />;

  if (!peekDone && !pre && (params.get('step') === 'peek' || phase === 'peek') && profile.avatar_url === null && profile.dance_started_year === null && profile.favorite_styles.length === 0) {
    return (
      <LockedHome
        profile={profile}
        onFinish={() => {
          setStep('roles');
          setPeekDone(true);
        }}
      />
    );
  }

  const run = async (work: () => Promise<MyDancerEdit>, from: StepV3 | null, to: StepV3 | 'end' | null, filled = { bio: false, link: false }) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (from && celebratesOnLeave(from, filled)) {
        if (DANCER_ONBOARDING_V3_ENABLED) setTimeout(() => boom(false), CONFETTI_DELAY_MS);
        else daConfetti();
      }
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
  const prev = step && position > 0 && !bioOnly ? list[position - 1] : null;
  const nextAfter = (s: StepV3): StepV3 | 'end' => {
    const n = list[list.indexOf(s) + 1];
    return n ?? 'end';
  };
  const toggleRole = (r: BuyerRole) => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const toggleStyle = (s: string) => setStyles((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const card = { busy, error };
  // v8 Neon Night look for roles, styles, years only: same state and handlers, different shell and rows.
  const neonStep = DANCER_ONBOARDING_V3_ENABLED && (step === 'roles' || step === 'styles' || step === 'years' || step === 'partner' || step === 'photo' || step === 'bio');
  const Roles = neonStep ? RolesNeon : RolesCardV3;
  const Styles = neonStep ? StylesNeon : StylesCardV3;
  const Years = neonStep ? YearsNeon : YearsCardV3;
  const Photo = neonStep ? PhotoNeon : PhotoCardV3;
  const shell = (kids: ReactNode) =>
    neonStep ? (
      <NeonFrame
        pos={position}
        total={list.length}
        top={step === 'years' ? 215 : step === 'photo' || step === 'bio' ? 130 : 300}
        onBack={
          prev
            ? () => {
                setError(null);
                setStep(prev);
              }
            : undefined
        }
      >
        {kids}
      </NeonFrame>
    ) : (
      <Card variant="padded" className="p-[12px]">
        {kids}
      </Card>
    );
  const saveDelta = (delta: DancerDelta) => save(diffDelta(profile, delta), profile);
  const bioProps = {
    ...card,
    bio,
    link,
    onBio: setBio,
    onLink: setLink,
    onSkip: () => setLeaving(true),
    onContinue: () => {
      const r = bioLinkResult(profile, bio, link);
      if (r.error) return setError(r.error);
      void run(() => (Object.keys(r.delta).length === 0 ? Promise.resolve(profile) : saveDelta(r.delta)), 'bio', 'end', r.filled);
    },
  };
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
          {bioOnly || neonStep ? null : <Progress total={list.length} position={position} />}
          {bioOnly ? (
            <button
              type="button"
              data-testid="onboarding-back"
              onClick={() => setLeaving(true)}
              className="mb-[8px] inline-flex min-h-[44px] cursor-pointer items-center gap-[2px] bg-transparent p-0 text-[15px] font-semibold text-[var(--mut)]"
            >
              <ChevronLeft size={18} aria-hidden /> Back
            </button>
          ) : null}
          {prev && !neonStep ? (
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
          {shell(<>
            {step === 'roles' ? (
              <Roles
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
              <Styles {...card} picked={styles} onToggle={toggleStyle} onContinue={() => void run(() => saveDelta({ favorite_styles: styles }), 'styles', nextAfter('styles'))} />
            ) : null}
            {step === 'years' ? (
              <Years
                {...card}
                band={band}
                onPick={setBand}
                onContinue={() =>
                  // The saved band re-sent would replace a real year with the band's: an untouched answer sends nothing.
                  void run(() => (band === bandForYearV3(profile.dance_started_year) ? Promise.resolve(profile) : saveDelta({ dance_started_year: yearForBandV3(band as YearBandV3) })), 'years', nextAfter('years'))
                }
              />
            ) : null}
            {step === 'partner' && neonStep ? (
              <NeonPartner
                {...card}
                draft={partner}
                sheet={sheet}
                onAnswer={(a) => {
                  setPartner((d) => ({ ...d, answer: a }));
                  setSheet(a === 'yes');
                }}
                onChange={setPartner}
                onOpenSheet={() => setSheet(true)}
                onSave={() => {
                  setSheet(false);
                  void run(() => saveDelta(partnerDelta(partner)), 'partner', nextAfter('partner'));
                }}
                onContinue={() => void run(() => saveDelta(partnerDelta(partner)), 'partner', nextAfter('partner'))}
              />
            ) : null}
            {step === 'partner' && !neonStep ? (
              <PartnerCardV3
                {...card}
                draft={partner}
                onAnswer={(a) => {
                  setPartner((d) => ({ ...d, answer: a }));
                  setSheet(a === 'yes');
                }}
                onContinue={() => void run(() => saveDelta(partnerDelta(partner)), 'partner', nextAfter('partner'))}
              />
            ) : null}
            {step === 'photo' ? (
              <Photo
                {...card}
                photoUrl={profile.avatar_url}
                onPickPhoto={() => {
                  flag('set');
                  navigate(photoHandoff(params.get(RETURN_TO_PARAM)));
                }}
                onContinue={() => void run(() => Promise.resolve(profile), 'photo', nextAfter('photo'))}
              />
            ) : null}
            {step === 'bio' ? (
              neonStep ? (
                <BioNeon {...bioProps} bioOnly={bioOnly} />
              ) : (
                <BioLinksCardV3 {...bioProps} />
              )
            ) : null}
          </>)}
          {step === 'partner' && sheet && !neonStep ? <PartnerSheetV3 draft={partner} onChange={setPartner} onClose={() => setSheet(false)} /> : null}
        </>
      )}
    </section>
  );
};

export default OnboardingV3;
