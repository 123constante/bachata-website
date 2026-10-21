import { useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLondonToday } from '@/hooks/useLondonToday';
import {
  ORGANISER_HOME_KEY, fetchOccurrenceProgramme, fetchSeriesWorkspace, occurrenceProgrammeQueryKey, runSeriesCommand,
  saveOccurrenceProgramme, seriesWorkspaceQueryKey,
} from '@/modules/organiser/shared/selfServeApi';
import { createBlock } from '@/modules/organiser/shared/createModel';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { envelope, newIdempotencyKey, newSeriesId } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage, isAccessRefusal, isVersionConflict } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { useVenueOptions, type VenueOption } from '@/modules/organiser/shared/publicVenues';
import { EVENT_RULES } from '@/modules/organiser/shared/eventRules';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { uploadEventPicture } from '@/modules/organiser/events/media';
import { searchPickerRows } from '@/modules/organiser/dates/peoplePicker';
import { useOrganiserChoice } from '@/modules/organiser/profile/useOrganiserChoice';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { ORG_PATHS, type NewEventFormat } from '@/modules/organiser/shell/paths';
import { VenuePicker } from '@/modules/organiser/venue';
import { SessionSheet } from '@/modules/organiser/sessions/SessionSheet';
import {
  kindLabel, listIssues, newSession, sortSessions, type SessionDraft, type SessionPerson,
} from '@/modules/organiser/sessions/sessionsModel';
import {
  EmptyState, ErrorState, Field, FIELD_CLASS, GhostButton, PrimaryButton, SkeletonRows, SummaryRow, TitleInput, useOpenerRef,
} from '@/modules/organiser/ui';
import { goDone } from '../doneState';
import {
  DEFAULT_FIRST_KIND, DEFAULT_FIRST_START, DRAFT_SAVED_MESSAGE, FORMAT_WORDS, NEW_FORMATS, STEP_TITLE, coverCommands, dateCommands, draftCommand, emptyFinish,
  finishCommands, firstDateChoices, liveCommands, liveMessage, nameBlock, parseFormat, paymentChoices, publishBlock, publishReasons, replaceProgramme,
  ruleSessionsOf, ticketLinkProblem, togglePayment, venueCommands, type FinishForm,
} from './model';
import { fetchGoLiveCheck, goLiveCheckKey } from './goLiveCheck';
import { useNewSend } from './useNewSend';
import { EventConflict } from '../event/parts';

const ROW = 'flex min-h-[56px] w-full items-center rounded-[12px] bg-[var(--card2)] px-[16px] text-left text-[16px] font-semibold text-[var(--fg)]';
const ROW_OFF = ROW + ' opacity-60';
const QUIET = 'min-h-[44px] w-full text-center text-[14px] text-[var(--mut)] underline';

/** After the name step the draft exists: every step offers to leave it as a draft. */
function LeaveLink({ label = 'Save as draft and leave' }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className={QUIET} data-testid="org-new-leave" onClick={() => navigate(ORG_PATHS.home, { replace: true })}>
      {label}
    </button>
  );
}

function StepError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-new-error">{message}</p>;
}

/** A button that cannot work is off AND says why, right beside it. */
function StepButton({ label, reason, busy, onClick, testId }: { label: string; reason: string | null; busy: boolean; onClick: () => void; testId: string }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <PrimaryButton testId={testId} loading={busy} loadingLabel="Saving" disabled={!!reason} onClick={onClick}>{label}</PrimaryButton>
      {reason && <p className="text-[14px] text-[var(--mut)]" data-testid={testId + '-reason'}>{reason}</p>}
    </div>
  );
}

function Frame({ title, back, children, wide }: { title: string; back: string; children: ReactNode; wide?: boolean }) {
  return (
    <OrganiserShell title={title} back={{ to: back, label: 'Back' }} testId="org-new-step">
      <div className={'flex flex-col gap-[12px] p-[12px]' + (wide ? ' lg:max-w-[960px]' : '')}>{children}</div>
    </OrganiserShell>
  );
}

function NewConflict({ seriesId }: { seriesId: string }) {
  return (
    <OrganiserShell title="New event" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-conflict">
      <div className="p-[12px]"><EventConflict seriesId={seriesId} /></div>
    </OrganiserShell>
  );
}

const withOrganiser = (path: string, organiserId: string | null) =>
  organiserId ? `${path}${path.includes('?') ? '&' : '?'}o=${encodeURIComponent(organiserId)}` : path;

function useDraft(seriesId: string) {
  return useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId) });
}

// ---- what ---------------------------------------------------------------------------

function WhatStep() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (
    <OrganiserShell title={STEP_TITLE.what} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-what">
      <div className="flex flex-col gap-[12px] p-[12px]">
        {NEW_FORMATS.map((f) => {
          const format = parseFormat(f.format);
          return (
            <div key={f.format} className="flex flex-col gap-[4px]">
              <button
                type="button"
                className={f.off ? ROW_OFF : ROW}
                disabled={!format}
                data-testid={'org-new-format-' + f.format}
                onClick={() => format && navigate(withOrganiser(ORG_PATHS.newName(format), params.get('o')))}
              >
                {f.label}
              </button>
              {f.off && <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid={'org-new-format-' + f.format + '-reason'}>{f.off}</p>}
            </div>
          );
        })}
        <LeaveLink label="Leave" />
      </div>
    </OrganiserShell>
  );
}

// ---- name: creates the server draft -----------------------------------------------------

function NameStep({ format }: { format: NewEventFormat }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { home, selected } = useOrganiserChoice();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The draft id is chosen once per screen; the key follows name + format (a retry replays, an edit does not ride the old key).
  const draft = useRef({ seriesId: newSeriesId(), sig: '', key: '' });
  const block = selected ? createBlock(selected) : null;

  const next = async () => {
    if (busy || !selected || block || nameBlock(name)) return;
    setBusy(true);
    setError(null);
    try {
      const sig = JSON.stringify([name, format]);
      if (draft.current.sig !== sig) draft.current = { ...draft.current, sig, key: newIdempotencyKey() };
      await runSeriesCommand(envelope(draft.current.seriesId, null, draftCommand(name, format, selected.id), draft.current.key));
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      navigate(ORG_PATHS.newVenue(draft.current.seriesId), { replace: true });
    } catch (err) {
      setError(commandErrorMessage(err));
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (home.isPending) body = <SkeletonRows count={2} label="Loading" />;
  else if (!home.data) body = <ErrorState onRetry={() => void home.refetch()} retrying={home.isFetching} />;
  else if (!selected) body = <EmptyState title="Set up your page first" body="An event belongs to a page. Create or claim yours from Home." action={<GhostButton onClick={() => navigate(ORG_PATHS.home)}>Back to Home</GhostButton>} testId="org-new-no-page" />;
  else if (block) body = <EmptyState title="You cannot start an event yet" body={block} action={<GhostButton onClick={() => navigate(ORG_PATHS.home)}>Back to Home</GhostButton>} testId="org-new-blocked" />;
  else {
    body = (
      <>
        <TitleInput value={name} onChange={(v) => { setName(v); setError(null); }} aria-label="Event name" placeholder="Event name" maxLength={120} disabled={busy} testId="org-new-name" />
        <StepError message={error} />
        <StepButton label="Next" reason={nameBlock(name)} busy={busy} onClick={() => void next()} testId="org-new-next" />
        <LeaveLink label="Leave" />
      </>
    );
  }
  return (
    <OrganiserShell title={STEP_TITLE.name} back={{ to: withOrganiser(ORG_PATHS.newWhat, params.get('o')), label: 'Back' }} testId="org-new-name-step">
      <div className="flex flex-col gap-[12px] p-[12px]">{body}</div>
    </OrganiserShell>
  );
}

// ---- venue (the C5 picker) ----------------------------------------------------------------

function VenueStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const { selected } = useOrganiserChoice();
  const { send, busy, error, conflict } = useNewSend(seriesId);

  const pick = async (venue: VenueOption) => {
    if (busy) return;
    let cityId: string | null;
    try {
      cityId = await resolveCreateCityId({ venueCityName: venue.city_name ?? null, organiserCityId: selected?.city_id ?? null });
    } catch {
      cityId = selected?.city_id ?? null;
    }
    if (await send(venueCommands(venue.id, cityId))) navigate(ORG_PATHS.newDate(seriesId));
  };

  if (conflict) return <NewConflict seriesId={seriesId} />;
  return (
    <OrganiserShell title={STEP_TITLE.venue} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-venue">
      <div className="flex flex-col gap-[12px] p-[12px]">
        <StepError message={error} />
        <VenuePicker onPick={(v) => void pick(v)} />
        <LeaveLink />
      </div>
    </OrganiserShell>
  );
}

// ---- first date ---------------------------------------------------------------------------

function DateStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const today = useLondonToday();
  const draft = useDraft(seriesId);
  const { send, busy, error, conflict } = useNewSend(seriesId);
  const back = ORG_PATHS.newVenue(seriesId);
  if (draft.isPending) return <Frame title={STEP_TITLE.date} back={back}><SkeletonRows count={4} label="Loading" /></Frame>;
  if (!draft.data && isAccessRefusal(draft.error)) return <Frame title={STEP_TITLE.date} back={back}><NoAccess /></Frame>;
  if (!draft.data) return <Frame title={STEP_TITLE.date} back={back}><ErrorState onRetry={() => void draft.refetch()} retrying={draft.isFetching} /></Frame>;
  const format: NewEventFormat = draft.data.series.format === 'one_off' ? 'one_off' : 'recurring';
  const pick = async (date: string) => {
    if (await send(dateCommands(format, date))) navigate(ORG_PATHS.newTime(seriesId));
  };
  if (conflict) return <NewConflict seriesId={seriesId} />;
  return (
    <Frame title={STEP_TITLE.date} back={back}>
      <StepError message={error} />
      <div className="flex flex-col gap-[8px]" data-testid="org-new-date-list">
        {firstDateChoices(today).map((d) => (
          <button key={d.date} type="button" className={ROW} disabled={busy} data-testid="org-new-date-row" onClick={() => void pick(d.date)}>{d.label}</button>
        ))}
      </div>
      <LeaveLink />
    </Frame>
  );
}

// ---- first session(s): the C4 card; the start time lives here, there is no time step -------------

const searchPeople = async (term: string, role: 'teaching' | 'djing'): Promise<SessionPerson[]> =>
  (await searchPickerRows(term, role)).map((r) => ({ id: r.id, name: r.name }));

const sessionSummary = (s: SessionDraft) => `${s.name.trim() || kindLabel(s.kind)}, ${s.start} to ${s.end}`;

function SessionStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useDraft(seriesId);
  const firstDate = draft.data?.series.default_start_date ?? null;
  const occurrence = draft.data?.dates.find((d) => d.occurrence_date === firstDate) ?? draft.data?.dates[0] ?? null;
  const [sessions, setSessions] = useState<SessionDraft[]>(() => [newSession(DEFAULT_FIRST_KIND, DEFAULT_FIRST_START)]);
  const [recent, setRecent] = useState<SessionPerson[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const opener = useOpenerRef(open);
  const back = ORG_PATHS.newDate(seriesId);

  if (draft.isPending) return <Frame title={STEP_TITLE.session} back={back}><SkeletonRows count={3} label="Loading" /></Frame>;
  if (!draft.data && isAccessRefusal(draft.error)) return <Frame title={STEP_TITLE.session} back={back}><NoAccess /></Frame>;
  if (!draft.data) return <Frame title={STEP_TITLE.session} back={back}><ErrorState onRetry={() => void draft.refetch()} retrying={draft.isFetching} /></Frame>;
  if (conflict) return <NewConflict seriesId={seriesId} />;

  const issue = listIssues(sessions)[0]?.reason ?? null;
  const reason = !occurrence ? 'Pick the date first' : issue;

  const save = async () => {
    if (busy || reason || !occurrence) return;
    setBusy(true);
    setError(null);
    try {
      const current = await fetchOccurrenceProgramme(occurrence.id);
      await saveOccurrenceProgramme(occurrence.id, current.version, replaceProgramme(current.sessions, sortSessions(sessions)));
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: occurrenceProgrammeQueryKey(occurrence.id) });
      navigate(ORG_PATHS.newCover(seriesId));
    } catch (err) {
      if (isVersionConflict(err)) setConflict(true);
      else setError(commandErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Frame title={STEP_TITLE.session} back={back}>
      <div className="flex flex-col gap-[8px]" data-testid="org-new-sessions">
        {sortSessions(sessions).map((s, i) => (
          <SummaryRow key={s.id} label={`Session ${i + 1}`} value={sessionSummary(s)} affordance="pencil" onPress={() => setOpen(true)} testId="org-new-session-row" />
        ))}
      </div>
      <GhostButton onClick={() => setOpen(true)} testId="org-new-sessions-edit">Edit sessions</GhostButton>
      {open && (
        <SessionSheet
          open
          onOpenChange={setOpen}
          sessions={sessions}
          onSave={setSessions}
          search={searchPeople}
          recent={recent}
          onRecentChange={setRecent}
          returnFocusRef={opener}
        />
      )}
      <StepError message={error} />
      <StepButton label="Next" reason={reason} busy={busy} onClick={() => void save()} testId="org-new-next" />
      <LeaveLink />
    </Frame>
  );
}

// ---- how dancers will see it ----------------------------------------------------------------

function Preview({ name, format, date, venue, sessions, flyer, payment }: {
  name: string; format: string | null; date: string | null; venue: string | null; sessions: string[]; flyer: string | null; payment: string[];
}) {
  return (
    <section aria-label="How dancers will see it" className="flex flex-col gap-[8px] rounded-[16px] bg-[var(--card)] p-[12px]" data-testid="org-new-preview">
      <h2 className="text-[14px] font-semibold text-[var(--mut)]">How dancers will see it</h2>
      {flyer && <img src={flyer} alt="" className="max-h-[200px] w-full rounded-[12px] object-cover" data-testid="org-new-preview-flyer" />}
      <p className="text-[18px] font-bold text-[var(--fg)]" data-testid="org-new-preview-name">{name || 'Your event'}</p>
      <p className="text-[14px] text-[var(--mut)]">{[format ? FORMAT_WORDS[format] ?? null : null, date ? dayLabel(date) : null, venue].filter(Boolean).join(' - ')}</p>
      {sessions.map((s) => <p key={s} className="text-[14px] text-[var(--fg)]">{s}</p>)}
      {payment.length > 0 && <p className="text-[14px] text-[var(--mut)]" data-testid="org-new-preview-pay">{payment.join(', ')}</p>}
    </section>
  );
}

// ---- last step: flyer, how to pay, optional details, then Publish ----------------------------------

function FinishStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = useLondonToday();
  const venues = useVenueOptions();
  const draft = useDraft(seriesId);
  const { send, busy, error, setError, conflict } = useNewSend(seriesId);
  const [form, setForm] = useState<FinishForm | null>(null);
  const [touched, setTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[] | null>(null);
  const back = ORG_PATHS.newTime(seriesId);

  const series = draft.data?.series ?? null;
  const firstDate = series?.default_start_date ?? null;
  const occurrence = draft.data?.dates.find((d) => d.occurrence_date === firstDate) ?? draft.data?.dates[0] ?? null;
  const programme = useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrence?.id),
    queryFn: () => fetchOccurrenceProgramme(occurrence!.id),
    enabled: !!occurrence,
  });
  const check = useQuery({ queryKey: goLiveCheckKey(seriesId), queryFn: () => fetchGoLiveCheck(seriesId), enabled: !!series, retry: false });

  if (draft.isPending) return <Frame title={STEP_TITLE.finish} back={back}><SkeletonRows count={4} label="Loading" /></Frame>;
  if (!series && isAccessRefusal(draft.error)) return <Frame title={STEP_TITLE.finish} back={back}><NoAccess /></Frame>;
  if (!series) return <Frame title={STEP_TITLE.finish} back={back}><ErrorState onRetry={() => void draft.refetch()} retrying={draft.isFetching} /></Frame>;
  if (conflict) return <NewConflict seriesId={seriesId} />;

  const f: FinishForm = form ?? { ...emptyFinish(), ticketUrl: series.default_ticket_url ?? '', description: series.default_description ?? '' };
  const change = (next: FinishForm) => { setForm(next); setTouched(true); setBlockedBy(null); setError(null); };
  const flyer = series.default_cover_image_url;
  const ruleSessions = ruleSessionsOf(programme.data?.sessions ?? []);
  const input = {
    series: {
      name: series.name, format: series.format, venueId: series.default_venue_id, payment: f.payment,
      firstDate: firstDate ? { date: firstDate, sessions: ruleSessions } : null, today,
    },
    hasFlyer: !!flyer,
    form: f,
    server: check.data ?? null,
  };
  const reasons = blockedBy ?? publishReasons(input);
  const block = blockedBy ? blockedBy[0] ?? null : publishBlock(input);
  const venueName = (venues.data ?? []).find((v) => v.id === series.default_venue_id)?.name ?? null;
  const labels = EVENT_RULES.payment.codes as Record<string, string>;

  const chooseFlyer = async (file: File | undefined) => {
    if (!file || busy || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadEventPicture(seriesId, file);
      await send(coverCommands(url));
      void queryClient.invalidateQueries({ queryKey: goLiveCheckKey(seriesId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : commandErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // Publish = live at once (rule 6). The saved draft is checked by the SERVER first; its answer wins over a green screen.
  const publish = async () => {
    if (block || busy) return;
    if (!(await send(finishCommands(f, touched)))) return;
    let server;
    try {
      server = await queryClient.fetchQuery({ queryKey: goLiveCheckKey(seriesId), queryFn: () => fetchGoLiveCheck(seriesId), staleTime: 0 });
    } catch (err) {
      setError(commandErrorMessage(err));
      return;
    }
    const after = publishReasons({ ...input, server });
    if (after.length > 0) { setBlockedBy(after); return; }
    if (!(await send(liveCommands()))) return;
    goDone(navigate, { title: 'New event', message: liveMessage(firstDate), seriesId });
  };

  // Quieter: keep it a draft. An untouched draft sends nothing.
  const saveDraft = async () => {
    if (busy) return;
    if (!(await send(finishCommands(f, touched)))) return;
    goDone(navigate, { title: 'Saved', message: DRAFT_SAVED_MESSAGE, seriesId });
  };

  return (
    <Frame title={STEP_TITLE.finish} back={back} wide>
      <div className="grid gap-[12px] lg:grid-cols-2" data-testid="org-new-finish">
        <div className="flex flex-col gap-[12px]">
          {flyer && <img src={flyer} alt="Your flyer" loading="eager" className="max-h-[240px] w-full rounded-[12px] object-cover" data-testid="org-new-cover-preview" />}
          <label className={ROW + ' cursor-pointer justify-center'} data-testid="org-new-cover-label">
            {uploading ? 'Uploading' : flyer ? 'Choose a different flyer' : 'Choose a flyer'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy || uploading} data-testid="org-new-cover-input" onChange={(e) => void chooseFlyer(e.target.files?.[0])} />
          </label>

          <fieldset className="flex flex-col gap-[8px]" data-testid="org-new-pay">
            <legend className="mb-[4px] text-[13px] font-semibold text-[var(--mut)]">How to pay</legend>
            {paymentChoices(series.format).map((code) => {
              const on = f.payment.includes(code);
              return (
                <button key={code} type="button" role="checkbox" aria-checked={on} className={ROW + (on ? ' ring-2 ring-[var(--gold)]' : '')} data-testid={'org-new-pay-' + code} onClick={() => change(togglePayment(f, code))}>
                  {labels[code] ?? code}
                </button>
              );
            })}
          </fieldset>

          {f.payment.includes('ticket_link') && (
            <Field label="Ticket link" htmlFor="org-new-ticket" error={f.ticketUrl.trim() ? ticketLinkProblem(f) : null}>
              <input id="org-new-ticket" className={FIELD_CLASS + ' h-[48px]'} inputMode="url" autoComplete="off" value={f.ticketUrl} onChange={(e) => change({ ...f, ticketUrl: e.target.value })} data-testid="org-new-ticket" />
            </Field>
          )}

          <Field label="Description (optional)" htmlFor="org-new-description">
            <textarea id="org-new-description" rows={4} maxLength={2000} className={FIELD_CLASS + ' py-[12px]'} value={f.description} onChange={(e) => change({ ...f, description: e.target.value })} data-testid="org-new-description" />
          </Field>
        </div>

        <div className="flex flex-col gap-[12px]">
          <Preview
            name={series.name} format={series.format} date={firstDate} venue={venueName}
            sessions={ruleSessions.map((s) => `${s.start ?? ''} - ${s.end ?? ''}`)} flyer={flyer}
            payment={f.payment.map((c) => labels[c] ?? c)}
          />
          <StepError message={error} />
          <StepButton label="Publish" reason={block} busy={busy && !uploading} onClick={() => void publish()} testId="org-new-live" />
          {reasons.length > 1 && <p className="text-[13px] text-[var(--mut)]" data-testid="org-new-more-reasons">{reasons.slice(1).join(' - ')}</p>}
          <GhostButton onClick={() => void saveDraft()} disabled={busy} testId="org-new-save-draft">Save as draft</GhostButton>
        </div>
      </div>
    </Frame>
  );
}

// ---- the route target -------------------------------------------------------------------------

/** One lazy chunk for every New event route; the URL names the step (`time` = first session, `cover` = last step). */
export default function NewFlow() {
  const { pathname } = useLocation();
  const { seriesId } = useParams();
  const [params] = useSearchParams();
  const step = pathname.replace(/\/+$/, '').split('/').pop();
  if (step === 'what') return <WhatStep />;
  if (step === 'name') {
    const format = parseFormat(params.get('format'));
    return format ? <NameStep format={format} /> : <Navigate to={ORG_PATHS.newWhat} replace />;
  }
  if (!seriesId) return <Navigate to={ORG_PATHS.newWhat} replace />;
  if (step === 'venue') return <VenueStep seriesId={seriesId} />;
  if (step === 'date') return <DateStep seriesId={seriesId} />;
  if (step === 'time') return <SessionStep seriesId={seriesId} />;
  if (step === 'cover') return <FinishStep seriesId={seriesId} />;
  return <Navigate to={ORG_PATHS.newWhat} replace />;
}
