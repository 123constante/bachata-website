import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, type BlockerFunction } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_RULES, paymentCodes, type PaymentCode } from '@/modules/organiser/shared/eventRules';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';
import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import { lifecycleCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { lifecycleTag } from '@/modules/organiser/shared/eventState';
import { useGoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
import { useLeaveBlocker } from '@/modules/organiser/shared/useLeaveBlocker';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { FLYER_LABEL } from '@/modules/organiser/shared/flyerLabel';
import { goDone } from '@/modules/organiser/flows/doneState';
import { useFlowSend } from '@/modules/organiser/flows/add/useFlow';
import { EventConflict } from '@/modules/organiser/flows/event';
import { VenuePicker } from '@/modules/organiser/venue';
import { SessionSheet } from '@/modules/organiser/sessions/SessionSheet';
import { MAX_SESSIONS, kindLabel, type SessionPerson } from '@/modules/organiser/sessions/sessionsModel';
import { searchPickerRows } from '../dates/peoplePicker';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Card, Chip, GhostButton, PrimaryButton, SheetView, useOpenerRef } from '../ui';
import { ClosedLines } from './ClosedLines';
import { EditorSheet, type SheetName } from './EditorSheet';
import { EventList } from './EventList';
import {
  MUSIC_STYLES, capInput, changedFields, draftFromWorkspace, endRunCommand, tonightDate, wsComing, type EventDraft, type EventWorkspace,
  type TodaySession,
} from './eventModel';
import {
  END_LINE, ENDED_LINE, LEAVE_LINE, LEAVE_TITLE, PAUSE_LINE, PAY_NUDGE, PAY_NUDGE_SUB, STOP_REASON, UPDATE_FAILED, UPDATE_RETRY, canAddDate, draftChecklist,
  isClosed, lastNightChoices, pageActions, pageCommands, paymentOf, payNudge, pendingParts, publishBlocker, scopeLine, sessionsOf, stopAfterCommand,
  updateLabel, shouldPromptLeave, DELETE_DRAFT, endLabel, endOffReason, rebaseDraft, ticketGap, type PageDraft,
} from './eventPageModel';
import { uploadEventPicture } from './media';
import { countLabel } from './seriesExtras';
import { lifecycleRows } from './lifecycleModel';
import { parseTree } from './programmeSeriesModel';

const ARCHIVED_LINE = 'Archived events cannot be changed.';
const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left text-[15px]';
const LABEL = 'px-[4px] pt-[8px] text-[13px] font-semibold uppercase tracking-wide text-[var(--mut)]';
const TAG = 'inline-flex shrink-0 items-center rounded-full bg-[var(--card2)] px-[10px] py-[2px] text-[12px] font-semibold text-[var(--mut)]';
/** EP-9: the shared lifecycle tag's tone (eventState.lifecycleTag), drawn without the R1-banned StatusTag (D22). */
const TAG_TONE: Record<string, string> = { live: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]', draft: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]' };
const LINK = 'font-semibold text-[var(--gold)]';
const QUIET = 'flex h-[44px] items-center px-[12px] text-[15px] font-semibold';
const PAY_LABEL = EVENT_RULES.payment.codes as Record<string, string>;
const SECTIONS: { id: string; label: string }[] = [
  { id: 'sessions', label: 'Sessions' }, { id: 'dates', label: 'Dates' }, { id: 'flyer', label: 'Flyer' }, { id: 'details', label: 'Details' }, { id: 'about', label: 'About' },
];

const search = async (term: string, role: 'teaching' | 'djing'): Promise<SessionPerson[]> =>
  (await searchPickerRows(term, role)).map((r) => ({ id: r.id, name: r.name }));

const payText = (codes: readonly string[]) => codes.map((c) => PAY_LABEL[c] ?? c).join(', ');

function Go({ label, sub, onClick, to, testId, accent }: { label: string; sub?: string; onClick?: () => void; to?: string; testId: string; accent?: boolean }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', accent ? LINK : 'text-[var(--fg)]')}>{label}</span>
        {sub && <span className="block truncate text-[13px] text-[var(--mut)]">{sub}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </>
  );
  return to ? <Link to={to} data-testid={testId} className={ROW}>{inner}</Link>
    : <button type="button" onClick={onClick} data-testid={testId} className={ROW}>{inner}</button>;
}

function Still({ label, sub, testId }: { label: string; sub?: string; testId: string }) {
  return (
    <div data-testid={testId} className={cn(ROW, 'text-[var(--mut)]')}>
      <span className="min-w-0 flex-1"><span className="block truncate">{label}</span>{sub && <span className="block truncate text-[13px]">{sub}</span>}</span>
    </div>
  );
}

type Overlay = 'rename' | 'venue' | 'pay' | 'sessions' | 'stop' | 'delete' | 'leave' | 'pause' | 'end' | null;

/**
 * The rebuilt event page (ER-C8): edit several things, then ONE Update. Series changes
 * reach every coming date except dates with their own changes (the button says the count).
 * Two save models stay: one date saves at once on its own screen; the series waits for Update.
 */
export function EventPage({ ws, today }: { ws: EventWorkspace; today: string }) {
  const seriesId = ws.series.id;
  const status = ws.series.lifecycle_status;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const flow = useFlowSend(seriesId);
  const venues = useVenueOptions();
  const tree = useMemo(() => parseTree(ws.program), [ws.program]);
  const closed = isClosed(status);

  const base = useMemo<PageDraft>(() => ({ fields: draftFromWorkspace(ws, today), payment: paymentOf(ws), sessions: sessionsOf(tree) }), [ws, today, tree]);
  const [draft, setDraft] = useState<PageDraft>(base);
  const latest = useRef(draft);
  // EP-2: a new read (a save that half went through, another organiser's save) rebases the
  // draft: the person's changes stay, the rest follows the read. The page is keyed on the id only.
  const [seen, setSeen] = useState(base);
  if (seen !== base) {
    latest.current = rebaseDraft(seen, base, latest.current);
    setSeen(base);
    setDraft(latest.current);
  }
  const set = (p: Partial<PageDraft>) => { latest.current = { ...latest.current, ...p }; setDraft(latest.current); };
  const patch = (p: Partial<EventDraft>) => set({ fields: { ...latest.current.fields, ...p } });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const opener = useOpenerRef(overlay !== null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [recent, setRecent] = useState<SessionPerson[]>([]);
  const [lastNight, setLastNight] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [allDates, setAllDates] = useState(false);
  const [tonightAnswer, setTonightAnswer] = useState<TodaySession | null>(null);

  const pending = pendingParts(base, draft, tree, (a, b) => changedFields(a, b));
  const dirty = pending.length > 0 && !closed;
  const name = draft.fields.name.trim() || ws.series.name;
  // EP-13: the server go-live check (the ONE publish rule) can only add to the client checklist.
  const goLive = useGoLiveCheck(seriesId, status === 'draft');
  const checklist = status === 'draft' ? draftChecklist(ws, today, tree, goLive.data?.eventMissing.map((i) => i.code)) : [];
  const blocker = publishBlocker(checklist);
  const rows = lifecycleRows(ws, today);
  const coming = wsComing(ws, today);
  const cancelled = ws.dates.filter((d) => d.lifecycle_status === 'cancelled' && d.occurrence_date >= today).sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
  const repeats = ws.series.format === 'recurring' && !!ws.series.recurrence_rule;
  const actions = pageActions(status, ws.series.format, repeats);
  const endOff = endOffReason(ws.series.format);
  const tonight = tonightDate(ws, today);
  const gap = ticketGap(draft);
  const noComing = status === 'live' && coming.length === 0 && ws.series.format !== 'festival';
  const nudge = payNudge(ws);
  const showDates = [...coming, ...cancelled].sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
  const shownDates = allDates ? showDates : showDates.slice(0, 6);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });

  // EP-5: every in-app way out (date rows, Add a date, the flyer, the event list, the shell)
  // asks first while something is pending. `allow` lets the page's own navigations through.
  const allow = useRef(false);
  const prompt = useRef(false);
  prompt.current = shouldPromptLeave(pending, flow.busy) && !closed;
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => !allow.current && prompt.current && currentLocation.pathname !== nextLocation.pathname,
    [],
  );
  const leave = useLeaveBlocker(shouldBlock, 'org-event-leave');
  const blocked = leave.state === 'blocked';
  const go = (fn: () => void) => { allow.current = true; fn(); };

  /** The pending changes, one command after another, each against the version the one before returned. */
  const saveAll = async (): Promise<number | null> => {
    let cityId: string | null = null;
    const venueId = latest.current.fields.venueId;
    if (venueId && venueId !== ws.series.default_venue_id) {
      const city = venues.data?.find((v) => v.id === venueId)?.city_name ?? null;
      if (city) cityId = await resolveCreateCityId({ venueCityName: city, organiserCityId: null });
    }
    let version = ws.series.version;
    for (const cmd of pageCommands(base, latest.current, ws, today, tree, cityId)) {
      const res = await flow.send(seriesId, version, cmd);
      if (!res) { refresh(); return null; }
      version = res.new_version ?? version;
    }
    return version;
  };
  const update = () => void flow.run(async () => {
    if ((await saveAll()) === null) return;
    refresh();
    // From the leave prompt: saved, so carry on to where the person was going.
    if (blocked) go(() => leave.proceed?.());
    else go(() => goDone(navigate, { title: 'Updated', message: `Updated - ${name}`, seriesId }));
  });
  const sendOne = (cmd: OwnerCommand, done: { title: string; message: string }) => void flow.run(async () => {
    const version = dirty ? await saveAll() : ws.series.version;
    if (version === null) return;
    const res = await flow.send(seriesId, version, cmd);
    if (res) { refresh(); go(() => goDone(navigate, { ...done, seriesId })); }
  });
  const discard = () => { latest.current = base; setDraft(base); setOverlay(null); };
  const goBack = () => (prompt.current ? setOverlay('leave') : navigate(ORG_PATHS.events));
  const keepEditing = () => { if (blocked) leave.reset?.(); setOverlay(null); };
  const discardAndGo = () => { discard(); if (blocked) go(() => leave.proceed?.()); else go(() => navigate(ORG_PATHS.events)); };

  /** End (or a one-off's Cancel the event, off until the server command lands). */
  const endControl = (testId: string) => (endOff ? (
    <span className="flex flex-col items-center">
      <span role="button" aria-disabled="true" aria-describedby={`${testId}-reason`} tabIndex={0} data-testid={testId} className={cn(QUIET, 'cursor-not-allowed text-[var(--mut)]')}>
        {endLabel(ws.series.format)}
      </span>
      <span id={`${testId}-reason`} data-testid={`${testId}-reason`} className="text-[13px] text-[var(--mut)]">{endOff}</span>
    </span>
  ) : (
    <button type="button" onClick={() => { setTonightAnswer(null); setOverlay('end'); }} data-testid={testId} className={cn(QUIET, 'text-[var(--danger)]')}>{endLabel(ws.series.format)}</button>
  ));

  const onUploadGallery = (files: File[]) => {
    if (uploading) return;
    setUploading(true);
    setUploadError(null);
    void (async () => {
      try {
        for (const file of files) patch({ gallery: [...latest.current.fields.gallery, await uploadEventPicture(seriesId, file)] });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : commandErrorMessage(err));
      } finally {
        setUploading(false);
      }
    })();
  };

  const jump = (id: string) => document.getElementById(`org-sec-${id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  const present = SECTIONS.filter((s) => s.id !== 'dates' || showDates.length > 0 || canAddDate(status));
  const venueLine = venueName(venues.data, draft.fields.venueId) ?? (draft.fields.venueId ? 'Venue' : null);
  const payLine = draft.payment.length ? payText(draft.payment) : null;

  if (flow.conflict) return <EventConflict seriesId={seriesId} />;

  const topBar = (
    <div className="flex min-h-[56px] items-center gap-[4px] px-[8px]">
      <button type="button" onClick={goBack} data-testid="org-event-back" className="flex h-[44px] min-w-[44px] items-center px-[8px] text-[15px] font-semibold text-[var(--gold)]">Events</button>
      <h1 className="min-w-0 flex-1 truncate text-[16px] font-bold text-[var(--fg)]">{name}</h1>
    </div>
  );

  const body = (
    <div className="flex flex-col gap-3" data-testid="org-event-page">
      <div className="flex items-center gap-[8px]">
        {closed ? <h2 className="min-w-0 flex-1 text-[24px] font-bold leading-tight text-[var(--fg)]" data-testid="org-event-title">{name}</h2> : (
          <button type="button" onClick={() => setOverlay('rename')} data-testid="org-event-title" aria-label={`Change the name: ${name}`}
            className="min-w-0 flex-1 text-left text-[24px] font-bold leading-tight text-[var(--fg)]">
            {name}&#8288;<span className="whitespace-nowrap">&#8288;<Pencil aria-hidden="true" className="inline h-[20px] w-[20px] align-baseline text-[var(--gold)]" /></span>
          </button>
        )}
        <span className={cn(TAG, TAG_TONE[lifecycleTag(status).tone])} data-testid="org-event-status">{lifecycleTag(status).label}</span>
        {rows.seeLive?.href && (
          <a href={rows.seeLive.href} target="_blank" rel="noopener noreferrer" data-testid="org-event-seelive"
            className="flex h-[44px] shrink-0 items-center gap-[6px] px-[8px] text-[15px] font-semibold text-[var(--fg)]">
            <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />See it live
          </a>
        )}
      </div>

      {!closed && (
        <nav aria-label="Jump to a part to edit" data-testid="org-edit-bar" className="flex items-center gap-[8px] overflow-x-auto md:hidden">
          <span className="flex h-[44px] shrink-0 items-center gap-[6px] rounded-[var(--r-ctl,12px)] bg-[var(--gold)] px-[12px] text-[15px] font-bold text-[var(--btnfg)]">
            <Pencil aria-hidden="true" className="h-[16px] w-[16px]" />Edit
          </span>
          {present.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} data-testid={`org-edit-${s.id}`}
              className="h-[44px] shrink-0 rounded-[var(--r-ctl,12px)] bg-[var(--card)] px-[14px] text-[15px] font-semibold text-[var(--fg)]">{s.label}</button>
          ))}
        </nav>
      )}

      {closed && <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-event-ended-line">{status === 'ended' ? ENDED_LINE : ARCHIVED_LINE}</p>}
      <ClosedLines ws={ws} today={today} testId="org-event" />

      {status === 'draft' && (
        <Card label="Before you publish" testId="org-checklist">
          {checklist.map((c) => c.done
            ? <Still key={c.code ?? c.key} testId={`org-check-${c.key}`} label={c.done_label} sub="Done" />
            : <Go key={c.code ?? c.key} testId={`org-check-${c.key}`} label={c.fix} accent onClick={() => (c.key === 'venue' ? setOverlay('venue') : c.key === 'pay' ? setOverlay('pay') : c.key === 'session' ? setOverlay('sessions')
                : c.key === 'other' ? (c.code === 'description' ? setSheet('description') : jump('details')) : jump(c.key === 'flyer' ? 'flyer' : 'dates'))} />)}
        </Card>
      )}
      {status === 'paused' && <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-event-paused">Paused. Hidden from the calendar.</p>}
      {nudge && (
        <Card testId="org-pay-nudge">
          <div className="px-[16px] pt-[12px]"><p className="text-[15px] font-semibold text-[var(--fg)]">How do people pay?</p><p className="text-[13px] text-[var(--mut)]">{PAY_NUDGE_SUB}</p></div>
          <Go label={PAY_NUDGE} accent onClick={() => setOverlay('pay')} testId="org-pay-nudge-add" />
        </Card>
      )}
      {noComing && (
        <Card testId="org-no-coming">
          <div className="px-[16px] pt-[12px]"><p className="text-[15px] font-semibold text-[var(--fg)]">No coming dates</p></div>
          <Go label="Add a date" accent to={ORG_PATHS.addEvent(seriesId)} testId="org-no-coming-add" />
          {actions.includes('end') && <div className="flex justify-center pb-[8px]">{endControl('org-no-coming-end')}</div>}
        </Card>
      )}

      {/* Sessions: the C4 card in a sheet; the page lists them. */}
      <section id="org-sec-sessions" aria-label="Sessions">
        <p className={LABEL}>Sessions</p>
        <Card testId="org-sessions">
          {draft.sessions.map((s) => {
            const sub = `${s.start || 'No start'}${s.end ? ` to ${s.end}` : ''}`;
            return closed ? <Still key={s.id} testId="org-session" label={s.name || kindLabel(s.kind)} sub={sub} />
              : <Go key={s.id} testId="org-session" label={s.name || kindLabel(s.kind)} sub={sub} onClick={() => setOverlay('sessions')} />;
          })}
          {draft.sessions.length === 0 && closed && <Still testId="org-sessions-none" label="No sessions" />}
          {!closed && draft.sessions.length < MAX_SESSIONS && (
            <button type="button" onClick={() => setOverlay('sessions')} data-testid="org-session-add" className={cn(ROW, LINK)}>
              <Plus aria-hidden="true" className="h-[18px] w-[18px]" />Add a session
            </button>
          )}
        </Card>
      </section>

      {(showDates.length > 0 || canAddDate(status)) && (
        <section id="org-sec-dates" aria-label="Dates">
          <p className={LABEL}>{ws.series.format === 'one_off' ? 'Date' : 'Coming dates'}</p>
          <Card testId="org-dates">
            {shownDates.map((d) => {
              const own = d.session_overrides_count > 0 || d.added_sessions_count > 0;
              return (
                <Link key={d.id} to={ORG_PATHS.changeDate(seriesId, d.id)} data-testid="org-date" className={ROW}>
                  <span className="min-w-0 flex-1 truncate text-[var(--fg)]">{dayLabel(d.occurrence_date)}</span>
                  {d.lifecycle_status === 'cancelled' ? <span className={TAG}>Cancelled</span> : own ? <span className={cn(TAG, 'bg-[var(--warn-bg)] text-[var(--warn-fg)]')}>Own changes</span> : null}
                  <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
                </Link>
              );
            })}
            {showDates.length > 6 && (
              <button type="button" onClick={() => setAllDates((v) => !v)} data-testid="org-dates-all" className={cn(ROW, 'text-[var(--mut)]')}>
                {allDates ? 'Show fewer' : `Show all ${showDates.length} dates`}
              </button>
            )}
            {/* EP-10: the No coming dates card already offers Add a date. */}
            {canAddDate(status) && !noComing && (
              <Link to={ORG_PATHS.addEvent(seriesId)} data-testid="org-date-add" className={cn(ROW, LINK)}>
                <Plus aria-hidden="true" className="h-[18px] w-[18px]" />Add a date
              </Link>
            )}
          </Card>
        </section>
      )}

      <section id="org-sec-flyer" aria-label={FLYER_LABEL}>
        <Card testId="org-flyer">
          {closed ? <Still testId="org-flyer-row" label={FLYER_LABEL} sub={ws.series.default_cover_image_url ? 'Set' : 'None'} />
            : <Go to={ORG_PATHS.cover(seriesId)} testId="org-flyer-row" label={ws.series.default_cover_image_url ? 'Change the flyer' : 'Add a flyer'} />}
        </Card>
      </section>

      <section id="org-sec-details" aria-label="Details">
        <p className={LABEL}>Details</p>
        <Card testId="org-details">
          {closed ? (
            <>
              <Still testId="org-detail-venue" label={venueLine ?? 'No venue'} />
              <Still testId="org-detail-pay" label={payLine ?? 'No way to pay'} />
            </>
          ) : (
            <>
              <Go testId="org-detail-name" label="Name" sub={name} onClick={() => setOverlay('rename')} />
              <Go testId="org-detail-venue" label={venueLine ?? 'Pick a venue'} onClick={() => setOverlay('venue')} />
              <Go testId="org-detail-pay" label={payLine ?? PAY_NUDGE} sub={ws.series.format === 'festival' ? 'Ticket link only' : undefined} accent={!payLine} onClick={() => setOverlay('pay')} />
              {draft.payment.includes('ticket_link') && (
                <Go testId="org-detail-ticket" label={gap ?? 'Ticket link'} sub={gap ? undefined : draft.fields.ticketUrl.trim()} accent={!!gap} onClick={() => setSheet('ticket')} />
              )}
            </>
          )}
          {/* EP-4: the organisers (S4's screen, chosen per event by its route); everyone on the event can open it. */}
          <Go testId="org-detail-organisers" label="Organisers" sub={ws.organiserIds.length ? countLabel(ws.organiserIds.length, 'organiser', 'organisers') : undefined}
            to={ORG_PATHS.eventOrganisers(seriesId)} />
        </Card>
      </section>

      {(!closed || draft.fields.description || draft.fields.styles.length > 0) && (
        <section id="org-sec-about" aria-label="About">
          <p className={LABEL}>About</p>
          <Card testId="org-about">
            {closed ? (
              <>
                {draft.fields.description && <Still testId="org-about-description" label={draft.fields.description} />}
                <div className="flex flex-wrap gap-[8px] p-[12px]">{draft.fields.styles.map((s) => <span key={s} className={TAG}>{s}</span>)}</div>
              </>
            ) : (
              <>
                <Go testId="org-about-description" label="Description" sub={draft.fields.description ? draft.fields.description.slice(0, 60) : undefined} accent={!draft.fields.description}
                  onClick={() => setSheet('description')} />
                <div className="flex flex-wrap gap-[8px] p-[12px]" role="group" aria-label="Music styles">
                  {[...MUSIC_STYLES, ...draft.fields.styles.filter((s) => !MUSIC_STYLES.includes(s))].map((s) => (
                    <Chip key={s} selected={draft.fields.styles.includes(s)} testId="org-style"
                      onToggle={() => patch({ styles: draft.fields.styles.includes(s) ? draft.fields.styles.filter((x) => x !== s) : [...draft.fields.styles, s] })}>{s}</Chip>
                  ))}
                </div>
                <Go testId="org-about-gallery" label="Photos" sub={countLabel(draft.fields.gallery.length, 'photo', 'photos')} onClick={() => setSheet('gallery')} />
                <Go testId="org-about-video" label="Video" sub={countLabel(draft.fields.videos.length, 'video', 'videos')} onClick={() => setSheet('video')} />
              </>
            )}
          </Card>
        </section>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-[8px]" data-testid="org-event-actions">
          {actions.includes('pause') && <button type="button" onClick={() => setOverlay('pause')} data-testid="org-action-pause" className={cn(QUIET, 'text-[var(--mut)]')}>Pause event</button>}
          {actions.includes('end') && endControl('org-action-end')}
          {actions.includes('stop') && (
            coming.length === 0
              ? <span className={cn(QUIET, 'text-[var(--mut)]')} aria-disabled="true" data-testid="org-action-stop">Stop repeating (no coming dates)</span>
              : <button type="button" onClick={() => setOverlay('stop')} data-testid="org-action-stop" className={cn(QUIET, 'text-[var(--danger)]')}>Stop repeating</button>
          )}
          {actions.includes('delete') && <button type="button" onClick={() => setOverlay('delete')} data-testid="org-action-delete" className={cn(QUIET, 'text-[var(--danger)]')}>Delete draft</button>}
        </div>
      )}
      {status === 'paused' && !dirty && (
        <button type="button" onClick={() => sendOne(lifecycleCommand('live'), { title: 'Live', message: `Live - ${name}` })} data-testid="org-action-resume"
          className={cn(QUIET, 'justify-center text-[var(--gold)]')}>Resume event</button>
      )}
    </div>
  );

  const line = scopeLine(ws, today);
  const dock = dirty ? (
    <div className="flex flex-col gap-[6px] p-3" data-testid="org-dock">
      <PrimaryButton testId="org-update" loading={flow.busy} loadingLabel="Updating" disabled={!!gap} onClick={update}>{updateLabel(status)}</PrimaryButton>
      {gap && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="org-update-reason">{gap}</p>}
      {line && status === 'live' && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="org-update-scope">{line}</p>}
      {flow.error && (
        <div role="alert" className="text-center text-[13px] text-[var(--danger)]" data-testid="org-update-failed">
          {UPDATE_FAILED}{' '}
          <button type="button" onClick={update} className="font-semibold underline" data-testid="org-update-retry">{UPDATE_RETRY}</button>
        </div>
      )}
      <GhostButton size="sm" testId="org-discard" onClick={discard}>Discard changes</GhostButton>
    </div>
  ) : status === 'draft' ? (
    <div className="flex flex-col gap-[6px] p-3" data-testid="org-dock">
      <PrimaryButton testId="org-publish" loading={flow.busy} loadingLabel="Publishing" disabled={!!blocker}
        onClick={() => sendOne(lifecycleCommand('live'), { title: 'Live', message: `Live - ${name}` })}>Publish</PrimaryButton>
      {blocker && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="org-publish-reason">{blocker.fix}</p>}
      {flow.error && <p role="alert" className="text-center text-[13px] text-[var(--danger)]" data-testid="org-publish-failed">{flow.error}</p>}
    </div>
  ) : null;

  const overlays = (
    <>

      {overlay === 'rename' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title="Name" footer={<PrimaryButton onClick={() => setOverlay(null)} disabled={!draft.fields.name.trim()} testId="org-rename-done">Done</PrimaryButton>}>
          <input value={draft.fields.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} aria-label="Name" data-sheet-autofocus data-testid="org-rename-input"
            className="block h-[48px] w-full rounded-[var(--r-ctl,12px)] border border-[var(--line-strong)] bg-[var(--card2)] px-[12px] text-[16px] text-[var(--fg)]" />
        </SheetView>
      )}
      {overlay === 'venue' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title="Venue" fullHeight>
          <VenuePicker onPick={(v) => { patch({ venueId: v.id }); setOverlay(null); }} />
        </SheetView>
      )}
      {overlay === 'pay' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title="How do people pay?" footer={<PrimaryButton onClick={() => setOverlay(null)} testId="org-pay-done">Done</PrimaryButton>}>
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="How to pay">
            {paymentCodes(ws.series.format).map((c: PaymentCode) => (
              <Chip key={c} testId={`org-pay-${c}`} selected={draft.payment.includes(c)}
                onToggle={() => set({ payment: draft.payment.includes(c) ? draft.payment.filter((x) => x !== c) : [...draft.payment, c] })}>{PAY_LABEL[c] ?? c}</Chip>
            ))}
          </div>
        </SheetView>
      )}
      {overlay === 'sessions' && (
        <SessionSheet returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} sessions={draft.sessions} onSave={(next) => set({ sessions: next })}
          search={search} recent={recent} onRecentChange={setRecent} max={MAX_SESSIONS} />
      )}
      {overlay === 'stop' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title="Which is the last night?"
          footer={(
            <div className="space-y-[6px]">
              <PrimaryButton testId="org-stop-confirm" disabled={!lastNight} loading={flow.busy} className="bg-[var(--danger)] text-[var(--btnfg)]"
                onClick={() => lastNight && sendOne(stopAfterCommand(ws, today, lastNight), { title: 'Stopped', message: `Stops repeating - ${name}` })}>Stop repeating</PrimaryButton>
              {!lastNight && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="org-stop-reason">{STOP_REASON}</p>}
            </div>
          )}>
          <div role="radiogroup" aria-label="Last night">
            {lastNightChoices(ws, today).map((d) => (
              <button key={d.id} type="button" role="radio" aria-checked={lastNight === d.occurrence_date} data-testid="org-stop-night" onClick={() => setLastNight(d.occurrence_date)}
                className={cn(ROW, lastNight === d.occurrence_date && 'font-bold text-[var(--gold)]')}>{dayLabel(d.occurrence_date)}</button>
            ))}
          </div>
        </SheetView>
      )}
      {overlay === 'delete' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title={`Delete ${name}?`}
          footer={(
            <div className="space-y-[6px]">
              <PrimaryButton testId="org-delete-confirm" loading={flow.busy} className="bg-[var(--danger)] text-[var(--btnfg)]"
                onClick={() => sendOne(DELETE_DRAFT, { title: 'Deleted', message: `Draft deleted - ${name}` })}>Delete draft</PrimaryButton>
              <GhostButton onClick={() => setOverlay(null)} testId="org-delete-keep">Keep it</GhostButton>
            </div>
          )}>
          <p className="text-center text-[14px] text-[var(--mut)]">This cannot be undone.</p>
        </SheetView>
      )}
      {overlay === 'pause' && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title={`Pause ${name}?`}
          footer={(
            <div className="space-y-[6px]">
              <PrimaryButton testId="org-pause-confirm" loading={flow.busy}
                onClick={() => sendOne(lifecycleCommand('paused'), { title: 'Paused', message: `Paused - ${name}` })}>Pause event</PrimaryButton>
              <GhostButton onClick={() => setOverlay(null)} testId="org-pause-keep">Keep it live</GhostButton>
            </div>
          )}>
          <p className="text-center text-[14px] text-[var(--mut)]" data-testid="org-pause-line">{PAUSE_LINE}</p>
        </SheetView>
      )}
      {overlay === 'end' && !endOff && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && setOverlay(null)} title={`End ${name}?`}
          footer={(
            <div className="space-y-[6px]">
              <PrimaryButton testId="org-end-confirm" loading={flow.busy} disabled={!!tonight && !tonightAnswer} className="bg-[var(--danger)] text-[var(--btnfg)]"
                onClick={() => sendOne(endRunCommand(tonight ? tonightAnswer : null), { title: 'Ended', message: `Ended - ${name}` })}>{endLabel(ws.series.format)}</PrimaryButton>
              {tonight && !tonightAnswer && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="org-end-reason">Say if tonight runs</p>}
              <GhostButton onClick={() => setOverlay(null)} testId="org-end-keep">Keep it</GhostButton>
            </div>
          )}>
          <p className="text-center text-[14px] text-[var(--mut)]" data-testid="org-end-line">{END_LINE}</p>
          {tonight && (
            <div role="radiogroup" aria-label="Tonight" className="mt-[8px]">
              {([['ran', 'Tonight runs'], ['not_running', 'Tonight is off']] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={tonightAnswer === v} data-testid={`org-end-tonight-${v}`} onClick={() => setTonightAnswer(v)}
                  className={cn(ROW, tonightAnswer === v && 'font-bold text-[var(--gold)]')}>{label}</button>
              ))}
            </div>
          )}
        </SheetView>
      )}
      {(overlay === 'leave' || blocked) && (
        <SheetView returnFocusRef={opener} open onOpenChange={(o) => !o && keepEditing()} title={LEAVE_TITLE}
          footer={(
            <div className="space-y-[6px]">
              <PrimaryButton testId="org-leave-update" loading={flow.busy} disabled={!!gap} onClick={update}>{updateLabel(status)}</PrimaryButton>
              <GhostButton testId="org-leave-discard" onClick={discardAndGo}>Discard changes</GhostButton>
              <GhostButton testId="org-leave-keep" onClick={keepEditing}>Keep editing</GhostButton>
            </div>
          )}>
          <p className="text-center text-[14px] text-[var(--mut)]">{LEAVE_LINE}</p>
        </SheetView>
      )}
      <EditorSheet sheet={sheet} onSheet={setSheet} draft={draft.fields} patch={patch} today={today} cap={capInput(ws, draft.fields, today)}
        venues={venues.data} onUploadGallery={onUploadGallery} uploading={uploading} uploadError={uploadError} />
    </>
  );

  return (
    <OrganiserShell topBar={topBar} testId="org-page-event" list={<EventList activeId={seriesId} />} detail={<>{body}{overlays}</>} actionBar={dock} />
  );
}

