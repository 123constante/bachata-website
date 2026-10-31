import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useLondonToday } from '@/hooks/useLondonToday';
import { useOrganiserChoice } from '../../switch/useOrganiserChoice';
import { createBlock } from '../../shared/createModel';
import { checkFlyerFile, FLYER_PROBLEM_COPY } from '../../shared/flyerModel';
import { ONBOARDING_REFUSAL } from '../../shared/selfServeErrors';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { needsPagePick, PAGE_SET_PARAM } from './pageModel';
import { P3PushedShell } from '../you/surface';
import { P3Link, RetryButton, StateCard } from '../screens/parts';
import { P3_PATHS, p3StartReview } from '../shell/paths';
import {
  COPY, KINDS, RESULT_COPY, addChosenDate, afterKind, backOf, blankCreate, buildableKind, chosenDates, draftBlock, isUntouched, kindTarget,
  liveBlock, notSavedLine, parseAt, parseStoredDraft, priceLine, removeChosenDate, repeatLine, rowProblems, sessionsLine, whenLine, withFirstDate,
  DRAFT_STORE_KEY, type CreateDraft, type CreateKind, type KindInfo,
} from './model';
import { LANDED_PARAM, forgetStoredDraft, useCreateSave } from './useCreateSave';
import { PriceSheet, RepeatSheetNew, SessionsSheet, VenueSheet } from './sheets';
import { Sheet } from '../screens/Sheet';
import { fullDate } from '../../shared/dateWords';
import './create.css';

const TITLE = 'New event';
const EVENTS = { to: P3_PATHS.events, label: 'Events' };

function Frame({ title, back, end, children, testId }: { title: string; back: { to: string; label: string }; end?: ReactNode; children: ReactNode; testId: string }) {
  return (
    <P3PushedShell title={title} back={back} topBarEnd={end} testId={testId}>
      <div className="p3-stack p3-new-flow">{children}</div>
    </P3PushedShell>
  );
}

// ---- C1 pick what it is -------------------------------------------------------------------

function KindStep({ organiserId, pageCount }: { organiserId: string | null; pageCount: number }) {
  const navigate = useNavigate();
  const pick = (k: KindInfo) => {
    // review 1 F5: Back to the kinds and the same kind again keeps what was typed; another kind starts blank.
    // review 2 R2-2: a draft whose create landed is never picked up again from here.
    const kept = storedDraft();
    if (!kept || kept.created || kept.kind !== k.kind) forgetStoredDraft();
    navigate(kindTarget(k, organiserId, pageCount));
  };
  return (
    <Frame title={TITLE} back={backOf('kind', '', organiserId, pageCount)} testId="p3-new-kind">
      <h2 className="p3-h2">{COPY.kindTitle}</h2>
      <div className="p3-new-kinds" data-testid="p3-new-kinds">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" className="p3-new-kind" aria-describedby={k.deferred ? `p3-new-why-${k.kind}` : undefined}
            onClick={() => pick(k)} data-testid={`p3-new-kind-${k.kind}`}>
            <span className="p3-new-kind-t">{k.label}</span>
            <span className="p3-new-kind-s">{k.hint}</span>
            {k.deferred && <span className="p3-tag p3-tag-hidden" id={`p3-new-why-${k.kind}`}>{k.deferred}</span>}
          </button>
        ))}
      </div>
      <p className="p3-note">{COPY.kindNote}</p>
    </Frame>
  );
}

// ---- C2 which page (2+ pages only) --------------------------------------------------------

function PageStep({ kind, organisers, selectedId }: { kind: KindInfo; organisers: HomeOrganiser[]; selectedId: string | null }) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(selectedId ?? organisers[0]?.id ?? null);
  return (
    <Frame title={TITLE} back={backOf('page', kind.kind, selectedId, organisers.length)} testId="p3-new-page">
      <h2 className="p3-h2">{COPY.pageTitle}</h2>
      <p className="p3-note">{COPY.pageNote}</p>
      <div className="p3-stack-s" role="radiogroup" aria-label="Pages">
        {organisers.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.id === chosen} className="p3-choice" onClick={() => setChosen(o.id)} data-testid="p3-new-page-row" data-org={o.id}>
            <span className="p3-row-t">{o.id === chosen ? '\u2713 ' : ''}{o.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="p3-btn" disabled={!chosen} onClick={() => chosen && navigate(P3_PATHS.createStep('form', kind.kind, chosen))} data-testid="p3-new-page-continue">Continue</button>
    </Frame>
  );
}

// ---- C3.. the form ------------------------------------------------------------------------

function storedDraft(): CreateDraft | null {
  try {
    return parseStoredDraft(window.sessionStorage.getItem(DRAFT_STORE_KEY));
  } catch {
    return null; // storage off: start blank
  }
}

/**
 * The draft a form opens with. One whose create landed opens its event page ONLY when this URL
 * names it (the same screen reloaded, review 1 F1); any other way in forgets it and starts blank
 * (review 2 R2-2), so it never takes over the next New event.
 */
function bootDraft(kind: CreateKind, landedId: string | null): { draft: CreateDraft; open: string | null } {
  const stored = storedDraft();
  if (stored?.created) {
    forgetStoredDraft();
    return stored.seriesId === landedId ? { draft: stored, open: stored.seriesId } : { draft: blankCreate(kind), open: null };
  }
  return { draft: stored && stored.kind === kind ? stored : blankCreate(kind), open: null };
}

function Row({ title, value, action, onClick, testId, disabled }: { title: string; value: string; action: string; onClick: () => void; testId: string; disabled: boolean }) {
  return (
    <button type="button" className="p3-new-row" onClick={onClick} disabled={disabled} data-testid={testId}>
      <span className="p3-grow">
        <span className="p3-row-t">{title}</span><br />
        <span className="p3-row-s">{value}</span>
      </span>
      <span className="p3-new-act">{action}</span>
    </button>
  );
}

type SheetName = 'venue' | 'repeat' | 'sessions' | 'price' | 'leave' | null;

function FormStep({ kind, organiser, pageCount }: { kind: KindInfo; organiser: HomeOrganiser; pageCount: number }) {
  const navigate = useNavigate();
  const today = useLondonToday();
  const [params] = useSearchParams();
  const [boot] = useState(() => bootDraft(kind.kind, params.get(LANDED_PARAM)));
  const [d, setD] = useState<CreateDraft>(boot.draft);
  const [cover, setCover] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [addDate, setAddDate] = useState('');
  const save = useCreateSave({ draft: d, cover, organiser, today, onCreated: () => setD((x) => ({ ...x, created: true })) });
  // review 2 R2-2: leaving a draft that exists (the partial or details screen, by any link) forgets it here
  const exists = useRef(false);
  const stateNow = save.state.s;
  useEffect(() => { exists.current = stateNow === 'partial' || stateNow === 'details' || stateNow === 'discardFailed'; }, [stateNow]);
  useEffect(() => () => { if (exists.current) forgetStoredDraft(); }, []);
  const preview = useMemo(() => {
    if (!cover || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    return URL.createObjectURL(cover);
  }, [cover]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  // Kept across steps and a reload (not the photo): a convenience, so storage that is off changes nothing.
  // review 2 R2-1: `created` lives in d, so a write after the create keeps it
  useEffect(() => {
    if (boot.open) return;
    try { window.sessionStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(d)); } catch { /* storage off */ }
  }, [d, boot.open]);
  // review 1 F8: while a sheet is open the page behind it does not scroll
  useEffect(() => {
    const main = sheet ? document.querySelector<HTMLElement>('main[data-testid="p3-new-form"]') : null;
    if (!main) return;
    const was = main.style.overflow;
    main.style.overflow = 'hidden';
    return () => { main.style.overflow = was; };
  }, [sheet]);

  const set = (p: Partial<CreateDraft>) => setD((x) => ({ ...x, ...p }));
  const hasCover = !!cover || save.coverUploaded;
  const untouched = isUntouched(d, hasCover);
  const problems = rowProblems(d, today);
  const draftWhy = draftBlock(d, today);
  const liveWhy = liveBlock(d, today, hasCover);
  const busy = save.state.s === 'busy';
  const back = backOf('form', kind.kind, organiser.id, pageCount);
  const cancel = () => {
    if (!untouched) { setSheet('leave'); return; }
    forgetStoredDraft();
    navigate(P3_PATHS.events);
  };
  const end = (
    <button type="button" className="p3-link p3-new-top-end" onClick={cancel} disabled={busy} data-testid="p3-new-cancel">Cancel</button>
  );
  const title = `New event: ${kind.label}`;

  if (boot.open) return <Navigate to={P3_PATHS.event(boot.open)} replace />;

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    const problem = checkFlyerFile(file);
    if (problem) { setCoverError(FLYER_PROBLEM_COPY[problem]); return; }
    setCoverError(null);
    save.forgetCover();
    setCover(file);
  };

  // The draft exists but not all of it saved: say what, and offer every way out.
  if (save.state.s === 'partial' || save.state.s === 'discarding' || save.state.s === 'discardFailed') {
    const st = save.state;
    return (
      <Frame title={title} back={EVENTS} testId="p3-new-form">
        <StateCard title={RESULT_COPY.partTitle} testId="p3-new-partial-error">
          {st.s === 'partial' && <p data-testid="p3-new-partial-left">{notSavedLine(st.left, today)}</p>}
          {st.s === 'partial' && <p>{st.message}</p>}
          {st.s === 'discardFailed' && <p className="p3-error">{RESULT_COPY.discardFailed}</p>}
          <p>{RESULT_COPY.partBody}</p>
          <div className="p3-stack-s">
            <button type="button" className="p3-btn" disabled={st.s === 'discarding'} onClick={() => void save.retry()} data-testid="p3-new-retry">Try again</button>
            <Link className="p3-btn p3-btn-line p3-new-linkbtn" to={P3_PATHS.event(d.seriesId)} onClick={() => forgetStoredDraft()} data-testid="p3-new-open">Open the draft</Link>
            <button type="button" className="p3-btn p3-btn-line p3-danger-t" disabled={st.s === 'discarding'} onClick={() => void save.discard()} data-testid="p3-new-discard">
              {st.s === 'discarding' ? 'Discarding\u2026' : 'Discard it'}
            </button>
          </div>
        </StateCard>
      </Frame>
    );
  }
  if (save.state.s === 'details') {
    return (
      <Frame title={title} back={EVENTS} testId="p3-new-form">
        <StateCard title={RESULT_COPY.detailsTitle} testId="p3-new-details">
          <p>{RESULT_COPY.detailsBody(d.name)}</p>
          <div className="p3-stack-s">
            <P3Link to={p3StartReview(organiser.id)} testId="p3-new-details-go">Answer the questions</P3Link>
            <P3Link to={P3_PATHS.event(d.seriesId)} testId="p3-new-open">Not now, open the draft</P3Link>
          </div>
        </StateCard>
      </Frame>
    );
  }

  const failed = save.state.s === 'failed' ? save.state : null;
  const whenTitle = kind.when === 'repeat' ? 'Starts' : 'Date';
  return (
    <Frame title={title} back={back} end={end} testId="p3-new-form">
      {failed && (failed.onboarding ? (
        <StateCard title={RESULT_COPY.onboardingTitle} testId="p3-new-onboarding-error">
          <p>{ONBOARDING_REFUSAL} The event was not saved; what you typed is still here.</p>
          <P3Link to={p3StartReview(organiser.id)} testId="p3-new-onboarding-go">Finish your details</P3Link>
        </StateCard>
      ) : (
        <StateCard title={RESULT_COPY.nothingSaved} testId="p3-new-failed-error">
          <p>{failed.message} What you typed is still here.</p>
          <RetryButton onClick={() => void save.retry()} />
        </StateCard>
      ))}

      <div className="p3-card p3-stack-s">
        <label className="p3-field" htmlFor="p3-new-name">Name</label>
        <input id="p3-new-name" className="p3-in" value={d.name} maxLength={140} disabled={busy} placeholder="For example Friday Bachata at The Loft"
          onChange={(e) => set({ name: e.target.value })} data-testid="p3-new-name" />
        {problems.name ? <p className="p3-error" data-testid="p3-new-name-problem">{problems.name}</p> : <p className="p3-note">Up to 120 letters. Needed to save.</p>}
      </div>

      <div className="p3-card p3-tight" data-testid="p3-new-rows">
        <Row title="Where" value={d.venue ? [d.venue.name, d.venue.place].filter(Boolean).join(', ') : 'Not set'} action={d.venue ? 'Change' : 'Pick'} onClick={() => setSheet('venue')} disabled={busy} testId="p3-new-row-venue" />
        {kind.when === 'dates' ? (
          <div className="p3-new-inline" data-testid="p3-new-dates">
            <span className="p3-row-t">Dates</span>
            <span className="p3-row-s">Each date gets the same sessions. Change one date later on the event page.</span>
            {chosenDates(d).length === 0 && <p className="p3-note" data-testid="p3-new-dates-empty">{COPY.noDates} Up to 30 upcoming dates can be listed at once.</p>}
            {chosenDates(d).map((x) => (
              <div key={x} className="p3-new-date" data-testid="p3-new-date">
                <span className="p3-row-t">{fullDate(x, today)}</span>
                <button type="button" className="p3-link" disabled={busy} onClick={() => setD((v) => removeChosenDate(v, x))}>Remove</button>
              </div>
            ))}
            <label className="p3-field" htmlFor="p3-new-add-date">Add a date</label>
            <div className="p3-new-time">
              <input id="p3-new-add-date" className="p3-in" type="date" min={today} value={addDate} disabled={busy} onChange={(e) => setAddDate(e.target.value)} data-testid="p3-new-add-date" />
              <button type="button" className="p3-btn p3-btn-line" disabled={!addDate || busy} aria-describedby={!addDate ? 'p3-new-add-why' : undefined}
                onClick={() => { setD((v) => addChosenDate(v, addDate)); setAddDate(''); }} data-testid="p3-new-add-date-go">Add</button>
            </div>
            {!addDate && <p className="p3-note" id="p3-new-add-why">Pick a date above, then tap Add.</p>}
          </div>
        ) : (
          <div className="p3-new-inline">
            <label className="p3-row-t" htmlFor="p3-new-first">{whenTitle}</label>
            <input id="p3-new-first" className="p3-in" type="date" min={today} value={d.firstDate} disabled={busy}
              onChange={(e) => setD((v) => withFirstDate(v, e.target.value))} data-testid="p3-new-first" />
            {d.firstDate && <span className="p3-row-s">{whenLine(d, today)}</span>}
          </div>
        )}
        {kind.when === 'repeat' && (
          <Row title="Repeats" value={repeatLine(d, today)} action="Change" onClick={() => setSheet('repeat')} disabled={busy} testId="p3-new-row-repeat" />
        )}
        {problems.when && <p className="p3-error" data-testid="p3-new-when-problem">{problems.when}</p>}
        <Row title="Sessions" value={sessionsLine(d)} action={d.sessions.length ? 'Change' : 'Add'} onClick={() => setSheet('sessions')} disabled={busy} testId="p3-new-row-sessions" />
        {problems.sessions && <p className="p3-error" data-testid="p3-new-sessions-problem">{problems.sessions}</p>}
        <Row title="Price" value={priceLine(d)} action={d.pay.length ? 'Change' : 'Pick'} onClick={() => setSheet('price')} disabled={busy} testId="p3-new-row-price" />
        {problems.price && <p className="p3-error" data-testid="p3-new-price-row-problem">{problems.price}</p>}
      </div>

      <div className="p3-card p3-stack-s" data-testid="p3-new-photo">
        <strong>Cover photo</strong>
        {preview && <img className="p3-new-cover" src={preview} alt="Your cover photo" loading="lazy" decoding="async" data-testid="p3-new-cover-preview" />}
        {!preview && cover && <p className="p3-ok" data-testid="p3-new-cover-picked">Photo picked: {cover.name}</p>}
        <label className="p3-btn p3-btn-line p3-file p3-new-file" data-testid="p3-new-cover-label">
          {cover ? 'Choose a different photo' : 'Add a photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => pickCover(e.target.files?.[0])} data-testid="p3-new-cover-input" />
        </label>
        {coverError ? <p className="p3-error" data-testid="p3-new-cover-error">{coverError}</p> : <p className="p3-note">{COPY.photoNote} Needed to go live.</p>}
      </div>

      {busy && <p className="p3-ok" role="status" data-testid="p3-new-saving">Saving&hellip;</p>}
      <div className="p3-new-foot">
        <button type="button" className="p3-btn p3-btn-line" disabled={busy || !!draftWhy} aria-describedby="p3-new-draft-why" onClick={() => void save.run(false)} data-testid="p3-new-save-draft">Save draft</button>
        <button type="button" className="p3-btn" disabled={busy || !!liveWhy} aria-describedby="p3-new-live-why" onClick={() => void save.run(true)} data-testid="p3-new-go-live">Go live</button>
        <p className="p3-new-why" id="p3-new-live-why" data-testid="p3-new-live-why">{liveWhy ?? 'Ready to go live.'}</p>
        {draftWhy && <p className="p3-new-why" id="p3-new-draft-why" data-testid="p3-new-draft-why">{draftWhy}</p>}
      </div>

      {sheet === 'venue' && <VenueSheet onPick={(v) => { set({ venue: v }); setSheet(null); }} onClose={() => setSheet(null)} />}
      {sheet === 'repeat' && <RepeatSheetNew d={d} today={today} onChange={(r) => set({ repeat: r })} onClose={() => setSheet(null)} />}
      {sheet === 'sessions' && <SessionsSheet d={d} today={today} onChange={(s) => set({ sessions: s })} onClose={() => setSheet(null)} />}
      {sheet === 'price' && <PriceSheet d={d} today={today} onChange={set} onClose={() => setSheet(null)} />}
      {sheet === 'leave' && (
        <Sheet title={COPY.leaveTitle} onClose={() => setSheet(null)}>
          <p className="p3-note">{draftWhy ? COPY.leaveNoName : COPY.leaveBody}</p>
          <button type="button" className="p3-btn" onClick={() => setSheet(null)} data-testid="p3-new-keep-going">Keep going</button>
          <button type="button" className="p3-btn p3-btn-line" disabled={!!draftWhy} aria-describedby={draftWhy ? 'p3-new-leave-why' : undefined}
            onClick={() => { setSheet(null); void save.run(false); }} data-testid="p3-new-leave-save">Save as a draft and leave</button>
          {draftWhy && <p className="p3-note" id="p3-new-leave-why">{draftWhy}</p>}
          <button type="button" className="p3-btn p3-btn-line p3-danger-t" onClick={() => { forgetStoredDraft(); navigate(P3_PATHS.events); }} data-testid="p3-new-leave-discard">Leave without saving</button>
        </Sheet>
      )}
    </Frame>
  );
}

// ---- the route target ---------------------------------------------------------------------

/** New event in P3 (route `create`): `?at=` names the step, `kind` the kind, `o` the page. */
export default function CreateFlow() {
  const [params] = useSearchParams();
  const { home, organisers, selected } = useOrganiserChoice();
  const at = parseAt(params.get('at'));
  const kindParam = params.get('kind');
  const o = params.get('o');

  if (home.isPending && !home.isPaused) {
    return <Frame title={TITLE} back={EVENTS} testId="p3-new-loading"><StateCard title="Getting your page&hellip;" testId="p3-new-loading-card">This takes a second.</StateCard></Frame>;
  }
  if (!home.data) {
    return (
      <Frame title={TITLE} back={EVENTS} testId="p3-new-home-error">
        <StateCard title="We couldn&rsquo;t load your page" testId="p3-new-home-error-card">
          <p>Check your connection, then try again.</p>
          <RetryButton onClick={() => void home.refetch()} />
        </StateCard>
      </Frame>
    );
  }
  if (!organisers.length || !selected) {
    return (
      <Frame title={TITLE} back={EVENTS} testId="p3-new-no-page">
        <StateCard title="Set up your page first" testId="p3-new-no-page-card">
          <p>An event belongs to a page. Create or claim yours, then come back here.</p>
          <P3Link to={P3_PATHS.start} testId="p3-new-setup">Set up my page</P3Link>
        </StateCard>
      </Frame>
    );
  }
  const pageCount = organisers.length;
  const organiserId = o && organisers.some((x) => x.id === o) ? o : null;
  if (at === 'kind') return <KindStep organiserId={organiserId} pageCount={pageCount} />;
  const kind = buildableKind(kindParam);
  if (!kind) return <Navigate to={P3_PATHS.createFor(organiserId)} replace />;
  if (at === 'page') {
    if (pageCount < 2) return <Navigate to={P3_PATHS.createStep('form', kind.kind, organiserId ?? selected.id)} replace />;
    return <PageStep kind={kind} organisers={organisers} selectedId={organiserId ?? selected.id} />;
  }
  // The form needs its page: with 2 or more pages it was asked (o is in the URL), else the one page.
  if (needsPagePick(pageCount, new URLSearchParams(organiserId ? { [PAGE_SET_PARAM]: 'set' } : {}))) {
    return <Navigate to={P3_PATHS.createStep('page', kind.kind, null)} replace />;
  }
  const organiser = organisers.find((x) => x.id === organiserId) ?? selected;
  const block = createBlock(organiser);
  if (block) {
    return (
      <Frame title={TITLE} back={backOf('form', kind.kind, organiserId, pageCount)} testId="p3-new-blocked">
        <StateCard title="You cannot start an event yet" testId="p3-new-blocked-card">
          <p>{block}</p>
          <P3Link to={P3_PATHS.youPage} testId="p3-new-blocked-page">See my page</P3Link>
        </StateCard>
      </Frame>
    );
  }
  return <FormStep key={`${kind.kind}|${organiser.id}`} kind={kind} organiser={organiser} pageCount={pageCount} />;
}

