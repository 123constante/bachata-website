// /account/o/go-live -- "Almost live", the quick questions one per screen, "All
// set", Go live (Arc 1, PR 3 slice B). It REUSES the profile wizard's step
// components, writers and saver (registry, saveAnswer), never a second mapping;
// the People arc's wizard itself is untouched. The list of questions is the
// server's (my_profile_progress_v1), taken once at the start.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchOwnOrganiserEntity, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { fetchContactSettings, organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import { useProfileProgress, type ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { lifecycleCommand } from '@/modules/organiser/shared/seriesCommands';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import { goLiveCheckQueryKey, goLiveRefusal, useGoLiveCheck, type GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
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
  EVENT_FAILED_REASON, LOAD_TIMEOUT_MS, EVENT_LOADING_REASON, GAPS_TITLE, RETRY_LABEL, TRY_AGAIN_LABEL, goLiveView, notYetLine, goLiveGaps,
  type CheckAnswer,
  SECTION_LABEL, allSetLine, almostLiveLine, openQuestions, sectionOf, stepInSection, stepKey, mineFor,
} from './goLiveModel';
import { fetchMyRoleIntent, myRoleIntentQueryKey, myRolesQueryKey, answerDoYou } from '@/modules/areas/home/rolesApi';
import { fetchMyRoleDetails, saveMyRole } from '@/modules/areas/shared/areaApi';
import type { Role } from '@/modules/areas/shared/fieldRegistry';
import { RoleQuestion } from './RoleQuestion';
import { ITS_LIVE_TITLE, ROLE_QUESTION_TITLE, ROLE_SAVE_FAILED, itsLiveLine, offerRoles, rolesToAsk, saveRoleAnswers, type RoleAnswers, type RoleQuestionWriters } from './roleQuestion';

/** The real role writers: the Your areas Yes/No (B-DB1) and save_my_role_v1, changed keys only. */
export const REAL_ROLE_QUESTION_WRITERS: RoleQuestionWriters = {
  answerDoYou: (role, yes) => answerDoYou(role, yes),
  fetchDetails: async (role) => (await fetchMyRoleDetails(role)).details,
  saveMyRole,
};

type Phase = 'bridge' | 'question' | 'roles' | 'done';
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
  roleWriters?: RoleQuestionWriters;
}

function Body({ organiserId, userId, seriesId, writers, uploadLogo, roleWriters }: { organiserId: string | null; userId: string; seriesId: string | null } & Required<GoLiveFlowProps>) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const progress = useProfileProgress(organiserId);
  const dancer = useQuery({ queryKey: wizardDancerQueryKey(userId), queryFn: fetchWizardDancer });
  const entity = useQuery({ queryKey: ownOrganiserEntityQueryKey(organiserId ?? undefined), queryFn: () => fetchOwnOrganiserEntity(organiserId!), enabled: !!organiserId });
  const contact = useQuery({ queryKey: organiserContactSettingsQueryKey(organiserId ?? undefined, userId), queryFn: () => fetchContactSettings(organiserId!), enabled: !!organiserId });
  const ws = useSeriesWorkspace(seriesId ?? '', !!seriesId);
  const eventName = ws.data?.series.name ?? null;
  // "Do you also DJ or teach?" is asked only on the way to publishing an event; an intent that fails to load skips it.
  const intent = useQuery({ queryKey: myRoleIntentQueryKey, queryFn: fetchMyRoleIntent, enabled: !!seriesId, retry: false });
  const intentSettled = !seriesId || !!intent.data || intent.isError;

  const [questions, setQuestions] = useState<ProgressStep[] | null>(null);
  const [asked, setAsked] = useState<Role[]>([]);
  const [roleAnswers, setRoleAnswers] = useState<RoleAnswers>({});
  const [phase, setPhase] = useState<Phase | null>(null);
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<Dir>('forward');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Take the list ONCE, from a fresh read, and open on the bridge (with an event) or the first question.
  useEffect(() => { void qc.invalidateQueries({ queryKey: ['my-profile-progress'] }); }, [qc]);
  const p = progress.data;
  if (p && !questions && !progress.isFetching && intentSettled) {
    const list = openQuestions(p);
    const roles = seriesId && intent.data ? rolesToAsk(intent.data) : [];
    setQuestions(list);
    setAsked(roles);
    setPhase(list.length === 0 && roles.length === 0 ? 'done' : seriesId ? 'bridge' : 'question');
  }

  const sources = useMemo<WizardSources>(() => ({
    dancer: dancer.data ?? null,
    organiser: entity.data ? { ...(entity.data as ProfileEntity), contact: contact.data ? storedContactFromSettings(contact.data) : null } : null,
  }), [dancer.data, entity.data, contact.data]);
  const env = useMemo(() => ({
    uploadLogo: organiserId ? (file: File) => uploadLogo(organiserId, file) : null,
    returnTo: organiserId ? `${ORG_PATHS.goLive}?o=${encodeURIComponent(organiserId)}${seriesId ? `&series=${encodeURIComponent(seriesId)}` : ''}` : ORG_PATHS.goLive,
  }), [organiserId, seriesId, uploadLogo]);

  const [refused, setRefused] = useState<{ check: GoLiveCheck; at: number } | null>(null);
  const [notYet, setNotYet] = useState<string | null>(null);
  const check = useGoLiveCheck(seriesId ?? '', phase === 'done');
  useEffect(() => { if (seriesId) void qc.invalidateQueries({ queryKey: goLiveCheckQueryKey(seriesId) }); }, [qc, seriesId]);
  const flow = useFlowSend(seriesId ?? '', (err) => {
    const r = goLiveRefusal(err);
    if (!r) return null;
    if (seriesId) {
      setRefused({ check: r, at: Date.now() });
      setNotYet(notYetLine(goLiveGaps(r, seriesId, organiserId)));
      void qc.invalidateQueries({ queryKey: goLiveCheckQueryKey(seriesId) });
    }
    return 'Not ready to go live yet.';
  });
  // A check fetched after the refusal is newer than it; until then the refusal's own list is the latest word.
  const refusalIsLatest = !!refused && check.dataUpdatedAt < refused.at;
  const answerNow: CheckAnswer = refusalIsLatest ? { status: 'ok', check: refused!.check }
    : check.data ? { status: 'ok', check: check.data } : check.isError ? { status: 'failed' } : { status: 'loading' };
  const view = goLiveView(answerNow, seriesId ? eventName : null, seriesId ?? '', organiserId);
  const gaps = seriesId ? view.gaps : [];

  const goHome = () => navigate(ORG_PATHS.home);
  const move = (to: Phase, d: Dir, index = at) => { setDir(d); setPhase(to); setAt(index); setError(null); };

  const current = questions && phase === 'question' ? questions[at] : null;
  const asksRoles = asked.length > 0;
  const qCount = questions?.length ?? 0;
  // The roles screen counts as one more quick question (bridge line, dots), in "About your page".
  const total = qCount + (asksRoles ? 1 : 0);
  const afterQuestions = (d: Dir = 'forward') => (asksRoles ? move('roles', d, qCount) : move('done', d, total));

  const answer = async (s: ProgressStep, value: unknown) => {
    const entry = WIZARD_STEPS.get(stepKey(s))!;
    setSaving(true);
    setError(null);
    const outcome = await saveAnswer(entry, value, { sources, organiserId, writers, onDancerSaved: (next) => afterDancerSave(qc, userId, next) });
    setSaving(false);
    if (outcome.kind === 'failed') { setError(outcome.message); return; }
    if (outcome.kind === 'saved') await invalidateAfterAnswer(qc, s.area, organiserId, userId);
    if (at + 1 >= qCount) afterQuestions();
    else move('question', 'forward', at + 1);
  };

  const answerRoles = async (answers: RoleAnswers) => {
    setRoleAnswers(answers);
    setSaving(true);
    setError(null);
    try {
      const writes = await saveRoleAnswers(asked, answers, roleWriters);
      if (writes > 0) {
        void qc.invalidateQueries({ queryKey: myRoleIntentQueryKey });
        void qc.invalidateQueries({ queryKey: myRolesQueryKey });
        if (seriesId) void qc.invalidateQueries({ queryKey: goLiveCheckQueryKey(seriesId) });
      }
      setSaving(false);
      move('done', 'forward', total);
    } catch {
      setSaving(false);
      setError(ROLE_SAVE_FAILED);
    }
  };

  const back = () => {
    if (phase === 'question' && at > 0) move('question', 'back', at - 1);
    else if (phase === 'question' && seriesId) move('bridge', 'back', 0);
    else if (phase === 'roles' && qCount > 0) move('question', 'back', qCount - 1);
    else if (phase === 'roles') move('bridge', 'back', 0);
    else if (phase === 'done' && asksRoles) move('roles', 'back', qCount);
    else if (phase === 'done' && qCount > 0) move('question', 'back', qCount - 1);
    else goHome();
  };

  const liveNow = async () => {
    if (!ws.data || !seriesId) return;
    setNotYet(null);
    await flow.run(async () => {
      const r = await flow.send(seriesId, ws.data!.series.version, lifecycleCommand('live'));
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      if (r) goDone(navigate, { title: ITS_LIVE_TITLE, message: itsLiveLine(ws.data!.series.name), seriesId, offer: offerRoles(intent.data ?? null, roleAnswers) });
    });
  };

  const failed = progress.isError || dancer.isError || (!!organiserId && (entity.isError || contact.isError));
  const loading = !failed && (!phase || !questions || !dancer.data || (!!organiserId && (!entity.data || !contact.data)));
  // A bounded wait: a read that never answers ends in "Try again", never in grey bars for good.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!loading) { setStuck(false); return undefined; }
    const t = setTimeout(() => setStuck(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);
  if (flow.conflict && seriesId) return <EventConflict seriesId={seriesId} />;

  // Why Go live is off, always said: the event is loading or failed, or the server is still being asked.
  const blockReason = ws.isError ? EVENT_FAILED_REASON : !ws.data ? EVENT_LOADING_REASON : view.reason;

  let body: ReactNode;
  if (failed) {
    body = <ErrorState title="Your profile did not load" onRetry={() => { void progress.refetch(); void dancer.refetch(); void entity.refetch(); void contact.refetch(); }} retrying={progress.isFetching} testId="golive-error" />;
  } else if (loading && stuck) {
    body = <ErrorState title="Your profile is taking too long" onRetry={() => { setStuck(false); void progress.refetch(); void dancer.refetch(); void entity.refetch(); void contact.refetch(); }} retrying={progress.isFetching || entity.isFetching} testId="golive-stuck" />;
  } else if (loading) {
    body = <SkeletonRows count={3} label="Loading your questions" testId="golive-loading" />;
  } else if (phase === 'bridge') {
    body = (
      <Slide id="bridge" dir={dir}>
        <Hero title={ALMOST_LIVE_TITLE} line={almostLiveLine(eventName ?? 'Your event', total)} />
        <Dots total={total} at={-1} />
        <div className="space-y-[8px]">
          <PrimaryButton testId="golive-continue" onClick={() => (qCount > 0 ? move('question', 'forward', 0) : afterQuestions())}>{CONTINUE_LABEL}</PrimaryButton>
          <GhostButton testId="golive-not-now" onClick={goHome}>{NOT_NOW_LABEL}</GhostButton>
        </div>
      </Slide>
    );
  } else if (phase === 'question' && current) {
    const entry = WIZARD_STEPS.get(stepKey(current))!;
    const Step = entry.Component;
    const sec = sectionOf(current);
    const { k, n: inSection } = stepInSection(questions!, at);
    const n = inSection + (asksRoles && sec === 'page' ? 1 : 0);
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
  } else if (phase === 'roles') {
    const pageQuestions = questions!.filter((q) => sectionOf(q) === 'page').length;
    body = (
      <Slide id="roles" dir={dir}>
        <Dots total={total} at={qCount} />
        <p className="flex items-center justify-between text-[13px] text-[var(--mut)]" data-testid="golive-section">
          <span className="font-semibold text-[var(--fg)]">{SECTION_LABEL.page}</span>
          <span>Step {pageQuestions + 1} of {pageQuestions + 1}</span>
        </p>
        <h2 className="text-[20px] font-bold leading-[26px] text-[var(--fg)]" data-testid="golive-question" tabIndex={-1}>{ROLE_QUESTION_TITLE}</h2>
        <RoleQuestion asked={asked} saving={saving} error={error} initial={roleAnswers} onContinue={(a) => void answerRoles(a)} />
      </Slide>
    );
  } else {
    body = (
      <Slide id="done" dir={dir}>
        <Hero title={seriesId ? view.title : ALL_SET_TITLE} line={seriesId ? view.line : allSetLine(null)} />
        {gaps.length > 0 && (
          <div data-testid="golive-gaps" className="space-y-[8px] rounded-[12px] border border-[var(--line)] p-[12px]">
            <h3 className="text-[15px] font-bold text-[var(--fg)]">{GAPS_TITLE}</h3>
            <ul className="space-y-[4px]">
              {gaps.map((g) => (
                <li key={g.key} data-testid="golive-gap" className="text-[14px] text-[var(--fg)]">
                  {g.href ? <Link to={g.href} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--gold)] underline underline-offset-4">{g.text}</Link> : g.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {notYet && <p role="alert" className="text-[14px] font-semibold text-[var(--warn-fg)]" data-testid="golive-not-yet-line">{notYet}</p>}
        {flow.error && gaps.length === 0 && !notYet && <p role="alert" className="text-[14px] text-[var(--warn-fg)]" data-testid="golive-live-error">{flow.error}</p>}
        <div className="space-y-[8px]">
          {seriesId ? (
            <>
              {blockReason && <p id="golive-live-reason" role="status" data-testid="golive-live-reason" className="text-[14px] text-[var(--mut)]">{blockReason}</p>}
              {view.canRetry && !ws.isError && <GhostButton testId="golive-check-retry" onClick={() => void check.refetch()}>{TRY_AGAIN_LABEL}</GhostButton>}
              {ws.isError && <GhostButton testId="golive-live-retry" onClick={() => void ws.refetch()}>{RETRY_LABEL}</GhostButton>}
              <PrimaryButton testId="golive-live" loading={flow.busy} loadingLabel="Going live" disabled={!!blockReason} aria-describedby={blockReason ? 'golive-live-reason' : undefined} onClick={() => void liveNow()}>{GO_LIVE_LABEL}</PrimaryButton>
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

export function GoLiveFlowScreen({ writers = REAL_WRITERS, uploadLogo = uploadOrganiserPhoto, roleWriters = REAL_ROLE_QUESTION_WRITERS }: GoLiveFlowProps) {
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
  return <Body key={`${selected?.id ?? 'none'}:${params.get('series') ?? ''}`} organiserId={selected?.id ?? null} userId={user.id} seriesId={params.get('series')} writers={writers} uploadLogo={uploadLogo} roleWriters={roleWriters} />;
}

export default function GoLiveFlow() {
  return <GoLiveFlowScreen />;
}
