import { useRef, useState, type ReactNode } from 'react';
import { fullDate } from '../../shared/dateWords';
import { localAsZTime } from '../../shared/homeModel';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { useVenueOptions, venueName } from '../../shared/publicVenues';
import { venueOverridePatch } from '../../dates/venueOverride';
import { passCount } from '../../events/seriesExtras';
import { ticketProblem } from '../../flows/change/changeModel';
import { FLYER_ACCEPT, FLYER_PROBLEM_COPY, FlyerError, checkFlyerBytes, checkFlyerFile, reencodeFlyer } from '../../shared/flyerModel';
import { uploadFlyer } from '../../shared/flyerUploadApi';
import { useSendOnce } from '../../shared/runCommands';
import type { OverridePatch } from '../../shared/seriesCommands';
import type { DateDetail, WorkspaceDate } from '../../shared/seriesModel';
import type { EventWorkspace } from '../../events/eventModel';
import { L, addDateWhy, dateActions, pickDayProblem, timeWord, type DateAction, type DateRow } from '../model';
import { cancelPlan } from '../data/eventPage';
import { dateFieldsWhy, dateGalleryOf, datePriceRows, datePricesLock, photosWord, pricesWord } from '../data/dateFields';
import {
  DATE_COPY, KeyRing, PLAN, PlanStepError, breakFactsOf, dateFactsOf, dateRowsOf, resetNormalPlan, seriesFactsOf, takenDays, undoFor, useDateDetail, useSendPlan,
  type DatePlan,
} from '../data/dates';
import { CancelEventSheet, ReasonPick, type SendOnce } from './CancelEventSheet';
import { DateFieldSheet, type FieldStep } from './DateFieldSheets';
import { P3NightGoing } from './P3Going';
import { useGatedCopy } from '../onboarding/gate';
import { Sheet } from './Sheet';
import { DateSessions } from './SessionSheet';
import type { Done } from './StatusSheet';

/** Which date sheet is open: a stored date, a break, or "Add a date". */
export type DateOpen = { kind: 'date'; id: string } | { kind: 'break'; date: string } | { kind: 'add' } | null;

type Step = 'list' | 'cancel' | 'move' | 'time' | 'details' | 'skip' | 'resetNormal'
  | 'edit-where' | 'edit-about' | 'edit-ticket' | 'edit-photo' | FieldStep;

const CONFIRM_STEP: Partial<Record<DateAction, Step>> = {
  cancel: 'cancel', move: 'move', time: 'time', details: 'details', skip: 'skip', resetNormal: 'resetNormal',
};

/** One write from a sheet: keys kept per plan (a retry is the same write), the error as plain copy. */
function useGo(ws: EventWorkspace, onDone: (d: Done) => void) {
  const send = useSendPlan(ws.series.id);
  const ring = useRef(new KeyRing());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gated = useGatedCopy();
  const go = async (plan: DatePlan, done: Done) => {
    setBusy(true);
    setError(null);
    try {
      await send(plan, ring.current.for(plan), ws.series.version);
      ring.current.forget(plan);
      onDone(done);
    } catch (e) {
      setError(gated(e, (x) => (x instanceof PlanStepError ? x.message : commandErrorMessage(x))));
    } finally {
      setBusy(false);
    }
  };
  return { go, busy, error, setError };
}

function ActionChoice({ row, busy, onPick }: { row: DateRow; busy: boolean; onPick: (a: DateAction) => void }) {
  const off = row.reason !== null;
  return (
    <button type="button" className="p3-choice" disabled={off || busy} data-testid={`p3-date-act-${row.action}`} data-enabled={!off}
      onClick={() => onPick(row.action)}>
      <span className={`p3-row-t ${row.danger && !off ? 'p3-danger-t' : ''}`}>{row.title}</span>
      <span className="p3-row-s">{row.reason ?? row.sub}</span>
    </button>
  );
}

function Err({ error }: { error: string | null }) {
  return error ? <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p> : null;
}

function Buttons({ children }: { children: ReactNode }) {
  return <div className="p3-stack-s">{children}</div>;
}

/** C3 `adddate`: a day from today on that the event does not already have. Nothing goes until one is picked. */
function AddDateSheet({ ws, today, onDone, onClose }: { ws: EventWorkspace; today: string; onDone: (d: Done) => void; onClose: () => void }) {
  const [day, setDay] = useState('');
  const { go, busy, error } = useGo(ws, onDone);
  const why = addDateWhy(seriesFactsOf(ws, today));
  const problem = day ? pickDayProblem(day, today, takenDays(ws)) : null;
  return (
    <Sheet title={DATE_COPY.addTitle(ws.series.name.trim() || L.noName)} onClose={onClose}>
      {why ? <p className="p3-warn" data-testid="p3-add-why">{why}</p> : (
        <>
          <label className="p3-field" htmlFor="p3-add-day">{L.addDate}</label>
          <input id="p3-add-day" className="p3-in" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} data-testid="p3-add-day" />
          <p className="p3-note">{DATE_COPY.addHint}</p>
          {problem && <p className="p3-warn" role="alert">{problem}</p>}
          <Err error={error} />
          <Buttons>
            <button type="button" className="p3-btn" disabled={!day || !!problem || busy} data-testid="p3-add-go"
              onClick={() => void go(PLAN.add(day), { text: DATE_COPY.done.add(fullDate(day, today)), undo: null })}>
              {L.addThisDate}
            </button>
          </Buttons>
        </>
      )}
    </Sheet>
  );
}

/** C3 `date` for a break: "Put this week back" only. */
function BreakSheet({ ws, date, today, onDone, onClose }: { ws: EventWorkspace; date: string; today: string; onDone: (d: Done) => void; onClose: () => void }) {
  const { go, busy, error } = useGo(ws, onDone);
  const [row] = dateActions(seriesFactsOf(ws, today), breakFactsOf(ws, date), today);
  return (
    <Sheet title={`${fullDate(date, today)} \u00b7 ${L.skipped}`} onClose={onClose}>
      <p className="p3-note">{DATE_COPY.breakBody}</p>
      <div className="p3-stack-s" data-testid="p3-date-actions">
        <ActionChoice row={row} busy={busy} onPick={() => void go(PLAN.unskip(date), { text: DATE_COPY.done.unskip, undo: null })} />
      </div>
      <Err error={error} />
    </Sheet>
  );
}

/**
 * A row of C3 `dayown`: this date's own value, or the usual one. `why` (W3b-2): the row cannot
 * change here, said instead of a live link (a festival's name, photos, price; a team-set list).
 * It greys "use usual" too: clearing the value is a change (fix round 1).
 */
function OwnRow({ label, own, usual, testId, busy, why = null, onEdit, onUsual }: {
  label: string; own: string | null; usual: string | null; testId: string; busy: boolean; why?: string | null; onEdit: () => void; onUsual: () => void;
}) {
  return (
    <div className="p3-row p3-row-col" data-testid={testId} data-enabled={!why}>
      <span className="p3-row-t">{label} <span className="p3-chip">{own ? L.onlyThis : L.sameUsual}</span></span>
      <span className="p3-row-s p3-plain">{own ?? usual ?? L.notSet}</span>
      {own && (
        <span className="p3-row-s">{L.usually}: {usual ?? DATE_COPY.usuallyNothing} &middot;{' '}
          <button type="button" className="p3-link" disabled={busy || !!why} aria-describedby={why ? `${testId}-why` : undefined} onClick={onUsual}
            data-testid={`${testId}-usual`}>{L.useUsual}</button>
        </span>
      )}
      {why ? <span className="p3-row-s" id={`${testId}-why`} data-testid={`${testId}-why`}>{why}</span>
        : <button type="button" className="p3-link" disabled={busy} onClick={onEdit} data-testid={`${testId}-edit`}>{L.changeForDate}</button>}
    </div>
  );
}

/** The C3 date sheet (`date`, `dtime`, `skip`, `resetdate`, `dayown`, `cancelnext` recurring wording) for one stored date. */
function OneDateSheet({ ws, d, detail, today, onDone, onClose, onCancelEvent }: {
  ws: EventWorkspace; d: WorkspaceDate; detail: DateDetail | null; today: string;
  onDone: (x: Done) => void; onClose: () => void; onCancelEvent: () => void;
}) {
  const [step, setStep] = useState<Step>('list');
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const { go, busy, error, setError } = useGo(ws, onDone);
  const venues = useVenueOptions();
  const facts = dateFactsOf(ws, d, detail);
  const rows = dateRowsOf(ws, d, detail, facts, today);
  const day = fullDate(d.occurrence_date, today);
  const start = localAsZTime(d.materialised_start_utc) ?? detail?.start ?? null;
  const done = (action: DateAction, words: string): Done => ({ text: words, ...undoFor(action, d, d.occurrence_date) });
  const to = (s: Step, value = '') => { setError(null); setText(value); setStep(s); };
  const s = ws.series;

  const pick = (a: DateAction) => {
    if (a === 'cancelEvent') return onCancelEvent();
    if (a === 'bringBack') return void go(PLAN.bringBack(d), done(a, DATE_COPY.done.bringBack));
    if (a === 'resetTime') return void go(PLAN.resetTime(d), done(a, DATE_COPY.done.resetTime));
    const next = CONFIRM_STEP[a];
    if (next) to(next, a === 'time' ? start ?? '' : '');
  };
  const saveDetail = (patch: OverridePatch) => void go(PLAN.details(d, patch), done('details', DATE_COPY.done.details));
  const back = () => to(step.startsWith('edit-') ? 'details' : 'list');
  const backLink = <button type="button" className="p3-link" onClick={back}>&larr; Back</button>;

  if (step === 'cancel') {
    return (
      <Sheet title={DATE_COPY.cancelTitle(s.name.trim() || L.noName, day)} onClose={onClose}>
        {backLink}
        <p className="p3-note">{DATE_COPY.cancelBody(day)}</p>
        <ReasonPick picked={reason} busy={busy} onPick={(r) => { setError(null); setReason(r); }} />
        <Err error={error} />
        <Buttons>
          <button type="button" className="p3-btn p3-btn-danger" disabled={!reason || busy} data-testid="p3-date-cancel-go"
            onClick={() => reason && void go(PLAN.cancel(d, reason), done('cancel', DATE_COPY.done.cancel))}>
            {reason ? DATE_COPY.cancelGo : DATE_COPY.pick}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={onClose}>{DATE_COPY.keep}</button>
        </Buttons>
      </Sheet>
    );
  }
  if (step === 'move') {
    const problem = text ? pickDayProblem(text, today, takenDays(ws)) : null;
    return (
      <Sheet title={DATE_COPY.moveTitle(day)} onClose={onClose}>
        {backLink}
        <label className="p3-field" htmlFor="p3-move-day">{L.dateAct.move[0]}</label>
        <input id="p3-move-day" className="p3-in" type="date" min={today} value={text} onChange={(e) => setText(e.target.value)} data-testid="p3-move-day" />
        <p className="p3-note">{DATE_COPY.moveHint}</p>
        {problem && <p className="p3-warn" role="alert">{problem}</p>}
        <Err error={error} />
        <Buttons>
          <button type="button" className="p3-btn" disabled={!text || !!problem || busy} data-testid="p3-move-go"
            onClick={() => void go(PLAN.move(d, text), done('move', DATE_COPY.done.move(fullDate(text, today))))}>
            {DATE_COPY.moveGo}
          </button>
        </Buttons>
      </Sheet>
    );
  }
  if (step === 'time') {
    const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(text) && text !== start;
    return (
      <Sheet title={DATE_COPY.timeTitle(day)} onClose={onClose}>
        {backLink}
        <p className="p3-note">{DATE_COPY.timeBody}</p>
        <label className="p3-field" htmlFor="p3-time-start">{DATE_COPY.startsAt}</label>
        <input id="p3-time-start" className="p3-in" type="time" step={900} value={text} onChange={(e) => setText(e.target.value)} data-testid="p3-time-start" />
        <p className="p3-note">{DATE_COPY.now(start)}</p>
        <Err error={error} />
        <Buttons>
          <button type="button" className="p3-btn" disabled={!ok || busy} data-testid="p3-time-go"
            onClick={() => void go(PLAN.time(d, text), done('time', DATE_COPY.done.time(text)))}>
            {L.saveOne}
          </button>
        </Buttons>
      </Sheet>
    );
  }
  if (step === 'skip' || step === 'resetNormal') {
    const plan = step === 'skip' ? PLAN.skip(d) : resetNormalPlan(d, detail, facts.ownTime);
    const title = step === 'skip' ? DATE_COPY.skipTitle(day) : DATE_COPY.resetTitle;
    const words = step === 'skip' ? DATE_COPY.done.skip : DATE_COPY.done.resetNormal;
    return (
      <Sheet title={title} onClose={onClose}>
        {backLink}
        {step === 'skip' && <p className="p3-note">{DATE_COPY.skipBody}</p>}
        {step === 'skip' && (facts.ownDetails || facts.ownTime) && <p className="p3-warn">{DATE_COPY.skipOwn}</p>}
        {step === 'skip' && <p className="p3-note">{DATE_COPY.skipHint}</p>}
        {step === 'resetNormal' && <p className="p3-note">{DATE_COPY.resetBody(day)}</p>}
        {step === 'resetNormal' && detail?.cancelled && fieldsOwned(detail) && <p className="p3-warn" data-testid="p3-reset-cancelled">{L.dateFieldsCancelled}</p>}
        <Err error={error} />
        <Buttons>
          <button type="button" className="p3-btn" disabled={!plan || busy} data-testid={`p3-${step}-go`}
            onClick={() => plan && void go(plan, done(step, words))}>
            {step === 'skip' ? DATE_COPY.skipGo : DATE_COPY.resetGo}
          </button>
          <button type="button" className="p3-btn p3-btn-line" onClick={back}>{step === 'resetNormal' ? DATE_COPY.keepMine : DATE_COPY.keepIt}</button>
        </Buttons>
      </Sheet>
    );
  }
  if (step === 'details') {
    const usualPlace = venueName(venues.data, s.default_venue_id);
    const ownPlace = detail?.venueOverride ? venueName(venues.data, detail.venueOverride) ?? detail.venueOverride : null;
    const fieldsWhy = dateFieldsWhy(ws);
    const usualPrices = datePricesLock(ws, null) ? L.pricesLockedCount(passCount(ws)) : pricesWord(datePriceRows(ws, null));
    const ownPrices = datePricesLock(ws, detail) ? L.pricesLockedCount(detail?.passesOverride?.length ?? 0) : pricesWord(datePriceRows(ws, detail));
    return (
      <Sheet title={DATE_COPY.detailsTitle(day)} onClose={onClose}>
        {backLink}
        <p className="p3-note">{DATE_COPY.detailsBody}</p>
        <div className="p3-card p3-tight p3-list" data-testid="p3-dayown">
          <OwnRow label={L.where} own={ownPlace} usual={usualPlace} testId="p3-own-where" busy={busy}
            onEdit={() => to('edit-where')} onUsual={() => saveDetail({ venue_id: null, city_id: null })} />
          <OwnRow label={L.aboutDate} own={detail?.descriptionOverride ?? null} usual={s.default_description} testId="p3-own-about" busy={busy}
            onEdit={() => to('edit-about', detail?.descriptionOverride ?? s.default_description ?? '')} onUsual={() => saveDetail({ description: null })} />
          <OwnRow label={L.ticket} own={detail?.ticketUrlOverride ?? null} usual={s.default_ticket_url} testId="p3-own-ticket" busy={busy}
            onEdit={() => to('edit-ticket', detail?.ticketUrlOverride ?? '')} onUsual={() => saveDetail({ ticket_url: null })} />
          <OwnRow label={L.photo} own={detail?.coverImageOverride ? L.onlyThis : null} usual={s.default_cover_image_url ? L.sameUsual : null} testId="p3-own-photo" busy={busy}
            onEdit={() => to('edit-photo')} onUsual={() => saveDetail({ cover_image_url: null })} />
          {/* W3b-2: name, photos, price (occurrence.set_override title / gallery / passes) */}
          <OwnRow label={L.dateName} own={detail?.titleOverride ?? null} usual={s.name.trim() || L.noName} testId="p3-own-name" busy={busy} why={fieldsWhy}
            onEdit={() => to('edit-name')} onUsual={() => saveDetail({ title: null })} />
          <OwnRow label={L.datePhotos} own={detail?.galleryOverride != null ? photosWord(detail.galleryOverride.length) : null}
            usual={photosWord(dateGalleryOf(ws, null).length)} testId="p3-own-photos" busy={busy} why={fieldsWhy}
            onEdit={() => to('edit-photos')} onUsual={() => saveDetail({ gallery: null })} />
          <OwnRow label={L.datePrice} own={detail?.passesOverride != null ? ownPrices : null} usual={usualPrices} testId="p3-own-price" busy={busy}
            why={fieldsWhy ?? datePricesLock(ws, detail)} onEdit={() => to('edit-price')} onUsual={() => saveDetail({ passes: null })} />
        </div>
        <Err error={error} />
      </Sheet>
    );
  }
  if (step === 'edit-where') {
    return (
      <Sheet title={DATE_COPY.pickVenue} onClose={onClose}>
        {backLink}
        {venues.isPending && <p className="p3-note">{DATE_COPY.loading}</p>}
        {venues.isError && !venues.data && <p className="p3-error" role="alert">{DATE_COPY.noVenues}</p>}
        <div className="p3-stack-s" data-testid="p3-venues">
          {(venues.data ?? []).map((v) => (
            <button key={v.id} type="button" className="p3-choice" disabled={busy || v.id === (detail?.venueOverride ?? s.default_venue_id)}
              onClick={() => void venueOverridePatch(v.id === s.default_venue_id ? null : v.id, venues.data).then(saveDetail)}>
              <span className="p3-row-t">{v.name}</span>
              <span className="p3-row-s">{v.id === s.default_venue_id ? DATE_COPY.usualPlace : [v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>
        <Err error={error} />
      </Sheet>
    );
  }
  if (step === 'edit-about' || step === 'edit-ticket') {
    const about = step === 'edit-about';
    const was = (about ? detail?.descriptionOverride ?? s.default_description : detail?.ticketUrlOverride ?? '') ?? '';
    const problem = !about && text.trim() ? ticketProblem(text.trim()) : null;
    const changed = text.trim() !== was.trim() && !!text.trim();
    return (
      <Sheet title={about ? L.aboutDate : L.ticket} onClose={onClose}>
        {backLink}
        <label className="p3-field" htmlFor="p3-own-text">{about ? L.aboutDate : L.ticket}</label>
        {about
          ? <textarea id="p3-own-text" className="p3-in" value={text} onChange={(e) => setText(e.target.value)} data-testid="p3-own-text" />
          : <input id="p3-own-text" className="p3-in" type="url" inputMode="url" value={text} onChange={(e) => setText(e.target.value)} data-testid="p3-own-text" />}
        {!about && <p className="p3-note">{DATE_COPY.ticketHint}</p>}
        {problem && <p className="p3-warn" role="alert">{problem}</p>}
        <Err error={error} />
        <Buttons>
          <button type="button" className="p3-btn" disabled={!changed || !!problem || busy} data-testid="p3-own-save"
            onClick={() => saveDetail(about ? { description: text } : { ticket_url: text })}>
            {L.saveOne}
          </button>
        </Buttons>
      </Sheet>
    );
  }
  if (step === 'edit-name' || step === 'edit-photos' || step === 'edit-price') {
    return <DateFieldSheet step={step} ws={ws} detail={detail} busy={busy} error={error} onSave={saveDetail} onBack={back} onClose={onClose} />;
  }
  if (step === 'edit-photo') {
    const upload = async (file: File | undefined) => {
      if (!file) return;
      const quick = checkFlyerFile(file);
      if (quick) return setError(FLYER_PROBLEM_COPY[quick]);
      setError(null);
      setText(DATE_COPY.uploading);
      try {
        const bad = await checkFlyerBytes(file);
        if (bad) throw new FlyerError(bad);
        const url = await uploadFlyer(s.id, await reencodeFlyer(file));
        setText('');
        saveDetail({ cover_image_url: url });
      } catch (e) {
        setText('');
        setError(e instanceof FlyerError ? FLYER_PROBLEM_COPY[e.problem] : commandErrorMessage(e));
      }
    };
    return (
      <Sheet title={L.photo} onClose={onClose}>
        {backLink}
        <label className="p3-field" htmlFor="p3-own-photo">{L.photo}</label>
        <input id="p3-own-photo" className="p3-in" type="file" accept={FLYER_ACCEPT} disabled={busy || !!text}
          onChange={(e) => void upload(e.target.files?.[0])} data-testid="p3-own-photo-file" />
        <p className="p3-note">{text || DATE_COPY.photoHint}</p>
        <Err error={error} />
      </Sheet>
    );
  }

  const cancelled = facts.state === 'cancelled';
  return (
    <Sheet title={start && !cancelled ? `${day}, ${timeWord(start)}` : day} onClose={onClose}>
      <p className="p3-note" data-testid="p3-date-state">
        {cancelled ? DATE_COPY.cancelledBody(detail?.cancellationReason ?? null) : facts.ownDetails || facts.ownTime ? L.ownChanges : L.sameUsual}
      </p>
      <div className="p3-stack-s" data-testid="p3-date-actions">
        {rows.map((r) => <ActionChoice key={r.action} row={r} busy={busy} onPick={pick} />)}
      </div>
      <Err error={error} />
      <P3NightGoing seriesId={ws.series.id} seriesName={ws.series.name.trim() || L.noName} nightKey={{ occurrenceId: d.id }} testId="p3-date-going" />
      {/* W2d: this date's sessions (organiser_get_occurrence_programme_v1), each opening the session sheet on "Just this date" */}
      <DateSessions ws={ws} today={today} date={d} onDone={onDone} />
    </Sheet>
  );
}

/** A cancelled date still holding its own name, photos or price: the owner arm refuses those keys until it is back. */
const fieldsOwned = (d: DateDetail) => d.titleOverride !== null || d.galleryOverride !== null || d.passesOverride !== null;

function StoredDate({ ws, id, today, onDone, onClose, onCancelEvent }: {
  ws: EventWorkspace; id: string; today: string; onDone: (d: Done) => void; onClose: () => void; onCancelEvent: () => void;
}) {
  // A write that committed but lost its response (a skip removes the date) reloads the page
  // under the error: keep the date the sheet opened on, so the error and its retry (the same
  // keys, a replay) stay on screen instead of the sheet vanishing.
  const live = ws.dates.find((x) => x.id === id);
  const [seen, setSeen] = useState<WorkspaceDate | undefined>(live);
  if (live && live !== seen) setSeen(live);
  const d = live ?? (seen?.id === id ? seen : undefined);
  const detail = useDateDetail(d ? id : null);
  if (!d) return null;
  if (!detail.data && (detail.isPending || detail.isError)) {
    return (
      <Sheet title={fullDate(d.occurrence_date, today)} onClose={onClose}>
        {detail.isPending ? <p className="p3-note">{DATE_COPY.loading}</p> : (
          <div className="p3-stack-s">
            <p className="p3-error" role="alert">{DATE_COPY.loadError}</p>
            <button type="button" className="p3-btn p3-btn-line" onClick={() => void detail.refetch()}>Try again</button>
          </div>
        )}
      </Sheet>
    );
  }
  return <OneDateSheet ws={ws} d={d} detail={detail.data} today={today} onDone={onDone} onClose={onClose} onCancelEvent={onCancelEvent} />;
}

/**
 * Every date sheet of a page (event page Coming rows, All dates). A one-off's "Cancel the
 * event" opens THE W2c CancelEventSheet (series.cancel_one_off): one control, one mapping.
 */
export function DateSheets({ ws, today, open, onClose, onDone }: {
  ws: EventWorkspace; today: string; open: DateOpen; onClose: () => void; onDone: (d: Done) => void;
}) {
  const [oneOff, setOneOff] = useState(false);
  const once = useSendOnce(ws.series.id);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const plan = cancelPlan(ws, today);
  const close = () => { setOneOff(false); onClose(); };
  const done = (d: Done) => { setOneOff(false); onDone(d); };
  if (!open) return null;
  if (oneOff && plan) return <CancelEventSheet name={ws.series.name.trim() || L.noName} plan={plan} send={sendOnce} onDone={done} onClose={close} />;
  if (open.kind === 'add') return <AddDateSheet ws={ws} today={today} onDone={done} onClose={close} />;
  if (open.kind === 'break') return <BreakSheet ws={ws} date={open.date} today={today} onDone={done} onClose={close} />;
  return <StoredDate ws={ws} id={open.id} today={today} onDone={done} onClose={close} onCancelEvent={() => setOneOff(true)} />;
}
