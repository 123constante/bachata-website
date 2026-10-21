import { useId, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLondonToday } from '@/hooks/useLondonToday';
import { ORGANISER_HOME_KEY, fetchSeriesWorkspace, runSeriesCommand, seriesWorkspaceQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { createBlock } from '@/modules/organiser/shared/createModel';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { envelope, newIdempotencyKey, newSeriesId } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage, isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { useVenueOptions, type VenueOption } from '@/modules/organiser/shared/publicVenues';
import { uploadEventPicture } from '@/modules/organiser/events/media';
import { useOrganiserChoice } from '@/modules/organiser/profile/useOrganiserChoice';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { ORG_PATHS, type NewEventFormat } from '@/modules/organiser/shell/paths';
import { EmptyState, ErrorState, GhostButton, PrimaryButton, SearchField, SkeletonRows, TitleInput } from '@/modules/organiser/ui';
import { goDone } from '../doneState';
import {
  DRAFT_ONLY_NOTE, DRAFT_SAVED_MESSAGE, NEW_FORMATS, NO_SESSION_NEW_REASON, STEP_TITLE, coverCommands, finishReason, offerLeave, dateCommands, draftCommand, finishLabel, firstDateChoices, liveCommands, liveMessage,
  nameBlock, parseFormat, timeBlock, timeCommands, venueCommands,
} from './model';
import { useNewSend } from './useNewSend';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import { EventConflict } from '../event/parts';
import { needsPagePick, withPageChoice } from './whichPage';
import { WhichPageStep } from './WhichPage';
import { goLivePath } from '@/modules/organiser/home/onboarding/golive/goLiveModel';
import { profileQuestionsLeft } from '@/modules/organiser/home/onboarding/golive/profileLeft';

const TITLE = 'New event';
const ROW = 'flex min-h-[56px] w-full items-center rounded-[12px] bg-[var(--card2)] px-[16px] text-left text-[16px] font-semibold text-[var(--fg)]';
const QUIET = 'min-h-[44px] w-full text-center text-[14px] text-[var(--mut)] underline';
const MAX_VENUE_ROWS = 50;

/** After the name step the draft exists: every step offers to leave it as a draft. */
function LeaveLink({ label = 'Save as draft and leave', to = ORG_PATHS.home }: { label?: string; to?: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" className={QUIET} data-testid="org-new-leave" onClick={() => navigate(to, { replace: true })}>
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
  const reasonId = useId();
  return (
    <div className="flex flex-col gap-[8px]">
      <PrimaryButton testId={testId} loading={busy} loadingLabel="Saving" disabled={!!reason} aria-describedby={reason ? reasonId : undefined} onClick={onClick}>
        {label}
      </PrimaryButton>
      {reason && <p id={reasonId} className="text-[14px] text-[var(--mut)]" data-testid={testId + '-reason'}>{reason}</p>}
    </div>
  );
}

function Frame({ title, back, children }: { title: string; back: string; children: ReactNode }) {
  return (
    <OrganiserShell title={title} back={{ to: back, label: 'Back' }} testId="org-new-step">
      <div className="flex flex-col gap-[12px] p-[12px]">{children}</div>
    </OrganiserShell>
  );
}

/** R3-7: another device changed the draft first; ONE button, to the event. */
function NewConflict({ seriesId }: { seriesId: string }) {
  return (
    <OrganiserShell title="New event" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-conflict">
      <div className="p-[12px]"><EventConflict seriesId={seriesId} /></div>
    </OrganiserShell>
  );
}

// ---- C19 what --------------------------------------------------------------------

// Page and Events open New event with `?o=<organiserId>`; the steps before the draft keep it
// (withPageChoice), and with 2 or more pages the page question comes first (Arc 1 flow 7b).

function WhatStep() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { home, organisers, selected } = useOrganiserChoice();
  // Never flash the format rows at a login that is about to be asked which page.
  if (home.isPending && !home.isPaused) {
    return (
      <OrganiserShell title={STEP_TITLE.what} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-what">
        <div className="p-[12px]"><SkeletonRows count={2} label="Loading" /></div>
      </OrganiserShell>
    );
  }
  if (needsPagePick(organisers.length, params)) return <WhichPageStep organisers={organisers} selectedId={selected?.id ?? null} />;
  return (
    <OrganiserShell title={STEP_TITLE.what} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-what">
      <div className="flex flex-col gap-[12px] p-[12px]">
        {NEW_FORMATS.map((f) => (
          <button key={f.format} type="button" className={ROW} data-testid={'org-new-format-' + f.format} onClick={() => navigate(withPageChoice(ORG_PATHS.newName(f.format), params))}>
            {f.label}
          </button>
        ))}
        <LeaveLink label="Leave" />
      </div>
    </OrganiserShell>
  );
}

// ---- C20 name: creates the server draft ------------------------------------------

function NameStep({ format }: { format: NewEventFormat }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { home, selected } = useOrganiserChoice();
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The draft id is chosen once per screen. The key is per name + format (A-N3, as Cover keys by URL):
  // the server replays a stored answer for (actor, key) without comparing the payload, so a retry of
  // the SAME name replays, and an edited name must not ride the old one's key (it would come back as
  // the old name). The id stays, so a create that did land cannot be doubled by the new key.
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
      // replace: Back must not return here and create a second draft.
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
    <OrganiserShell title={STEP_TITLE.name} back={{ to: withPageChoice(ORG_PATHS.newWhat, params), label: 'Back' }} testId="org-new-name-step">
      <div className="flex flex-col gap-[12px] p-[12px]">{body}</div>
    </OrganiserShell>
  );
}

// ---- C21 venue --------------------------------------------------------------------

function VenueStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const { selected } = useOrganiserChoice();
  const venues = useVenueOptions();
  const { send, busy, error, setError, conflict } = useNewSend(seriesId);
  const [term, setTerm] = useState('');
  const needle = term.trim().toLowerCase();
  const shown = (venues.data ?? []).filter((v) => !needle || v.name.toLowerCase().includes(needle)).slice(0, MAX_VENUE_ROWS);

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

  let body: ReactNode;
  if (venues.isPending) body = <SkeletonRows count={4} label="Loading venues" />;
  else if (venues.isError) body = <ErrorState onRetry={() => void venues.refetch()} retrying={venues.isFetching} />;
  else if (shown.length === 0) body = <EmptyState title="No venue matches" body="Try another word from its name." testId="org-new-venue-empty" />;
  else {
    body = (
      <div className="flex flex-col gap-[8px]" data-testid="org-new-venue-list">
        {shown.map((v) => (
          <button key={v.id} type="button" className={ROW} disabled={busy} data-testid="org-new-venue-row" onClick={() => void pick(v)}>
            <span className="flex flex-col"><span>{v.name}</span>{v.neighbourhood && <span className="text-[13px] font-normal text-[var(--mut)]">{v.neighbourhood}</span>}</span>
          </button>
        ))}
      </div>
    );
  }
  if (conflict) return <NewConflict seriesId={seriesId} />;
  return (
    <OrganiserShell title={STEP_TITLE.venue} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-venue">
      <div className="flex flex-col gap-[12px] p-[12px]">
        <SearchField value={term} onChange={(v) => { setTerm(v); setError(null); }} aria-label="Search venues" placeholder="Search venues" testId="org-new-venue-search" />
        <StepError message={error} />
        {body}
        <LeaveLink />
      </div>
    </OrganiserShell>
  );
}

// ---- the draft being built --------------------------------------------------------

function useDraft(seriesId: string) {
  return useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId) });
}

// ---- C22 first date ---------------------------------------------------------------

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

// ---- C22b time --------------------------------------------------------------------

function TimeStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const { send, busy, error, setError, conflict } = useNewSend(seriesId);
  const [time, setTime] = useState('');
  const go = async () => {
    if (!timeBlock(time) && (await send(timeCommands(time)))) navigate(ORG_PATHS.newCover(seriesId));
  };
  if (conflict) return <NewConflict seriesId={seriesId} />;
  return (
    <Frame title={STEP_TITLE.time} back={ORG_PATHS.newDate(seriesId)}>
      <input
        type="time"
        value={time}
        onChange={(e) => { setTime(e.target.value); setError(null); }}
        aria-label="Start time"
        disabled={busy}
        data-testid="org-new-time"
        className="h-[52px] w-full rounded-[12px] bg-[var(--card2)] px-[16px] text-[18px] text-[var(--fg)]"
      />
      <StepError message={error} />
      <StepButton label="Next" reason={timeBlock(time)} busy={busy} onClick={() => void go()} testId="org-new-next" />
      <LeaveLink />
    </Frame>
  );
}

// ---- C23 cover, then C24 Live -----------------------------------------------------

function CoverStep({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  const { selected } = useOrganiserChoice();
  const draft = useDraft(seriesId);
  const today = useLondonToday();
  const { send, busy, error, setError, conflict } = useNewSend(seriesId);
  const [picked, setPicked] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cover = picked ?? draft.data?.series.default_cover_image_url ?? null;

  const choose = async (file: File | undefined) => {
    if (!file || busy || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadEventPicture(seriesId, file);
      if (await send(coverCommands(url))) setPicked(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : commandErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const goLive = async () => {
    if (finishReason(!!cover, draft.data ?? null, today)) return;
    // A1 not on prod: going live would be refused, so the draft stays a draft and Done says so.
    if (!liveCommands().length) {
      goDone(navigate, { title: 'Saved', message: DRAFT_SAVED_MESSAGE, seriesId });
      return;
    }
    // Profile answers still open: the "Almost live" bridge, not a refusal. A failed read falls through and the server decides.
    if (await profileQuestionsLeft(seriesId)) {
      navigate(goLivePath(seriesId, selected?.id ?? null));
      return;
    }
    if (!(await send(liveCommands()))) return;
    let message = liveMessage(null, null);
    try {
      const after = await fetchSeriesWorkspace(seriesId);
      message = liveMessage(after.series.default_start_date, after.series.default_local_start_time);
    } catch {
      // The event is live; the confirmation just loses its date.
    }
    goDone(navigate, { title: TITLE, message, seriesId });
  };

  if (conflict) return <NewConflict seriesId={seriesId} />;
  return (
    <Frame title={STEP_TITLE.cover} back={ORG_PATHS.newTime(seriesId)}>
      {cover && <img src={cover} alt="Your photo" loading="eager" className="max-h-[240px] w-full rounded-[12px] object-cover" data-testid="org-new-cover-preview" />}
      <label className={ROW + ' cursor-pointer justify-center'} data-testid="org-new-cover-label">
        {uploading ? 'Uploading' : cover ? 'Choose a different photo' : 'Choose a photo'}
        <input type="file" accept="image/*" className="sr-only" disabled={busy || uploading} data-testid="org-new-cover-input" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>
      <StepError message={error} />
      {!A1_APPLIED && <p className="text-[14px] text-[var(--mut)]" data-testid="org-new-draft-note">{DRAFT_ONLY_NOTE}</p>}
      <StepButton label={finishLabel()} reason={finishReason(!!cover, draft.data ?? null, today)} busy={busy && !uploading} onClick={() => void goLive()} testId="org-new-live" />
      {/* The session is the only thing missing: leave where it is added. */}
      {offerLeave(!!cover) && <LeaveLink to={finishReason(!!cover, draft.data ?? null, today) === NO_SESSION_NEW_REASON ? ORG_PATHS.eventProgramme(seriesId) : ORG_PATHS.home} />}
    </Frame>
  );
}

// ---- the route target -------------------------------------------------------------

/** One lazy chunk for every New event route; the URL names the step. */
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
  if (step === 'time') return <TimeStep seriesId={seriesId} />;
  if (step === 'cover') return <CoverStep seriesId={seriesId} />;
  return <Navigate to={ORG_PATHS.newWhat} replace />;
}
