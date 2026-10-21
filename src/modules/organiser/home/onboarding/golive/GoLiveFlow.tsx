// /account/o/go-live -- "Almost live", the quick questions one per screen, "All
// set", Go live (Arc 1, PR 3 slice B). It REUSES the profile wizard's step
// components, writers and saver (registry, saveAnswer), never a second mapping;
// the People arc's wizard itself is untouched. The list of questions is the
// server's (my_profile_progress_v1), taken once at the start.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOwnOrganiserEntity, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { fetchContactSettings, organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import { useProfileProgress, type ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { lifecycleCommand } from '@/modules/organiser/shared/seriesCommands';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import { goLiveRefusal } from '@/modules/organiser/shared/goLiveCheck';
import { goDone } from '@/modules/organiser/flows/doneState';
import { useFlowSend, useSeriesWorkspace } from '@/modules/organiser/flows/add/useFlow';
import { EventConflict } from '@/modules/organiser/flows/event';
import { storedContactFromSettings } from '../../../edit-in-place/contactModel';
import { uploadOrganiserPhoto } from '../../../edit-in-place/organiserPhotoUploadApi';
import type { ProfileEntity } from '../../../page/profileForm';
import { OrganiserShell, ORG_PATHS } from '../../../shell';
import { useOrganiserChoice } from '../../../switch/useOrganiserChoice';
import { usePrefersReducedMotion } from '../../../motion';
import { ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '../../../ui';
import { afterDancerSave, fetchWizardDancer, wizardDancerQueryKey } from '../../../wizard/dancerApi';
import { WIZARD_STEPS, type WizardSources } from '../../../wizard/registry';
import { REAL_WRITERS, invalidateAfterAnswer, saveAnswer, type WizardWriters } from '../../../wizard/wizardApi';
import { WizardEnvContext } from '../../../wizard/wizardEnv';
import {
  ALL_SET_TITLE, ALMOST_LIVE_TITLE, BACK_LABEL, CONTINUE_LABEL, GO_LIVE_LABEL, NOT_NOW_LABEL, NOT_YET_LABEL,
  SECTION_LABEL, allSetLine, almostLiveLine, openQuestions, sectionOf, stepInSection, stepKey, mineFor,
} from './goLiveModel';

type Phase = 'bridge' | 'question' | 'done';
type Dir = 'forward' | 'back';

/** One screen, slid in from the side it came from (0.3 s, none under reduced motion). */
function Slide({ id, dir, children }: { id: string; dir: Dir; children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      key={id}
      data-testid="golive-slide"
      data-motion={reduced ? 'off' : 'on'}
      className={cn('space-y-[16px]', !reduced && 'animate-in fade-in duration-300', !reduced && (dir === 'forward' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'))}
    >
      {children}
    </div>
  );
}

/** Dots: one per question, filled up to the one on screen (or all when finished). */
function Dots({ total, at }: { total: number; at: number }) {
  return (
    <div className="flex items-center justify-center gap-[6px]" data-testid="golive-dots" role="img" aria-label={`Question ${Math.min(at + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} data-testid="golive-dot" data-on={i <= at} className={cn('block h-[8px] w-[8px] rounded-full', i <= at ? 'bg-[var(--gold)]' : 'bg-[var(--card2)]')} />
      ))}
    </div>
  );
}

function Hero({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-col items-center gap-[8px] py-[16px] text-center">
      <span aria-hidden="true" className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[var(--gold)] text-[var(--btnfg)]"><Check className="h-[32px] w-[32px]" /></span>
      <h2 className="text-[22px] font-bold text-[var(--fg)]" data-testid="golive-title" tabIndex={-1}>{title}</h2>
      <p className="text-[15px] text-[var(--mut)]" data-testid="golive-line">{line}</p>
    </div>
  );
}

export interface GoLiveFlowProps {
  writers?: WizardWriters;
  uploadLogo?: (organiserId: string, file: File) => Promise<string>;
}

function Body({ organiserId, userId, seriesId, writers, uploadLogo }: { organiserId: string | null; userId: string; seriesId: string | null } & Required<GoLiveFlowProps>) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const progress = useProfileProgress(organiserId);
  const dancer = useQuery({ queryKey: wizardDancerQueryKey(userId), queryFn: fetchWizardDancer });
  const entity = useQuery({ queryKey: ownOrganiserEntityQueryKey(organiserId ?? undefined), queryFn: () => fetchOwnOrganiserEntity(organiserId!), enabled: !!organiserId });
  const contact = useQuery({ queryKey: organiserContactSettingsQueryKey(organiserId ?? undefined, userId), queryFn: () => fetchContactSettings(organiserId!), enabled: !!organiserId });
  const ws = useSeriesWorkspace(seriesId ?? '', !!seriesId);
  const eventName = ws.data?.series.name ?? null;

  const [questions, setQuestions] = useState<ProgressStep[] | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<Dir>('forward');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Take the list ONCE, from a fresh read, and open on the bridge (with an event) or the first question.
  useEffect(() => { void qc.invalidateQueries({ queryKey: ['my-profile-progress'] }); }, [qc]);
  const p = progress.data;
  if (p && !questions && !progress.isFetching) {
    const list = openQuestions(p);
    setQuestions(list);
    setPhase(list.length === 0 ? 'done' : seriesId ? 'bridge' : 'question');
  }

  const sources = useMemo<WizardSources>(() => ({
    dancer: dancer.data ?? null,
    organiser: entity.data ? { ...(entity.data as ProfileEntity), contact: contact.data ? storedContactFromSettings(contact.data) : null } : null,
  }), [dancer.data, entity.data, contact.data]);
  const env = useMemo(() => ({
    uploadLogo: organiserId ? (file: File) => uploadLogo(organiserId, file) : null,
    returnTo: organiserId ? `${ORG_PATHS.goLive}?o=${encodeURIComponent(organiserId)}${seriesId ? `&series=${encodeURIComponent(seriesId)}` : ''}` : ORG_PATHS.goLive,
  }), [organiserId, seriesId, uploadLogo]);

  const flow = useFlowSend(seriesId ?? '', (err) => {
    if (!goLiveRefusal(err)) return null;
    return 'Not ready to go live yet.';
  });

  const goHome = () => navigate(ORG_PATHS.home);
  const move = (to: Phase, d: Dir, index = at) => { setDir(d); setPhase(to); setAt(index); setError(null); };

  const current = questions && phase === 'question' ? questions[at] : null;
  const total = questions?.length ?? 0;

  const answer = async (s: ProgressStep, value: unknown) => {
    const entry = WIZARD_STEPS.get(stepKey(s))!;
    setSaving(true);
    setError(null);
    const outcome = await saveAnswer(entry, value, { sources, organiserId, writers, onDancerSaved: (next) => afterDancerSave(qc, userId, next) });
    setSaving(false);
    if (outcome.kind === 'failed') { setError(outcome.message); return; }
    if (outcome.kind === 'saved') invalidateAfterAnswer(qc, s.area, organiserId, userId);
    if (at + 1 >= total) move('done', 'forward', total);
    else move('question', 'forward', at + 1);
  };

  const back = () => {
    if (phase === 'question' && at > 0) move('question', 'back', at - 1);
    else if (phase === 'question' && seriesId) move('bridge', 'back', 0);
    else if (phase === 'done' && total > 0) move('question', 'back', total - 1);
    else goHome();
  };

  const liveNow = async () => {
    if (!ws.data || !seriesId) return;
    await flow.run(async () => {
      const r = await flow.send(seriesId, ws.data!.series.version, lifecycleCommand('live'));
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      if (r) goDone(navigate, { title: 'Live', message: `Live - ${ws.data!.series.name}`, seriesId });
    });
  };

  if (flow.conflict && seriesId) return <EventConflict seriesId={seriesId} />;
  const failed = progress.isError || dancer.isError || (!!organiserId && (entity.isError || contact.isError));
  const loading = !failed && (!phase || !questions || !dancer.data || (!!organiserId && (!entity.data || !contact.data)));

  let body: ReactNode;
  if (failed) {
    body = <ErrorState title="Your profile did not load" onRetry={() => { void progress.refetch(); void dancer.refetch(); void entity.refetch(); void contact.refetch(); }} retrying={progress.isFetching} testId="golive-error" />;
  } else if (loading) {
    body = <SkeletonRows count={3} label="Loading your questions" testId="golive-loading" />;
  } else if (phase === 'bridge') {
    body = (
      <Slide id="bridge" dir={dir}>
        <Hero title={ALMOST_LIVE_TITLE} line={almostLiveLine(eventName ?? 'Your event', total)} />
        <Dots total={total} at={-1} />
        <div className="space-y-[8px]">
          <PrimaryButton testId="golive-continue" onClick={() => move('question', 'forward', 0)}>{CONTINUE_LABEL}</PrimaryButton>
          <GhostButton testId="golive-not-now" onClick={goHome}>{NOT_NOW_LABEL}</GhostButton>
        </div>
      </Slide>
    );
  } else if (phase === 'question' && current) {
    const entry = WIZARD_STEPS.get(stepKey(current))!;
    const Step = entry.Component;
    const sec = sectionOf(current);
    const { k, n } = stepInSection(questions!, at);
    const mine = mineFor(current, sources);
    body = (
      <Slide id={stepKey(current)} dir={dir}>
        <Dots total={total} at={at} />
        <p className="flex items-center justify-between text-[13px] text-[var(--mut)]" data-testid="golive-section">
          <span className="font-semibold text-[var(--fg)]">{SECTION_LABEL[sec]}</span>
          <span>Step {k} of {n}</span>
        </p>
        <h2 className="text-[20px] font-bold leading-[26px] text-[var(--fg)]" data-testid="golive-question" tabIndex={-1}>{entry.title}</h2>
        {mine && (
          <button type="button" data-testid="golive-use-mine" disabled={saving} onClick={() => void answer(current, mine.value)} className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--gold)] px-[16px] text-[15px] font-semibold text-[var(--fg)]">
            {mine.label}
          </button>
        )}
        <div data-step={stepKey(current)} data-required="true">
          <Step key={stepKey(current)} field={current.field} value={entry.read(sources)} required saving={saving} error={error} onAnswer={(v) => void answer(current, v)} />
        </div>
      </Slide>
    );
  } else {
    body = (
      <Slide id="done" dir={dir}>
        <Hero title={ALL_SET_TITLE} line={allSetLine(seriesId ? eventName : null)} />
        {flow.error && <p role="alert" className="text-[14px] text-[var(--warn-fg)]" data-testid="golive-live-error">{flow.error}</p>}
        <div className="space-y-[8px]">
          {seriesId ? (
            <>
              <PrimaryButton testId="golive-live" loading={flow.busy} loadingLabel="Going live" disabled={!ws.data} onClick={() => void liveNow()}>{GO_LIVE_LABEL}</PrimaryButton>
              <GhostButton testId="golive-not-yet" onClick={goHome}>{NOT_YET_LABEL}</GhostButton>
            </>
          ) : (
            <>
              <PrimaryButton testId="golive-add-first" onClick={() => navigate(ORG_PATHS.newWhatFor(organiserId))}>Add your first event</PrimaryButton>
              <GhostButton testId="golive-home" onClick={goHome}>Back to my events</GhostButton>
            </>
          )}
        </div>
      </Slide>
    );
  }

  const topBar = (
    <div className="flex min-h-[56px] items-center justify-between gap-[8px] px-[8px]" data-testid="golive-topbar">
      {phase && phase !== 'bridge' ? (
        <button type="button" onClick={back} data-testid="golive-back" className="inline-flex h-[44px] min-w-[44px] items-center gap-[2px] px-[8px] text-[15px] font-semibold text-[var(--fg)]">
          <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" /> {BACK_LABEL}
        </button>
      ) : <span className="min-w-[44px]" />}
      <h1 className="truncate text-[16px] font-bold text-[var(--fg)]">Go live</h1>
      <span className="min-w-[44px]" />
    </div>
  );

  return (
    <OrganiserShell topBar={topBar} testId="org-page-golive">
      <WizardEnvContext.Provider value={env}>{body}</WizardEnvContext.Provider>
    </OrganiserShell>
  );
}

export function GoLiveFlowScreen({ writers = REAL_WRITERS, uploadLogo = uploadOrganiserPhoto }: GoLiveFlowProps) {
  const { user, home, selected } = useOrganiserChoice();
  const [params] = useSearchParams();
  if (!user) return null;
  if (home.isPending) {
    return (
      <OrganiserShell title="Go live" testId="org-page-golive">
        <SkeletonRows count={3} label="Loading your questions" testId="golive-loading" />
      </OrganiserShell>
    );
  }
  return <Body key={`${selected?.id ?? 'none'}:${params.get('series') ?? ''}`} organiserId={selected?.id ?? null} userId={user.id} seriesId={params.get('series')} writers={writers} uploadLogo={uploadLogo} />;
}

export default function GoLiveFlow() {
  return <GoLiveFlowScreen />;
}
