// /account/o/complete -- "Complete your profile" (C15, C16, D26, D27, D50).
// One question per screen, in the server's order (my_profile_progress_v1
// `steps`), resuming at the first unanswered step. Every answer saves at once
// through the existing writers; an unchanged answer sends nothing; a failed
// save keeps the answer on screen with the error. Back goes to the previous
// question, "Finish later" leaves to Home (the answers are already saved).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { fetchOwnOrganiserEntity, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { fetchContactSettings, organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import { PROFILE_WIZARD_PATH, useProfileProgress, type ProfileProgress, type ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { storedContactFromSettings } from '../edit-in-place/contactModel';
import { uploadOrganiserPhoto } from '../edit-in-place/organiserPhotoUploadApi';
import type { ProfileEntity } from '../page/profileForm';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../ui';
import { afterDancerSave, fetchWizardDancer, wizardDancerQueryKey } from './dancerApi';
import { Celebration, LevelTrack, ProgressBar } from './LevelTrack';
import { markFinishLater } from './nudgeStore';
import { WIZARD_STEPS, isRegistered, type WizardSources } from './registry';
import { REAL_WRITERS, invalidateAfterAnswer, saveAnswer, type WizardWriters } from './wizardApi';
import { WizardEnvContext } from './wizardEnv';
import { UNLOCK_LINE, levelOf, milestoneBetween, nextOpenStep, shownSteps, stepKey } from './wizardModel';

export const FINISH_LATER_LABEL = 'Finish later';

function TopBar({ onBack, onFinishLater }: { onBack: () => void; onFinishLater: () => void }) {
  return (
    <div className="flex min-h-[56px] items-center justify-between gap-[8px] px-[8px]" data-testid="wizard-topbar">
      <button type="button" onClick={onBack} data-testid="wizard-back" className="inline-flex h-[44px] min-w-[44px] items-center gap-[2px] px-[8px] text-[15px] font-semibold text-[var(--fg)]">
        <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" /> Back
      </button>
      <h1 className="truncate text-[16px] font-bold text-[var(--fg)]">Your profile</h1>
      <button type="button" onClick={onFinishLater} data-testid="wizard-finish-later" className="h-[44px] px-[8px] text-[15px] font-semibold text-[var(--gold)]">
        {FINISH_LATER_LABEL}
      </button>
    </div>
  );
}

function Panel({ heading, children, testId }: { heading: ReactNode; children: ReactNode; testId: string }) {
  return (
    <section className="space-y-[16px]" data-testid={testId} aria-labelledby={`${testId}-h`}>
      <h2 id={`${testId}-h`} className="text-[20px] font-bold leading-[26px] text-[var(--fg)]" data-testid="wizard-question" tabIndex={-1}>{heading}</h2>
      {children}
    </section>
  );
}

export interface ProfileWizardProps {
  /** Tests: fake writers at the boundary. */
  writers?: WizardWriters;
  uploadLogo?: (organiserId: string, file: File) => Promise<string>;
}

function WizardBody({ organiserId, userId, writers, uploadLogo }: { organiserId: string | null; userId: string } & Required<ProfileWizardProps>) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const progress = useProfileProgress(organiserId);
  const dancer = useQuery({ queryKey: wizardDancerQueryKey(userId), queryFn: fetchWizardDancer });
  const entity = useQuery({ queryKey: ownOrganiserEntityQueryKey(organiserId ?? undefined), queryFn: () => fetchOwnOrganiserEntity(organiserId!), enabled: !!organiserId });
  const contact = useQuery({ queryKey: organiserContactSettingsQueryKey(organiserId ?? undefined, userId), queryFn: () => fetchContactSettings(organiserId!), enabled: !!organiserId });

  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [milestone, setMilestone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from the photo screen (or anywhere): read the progress fresh.
  useEffect(() => { void qc.invalidateQueries({ queryKey: ['my-profile-progress'] }); }, [qc]);

  const sources = useMemo<WizardSources>(() => ({
    dancer: dancer.data ?? null,
    organiser: entity.data ? { ...(entity.data as ProfileEntity), contact: contact.data ? storedContactFromSettings(contact.data) : null } : null,
  }), [dancer.data, entity.data, contact.data]);

  const env = useMemo(() => ({
    uploadLogo: organiserId ? (file: File) => uploadLogo(organiserId, file) : null,
    returnTo: PROFILE_WIZARD_PATH,
  }), [organiserId, uploadLogo]);

  const p: ProfileProgress | undefined = progress.data;
  const steps = p ? shownSteps(p.steps, isRegistered) : [];
  const open = nextOpenStep(steps, handled);
  const step = (cursor && steps.find((s) => stepKey(s) === cursor)) || open;

  const goHome = () => navigate(ORG_PATHS.home);
  const finishLater = () => { markFinishLater(userId); goHome(); };

  const advance = (left: ProgressStep) => {
    const key = stepKey(left);
    const nextHandled = new Set(handled).add(key);
    setHandled(nextHandled);
    setHistory((h) => [...h, key]);
    setCursor(null);
    setError(null);
    if (milestoneBetween(left, nextOpenStep(steps, nextHandled))) setMilestone(true);
  };

  const back = () => {
    if (milestone) setMilestone(false);
    const prev = history[history.length - 1];
    // Back from the first question leaves like Finish later, or Home would open the wizard again (D50).
    if (!prev) { finishLater(); return; }
    setHistory((h) => h.slice(0, -1));
    setHandled((s) => { const n = new Set(s); n.delete(prev); return n; });
    setCursor(prev);
    setError(null);
  };

  const answer = async (s: ProgressStep, value: unknown) => {
    const entry = WIZARD_STEPS.get(stepKey(s))!;
    setSaving(true);
    setError(null);
    const outcome = await saveAnswer(entry, value, { sources, organiserId, writers, onDancerSaved: (next) => afterDancerSave(qc, userId, next) });
    setSaving(false);
    if (outcome.kind === 'failed') { setError(outcome.message); return; }
    if (outcome.kind === 'saved') invalidateAfterAnswer(qc, s.area, organiserId, userId);
    advance(s);
  };

  const reopen = (required: boolean | null) => {
    setHandled((h) => new Set([...h].filter((k) => { const s = steps.find((x) => stepKey(x) === k); return !s || s.done || (required !== null && s.required !== required); })));
    setMilestone(false);
  };

  let body: ReactNode;
  const failed = progress.isError || (step?.area === 'dancer' && dancer.isError) || (step?.area === 'organiser' && (entity.isError || contact.isError));
  if (failed) {
    body = <ErrorState title="Your profile did not load" onRetry={() => { void progress.refetch(); void dancer.refetch(); void entity.refetch(); void contact.refetch(); }} retrying={progress.isFetching} testId="wizard-error" />;
  } else if (!p || (step?.area === 'dancer' && !dancer.data) || (step?.area === 'organiser' && (!entity.data || !contact.data))) {
    body = <SkeletonRows count={3} label="Loading your profile" testId="wizard-loading" />;
  } else if (milestone) {
    const nextUp = nextOpenStep(steps, handled);
    if (progress.isFetching) body = <SkeletonRows count={3} label="Checking your answers" testId="wizard-checking" />;
    else if (p.publishReady) {
      body = (
        <Panel heading="You can publish now" testId="wizard-milestone">
          <Celebration level="ready" />
          <LevelTrack percent={p.percent} publishReady={p.publishReady} />
          <p className="text-[15px] text-[var(--fg)]" data-testid="wizard-unlock">{UNLOCK_LINE.ready}</p>
          {nextUp ? (
            <>
              <p className="text-[14px] text-[var(--mut)]">The rest is optional. Each answer makes your profiles fuller.</p>
              <PrimaryButton testId="wizard-milestone-continue" onClick={() => setMilestone(false)}>Keep going</PrimaryButton>
            </>
          ) : (
            <PrimaryButton testId="wizard-home" onClick={goHome}>Back to Home</PrimaryButton>
          )}
        </Panel>
      );
    } else {
      body = (
        <Panel heading="A few required answers are still missing" testId="wizard-milestone-missing">
          <LevelTrack percent={p.percent} publishReady={p.publishReady} />
          <PrimaryButton testId="wizard-reopen-required" onClick={() => reopen(true)}>Answer them</PrimaryButton>
        </Panel>
      );
    }
  } else if (!step) {
    const full = levelOf(p) === 'full';
    const skipped = steps.some((s) => !s.done && handled.has(stepKey(s)));
    body = full ? (
      <Panel heading="Your profile is 100% complete" testId="wizard-full">
        <Celebration level="full" />
        <LevelTrack percent={p.percent} publishReady={p.publishReady} />
        <p className="text-[15px] text-[var(--fg)]" data-testid="wizard-unlock">{UNLOCK_LINE.full}</p>
        <PrimaryButton testId="wizard-home" onClick={goHome}>Back to Home</PrimaryButton>
      </Panel>
    ) : (
      <Panel heading={`Your profile is ${p.percent}% complete`} testId="wizard-end">
        <LevelTrack percent={p.percent} publishReady={p.publishReady} />
        <PrimaryButton testId="wizard-home" onClick={goHome}>Back to Home</PrimaryButton>
        {skipped && <GhostButton testId="wizard-reopen" onClick={() => reopen(null)}>Answer the questions you skipped</GhostButton>}
      </Panel>
    );
  } else {
    const entry = WIZARD_STEPS.get(stepKey(step))!;
    const Step = entry.Component;
    body = (
      <Panel heading={entry.title} testId="wizard-step">
        <div data-step={stepKey(step)} data-required={step.required}>
          <Step
            key={stepKey(step)}
            field={step.field}
            value={entry.read(sources)}
            required={step.required}
            saving={saving}
            error={error}
            onAnswer={(v) => void answer(step, v)}
            onSkip={step.required ? undefined : () => advance(step)}
          />
        </div>
      </Panel>
    );
  }

  return (
    <OrganiserShell topBar={<TopBar onBack={back} onFinishLater={finishLater} />} testId="org-page-wizard">
      <WizardEnvContext.Provider value={env}>
        <div className="space-y-[20px]">
          {p && <ProgressBar percent={p.percent} requiredLeft={p.requiredLeft} />}
          {body}
        </div>
      </WizardEnvContext.Provider>
    </OrganiserShell>
  );
}

export function ProfileWizardScreen({ writers = REAL_WRITERS, uploadLogo = uploadOrganiserPhoto }: ProfileWizardProps) {
  const { user, home, selected } = useOrganiserChoice();
  if (!user) return null;
  // Wait for the page choice, so progress is read once, for the right page.
  if (home.isPending) {
    return (
      <OrganiserShell title="Your profile" testId="org-page-wizard">
        <SkeletonRows count={3} label="Loading your profile" testId="wizard-loading" />
      </OrganiserShell>
    );
  }
  return <WizardBody key={selected?.id ?? 'none'} organiserId={selected?.id ?? null} userId={user.id} writers={writers} uploadLogo={uploadLogo} />;
}

export default function ProfileWizard() {
  return <ProfileWizardScreen />;
}
