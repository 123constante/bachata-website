import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import '../theme/p3.css';
import './door.css';
import { P3_PATHS } from '../shell/paths';
import { ticketDoorCode } from './doorFlags';
import {
  ACTION_LABEL,
  CAMERA_INAPP_LINE,
  CAMERA_RETRY_LABEL,
  CAMERA_START_LABEL,
  CAMERA_STILL_BLOCKED,
  CAMERA_WORDS,
  cameraSteps,
  detectBrowser,
  RESULT_TABLE,
  cameraDead,
  classifyCode,
  codeBoxBlock,
  counterText,
  createScanGate,
  londonClock,
  parseCode,
  personOf,
  type CameraState,
  type CheckIn,
  type DoorResult,
  type NextAction,
  type TypedCode,
} from './model';
import { checkInById, checkInByCode, checkInTicket, doorKeys, fetchDoorList, isSignedOut, type DoorList } from './data';
import { browserDeps, buzz, useScanner, type ScannerDeps } from './camera';

/*
 * The door scanner (layout C): a Scan tab (camera, the one answer, the code box) and a
 * Tonight's list tab (first name, quantity, In / Not in). Flag ticketDoorCode OFF: the list is
 * read-only and the code box takes the QR token only, exactly as v1. ON: the code box also takes
 * the 6-character short code (ticket_check_in_by_code_v1, rate-limited) and every Not in row has
 * a Check in button (ticket_check_in_by_id_v1, never rate-limited), so too_many_attempts always
 * has a way forward.
 */

type Tab = 'scan' | 'list';
/** from = where the check was started: a list check-in shows its answer on the list. */
interface Shown { kind: DoorResult; c: CheckIn | null; from?: Tab }

/** Shown after Check again clears a check-in refusal: names only controls that are then on screen. */
const RECHECK_OK_NOTE = 'You can check tickets now. Scan or type the code again.';

export function DoorScreen() {
  const { seriesId = '' } = useParams();
  return <Door seriesId={seriesId} />;
}

export function Door({ seriesId, deps = browserDeps, shortCodes = ticketDoorCode }: { seriesId: string; deps?: ScannerDeps; shortCodes?: boolean }) {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: doorKeys.list(user?.id, seriesId),
    queryFn: () => fetchDoorList(seriesId),
    enabled: !!user?.id && !!seriesId,
    staleTime: 15_000,
    retry: 1,
    // Offline the default networkMode would leave the list paused on "Loading" for ever; run it so it
    // fails fast into "Check the signal, then try again" (p3-prefix-d r1 S2).
    networkMode: 'always',
  });
  const [tab, setTab] = useState<Tab>('scan');
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  /** The list row whose Check in is in flight (its pending state). */
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [counts, setCounts] = useState<{ in: number; total: number } | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recheckNote, setRecheckNote] = useState<string | null>(null);
  const gate = useRef(createScanGate());
  const busyRef = useRef(false);
  // the code whose answer is on screen: held in front of the camera it never re-fires (an ok
  // would turn into ALREADY IN after 2.5 s); Scan next or another code clears it
  const onScreen = useRef<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const listCounts = list.data && list.data.inCount != null && list.data.totalCount != null ? { in: list.data.inCount, total: list.data.totalCount } : null;
  const shownCounts = counts ?? listCounts;
  const notAllowed = list.data?.result === 'not_allowed' || shown?.kind === 'not_allowed';
  const noneSold = list.data?.result === 'ok' && list.data.totalCount === 0;
  const out = signedOut || isSignedOut(list.error);

  const run = useCallback(async (code: string, call: () => Promise<CheckIn>, from: Tab = 'scan') => {
    // one check at a time, whatever started it: no double submit
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const c = await call();
      setRecheckNote(null);
      onScreen.current = code;
      setShown({ kind: c.result, c, from });
      buzz(RESULT_TABLE[c.result].vibrate);
      if (c.in_count != null && c.total_count != null) setCounts({ in: c.in_count, total: c.total_count });
      if (c.result === 'ok' || c.result === 'already_in') void qc.invalidateQueries({ queryKey: doorKeys.list(uid, seriesId) });
    } catch (e) {
      if (isSignedOut(e)) setSignedOut(true);
      else {
        setShown({ kind: 'no_signal', c: null });
        setTab('list');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setPendingId(null);
    }
  }, [qc, seriesId, uid]);

  const onCamera = useCallback((raw: string) => {
    const code = parseCode(raw);
    if (!code || busyRef.current || code === onScreen.current || !gate.current.accept(code)) return;
    void run(code, () => checkInTicket(code, seriesId));
  }, [run, seriesId]);

  const video = useRef<HTMLVideoElement>(null);
  const keep = !shown || RESULT_TABLE[shown.kind].keepScanning;
  const camOn = tab === 'scan' && !notAllowed && !noneSold && !out && keep;
  const { state: cam, start: startCamera, denials } = useScanner(video, camOn, onCamera, deps);

  // a camera that is blocked or missing will not come back by itself: open the list once
  const opened = useRef(false);
  useEffect(() => {
    if ((cam === 'none' || cam === 'failed') && !opened.current) { opened.current = true; setTab('list'); }
  }, [cam]);

  // "Check again" on the refused card: one list read, no check-in write. Ok replaces the card;
  // refused or a network error leaves it as it was (no toast).
  // A refusal from a check-in (typed or scanned code) is cleared too, so the scanner and code box
  // come back with a note saying so. Offline shows a one-line message under the button.
  const recheck = useCallback(async () => {
    setRechecking(true);
    setRecheckNote(null);
    try {
      const r = await list.refetch();
      if (r.isError) setRecheckNote('No signal, try again');
      else if (r.data?.result === 'ok') {
        if (shown?.kind === 'not_allowed') {
          // access is back: drop the check-in refusal so the scanner and code box return
          setShown(null);
          gate.current.reset();
          setTab('scan'); // the list tab has no code box: go where the note points
          setRecheckNote(RECHECK_OK_NOTE);
        }
        onScreen.current = null;
      }
    } catch { setRecheckNote('No signal, try again'); } finally { setRechecking(false); }
  }, [list, shown]);

  const act = (a: NextAction) => {
    if (a === 'scan') { setShown(null); onScreen.current = null; gate.current.reset(); setTab('scan'); }
    if (a === 'list') setTab('list');
    if (a === 'type') {
      setShown(null);
      onScreen.current = null;
      setTab('scan');
      requestAnimationFrame(() => codeInput.current?.focus({ preventScroll: true }));
    }
  };
  const submitCode = (t: TypedCode) => {
    gate.current.reset();
    setTab('scan');
    void run(t.code, () => (t.kind === 'short' ? checkInByCode(t.code, seriesId) : checkInTicket(t.code, seriesId)));
  };
  const checkInRow = (ticketId: string) => {
    if (busyRef.current) return;
    setPendingId(ticketId);
    void run(`id:${ticketId}`, () => checkInById(ticketId, seriesId), 'list');
  };

  const total = list.data?.result === 'ok' ? list.data.totalCount : null;
  return (
    <div className="p3-theme p3-frame p3-door" data-testid="door-screen">
      <header className="p3-top p3-door-top">
        <Link className="p3-link" to={P3_PATHS.event(seriesId)} data-testid="door-back">&larr; Event</Link>
        <h1>Door</h1>
      </header>
      <nav className="p3-door-tabs" aria-label="Door">
        <button type="button" aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => setTab('scan')} data-testid="door-tab-scan">Scan</button>
        <button type="button" aria-current={tab === 'list' ? 'page' : undefined} onClick={() => setTab('list')} data-testid="door-tab-list">
          Tonight&rsquo;s list{total != null ? ` (${total})` : ''}
        </button>
      </nav>
      <main className="p3-door-main">
        {!out && !notAllowed && recheckNote && <p className="p3-note p3-door-pad p3-door-recheck-note" role="status" data-testid="door-recheck-note">{recheckNote}</p>}
        {out ? (
          <div className="p3-card p3-door-pad" data-testid="door-signed-out">
            <strong>You were signed out</strong>
            <p className="p3-note">Sign in again to check tickets.</p>
            <button type="button" className="p3-btn p3-door-wide" onClick={() => window.location.reload()}>Sign in again</button>
          </div>
        ) : tab === 'scan' ? (
          <ScanTab
            video={video} cam={cam} counts={shownCounts} shown={shown} busy={busy} notAllowed={notAllowed}
            noneSold={noneSold} seriesId={seriesId} act={act} codeInput={codeInput} onCode={submitCode} shortCodes={shortCodes}
            startCamera={startCamera} tries={denials} openList={() => setTab('list')}
            recheck={recheck} rechecking={rechecking} recheckNote={recheckNote}
          />
        ) : (
          <ListTab
            retryCamera={() => { setTab('scan'); startCamera(); }}
            recheck={recheck} rechecking={rechecking} recheckNote={recheckNote}
            list={list} shown={shown} cam={cam} busy={busy} codeInput={codeInput} onCode={submitCode} act={act} seriesId={seriesId}
            shortCodes={shortCodes} pendingId={pendingId} onCheckIn={checkInRow} notAllowed={notAllowed}
          />
        )}
      </main>
    </div>
  );
}

function Counter({ counts }: { counts: { in: number; total: number } | null }) {
  const t = counterText(counts?.in, counts?.total);
  if (!t) return null;
  const left = counts ? counts.total - counts.in : 0;
  return (
    <span className="p3-door-count" data-testid="door-count">
      {t}{left > 0 && <small> &middot; {left} to come</small>}
    </span>
  );
}

interface ScanProps {
  video: React.RefObject<HTMLVideoElement>; cam: CameraState; counts: { in: number; total: number } | null;
  shown: Shown | null; busy: boolean; notAllowed: boolean; noneSold: boolean; seriesId: string;
  act: (a: NextAction) => void; codeInput: React.RefObject<HTMLInputElement>; onCode: (code: TypedCode) => void; shortCodes: boolean;
  startCamera: () => void; tries: number; openList: () => void;
  recheck: () => void; rechecking: boolean; recheckNote: string | null;
}

function ScanTab({ video, cam, startCamera, tries, openList, counts, shown, busy, notAllowed, noneSold, seriesId, act, codeInput, onCode, shortCodes, recheck, rechecking, recheckNote }: ScanProps) {
  if (notAllowed) return <div className="p3-door-pad"><ResultCard shown={shown?.kind === 'not_allowed' ? shown : { kind: 'not_allowed', c: null }} act={act} recheck={recheck} rechecking={rechecking} recheckNote={recheckNote} /></div>;
  if (noneSold) return <EmptySold seriesId={seriesId} />;
  const helpShown = (cam === 'ask' || cam === 'denied') && !shown;
  return (
    <>
      {helpShown && (
        <CameraHelp cam={cam} tries={tries} startCamera={startCamera} openList={openList} counts={counts} />
      )}
      {!helpShown && <div className="p3-door-pad p3-door-countrow"><Counter counts={counts} /></div>}
      <div className={`p3-door-cam${shown ? ' p3-door-cam-short' : ''}${helpShown ? ' p3-door-cam-gone' : ''}`} data-testid="door-camera" data-cam={cam}>
        <video ref={video} playsInline muted aria-hidden="true" />
        {cam === 'on' ? (
          <div className="p3-door-finder" aria-hidden="true"><i /><i /><i /><i /></div>
        ) : (
          <div className="p3-door-camwords-box">
            <p className="p3-door-camwords" data-testid="door-cam-words">{CAMERA_WORDS[cam]}</p>
            {(cam === 'none' || cam === 'failed') && (
              <button type="button" className="p3-btn p3-door-tap" onClick={startCamera} data-testid="door-cam-retry">{CAMERA_RETRY_LABEL}</button>
            )}
          </div>
        )}
        {cam === 'on' && !shown && <p className="p3-door-hint">Point the camera at the QR code</p>}
      </div>
      <div className="p3-door-pad" aria-live="polite">
        {busy ? (
          <div className="p3-card" data-testid="door-checking"><strong>Checking&hellip;</strong></div>
        ) : shown ? (
          <ResultCard shown={shown} act={act} />
        ) : (
          <CodeBox inputRef={codeInput} busy={busy} onCode={onCode} shortCodes={shortCodes} />
        )}
      </div>
    </>
  );
}

/** The calm card before the camera question, and the plain steps after a "Don't allow". Code box and list stay below. */
function CameraHelp({ cam, tries, startCamera, openList, counts }: { cam: 'ask' | 'denied'; tries: number; startCamera: () => void; openList: () => void; counts: { in: number; total: number } | null }) {
  const steps = cameraSteps(detectBrowser(typeof navigator === 'undefined' ? '' : navigator.userAgent));
  return (
    <div className="p3-door-pad">
      <Counter counts={counts} />
      <section className="p3-card p3-door-help" data-testid="door-cam-help" data-cam={cam}>
        {cam === 'ask' ? (
          <>
            <strong>To scan tickets, this page needs your camera.</strong>
            <p className="p3-note">Tap Start camera, then tap Allow.</p>
            <button type="button" className="p3-btn p3-door-wide p3-door-tap" onClick={startCamera} data-testid="door-cam-start">{CAMERA_START_LABEL}</button>
          </>
        ) : (
          <>
            <strong>{tries > 1 ? CAMERA_STILL_BLOCKED : 'The camera is blocked for this page.'}</strong>
            <ol className="p3-door-steps" data-testid="door-cam-steps">{steps.map((t) => <li key={t}>{t}</li>)}</ol>
            <p className="p3-note">{CAMERA_INAPP_LINE}</p>
            <button type="button" className="p3-btn p3-door-wide p3-door-tap" onClick={startCamera} data-testid="door-cam-retry">{CAMERA_RETRY_LABEL}</button>
          </>
        )}
        <p className="p3-note">No camera? Type the code below, or <button type="button" className="p3-door-linkbtn" onClick={openList} data-testid="door-cam-openlist">open tonight&rsquo;s list</button>.</p>
      </section>
    </div>
  );
}

function ResultCard({ shown, act, recheck, rechecking, recheckNote }: { shown: Shown; act: (a: NextAction) => void; recheck?: () => void; rechecking?: boolean; recheckNote?: string | null }) {
  const row = RESULT_TABLE[shown.kind];
  const who = personOf(shown.c);
  const head = useRef<HTMLElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, [shown]);
  const acts = row.actions.filter((a) => a !== 'none');
  return (
    <section className="p3-door-res" data-testid="door-result" data-state={shown.kind}>
      <div className={`p3-door-band p3-door-band-${row.band}`}>
        <b ref={head} tabIndex={-1} data-testid="door-headline">{row.headline}</b>
        <span data-testid="door-sub">{row.sub(shown.c)}</span>
      </div>
      <div className="p3-door-body">
        {who && (
          <>
            <div className="p3-door-who" data-testid="door-who">{who.name}</div>
            {who.meta && <div className="p3-note">{who.meta}</div>}
          </>
        )}
        <p className="p3-door-do" data-testid="door-detail">{row.detail(shown.c)}</p>
        {shown.kind === 'not_allowed' && recheck && (
          <div className="p3-door-acts">
            <button type="button" className="p3-btn p3-door-big" onClick={recheck} disabled={rechecking} data-testid="door-act-recheck">
              {rechecking ? 'Checking\u2026' : 'Check again'}
            </button>
            <Link className="p3-btn p3-btn-line p3-door-big" to={P3_PATHS.events} data-testid="door-notallowed-back">Back to events</Link>
          </div>
        )}
        {shown.kind === 'not_allowed' && recheck && recheckNote && (
          <p className="p3-note p3-door-recheck-note" role="alert" data-testid="door-recheck-note">{recheckNote}</p>
        )}
        {acts.length > 0 && (
          <div className="p3-door-acts">
            {acts.map((a, i) => (
              <button key={a} type="button" className={`p3-btn p3-door-big${i < acts.length - 1 ? ' p3-btn-line' : ''}`} onClick={() => act(a)} data-testid={`door-act-${a}`}>
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CodeBox({ inputRef, busy, onCode, shortCodes }: { inputRef: React.RefObject<HTMLInputElement>; busy: boolean; onCode: (code: TypedCode) => void; shortCodes: boolean }) {
  const id = useId();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const block = codeBoxBlock(text, busy, shortCodes);
  return (
    <form
      className="p3-door-codebox"
      data-testid="door-codebox"
      onSubmit={(e) => {
        e.preventDefault();
        const code = classifyCode(text, shortCodes);
        // empty or malformed input sends nothing; the reason shows under the box
        if (block || !code) { if (shortCodes) setTried(true); return; }
        setText('');
        setTried(false);
        onCode(code);
      }}
    >
      <label htmlFor={id} className="p3-door-label">
        {shortCodes ? <>Ticket code (6 letters and numbers, from the buyer&rsquo;s ticket email)</> : <>Ticket code (from the buyer&rsquo;s ticket email)</>}
      </label>
      <div className="p3-door-coderow">
        <input
          id={id} ref={inputRef} className="p3-in p3-door-in" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={shortCodes ? 'K7M 2QX' : undefined}
          autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go"
          aria-describedby={block ? `${id}-why` : undefined} data-testid="door-code-input"
        />
        <button type="submit" className="p3-btn p3-door-check" aria-disabled={block ? 'true' : undefined} data-testid="door-code-check">
          {busy && shortCodes ? <>Checking&hellip;</> : shortCodes ? 'Check in' : 'Check'}
        </button>
      </div>
      {block && (text || tried) && <p id={`${id}-why`} className="p3-note" data-testid="door-code-why">{block}</p>}
    </form>
  );
}

function EmptySold({ seriesId }: { seriesId: string }) {
  return (
    <div className="p3-door-pad">
      <div className="p3-door-count" data-testid="door-count">0 of 0 in</div>
      <div className="p3-card p3-door-empty" data-testid="door-empty">
        <strong>No tickets sold yet</strong>
        <p className="p3-note">There is nothing to scan until someone buys. Set up tickets and share the event from the event page.</p>
        <Link className="p3-btn p3-door-wide p3-door-btnlink" to={P3_PATHS.event(seriesId)}>Go to the event page</Link>
      </div>
    </div>
  );
}

interface ListProps {
  list: { data?: DoorList; isPending: boolean; isError: boolean; refetch: () => unknown; isFetching: boolean };
  shown: Shown | null; cam: CameraState; busy: boolean;
  codeInput: React.RefObject<HTMLInputElement>; onCode: (code: TypedCode) => void; act: (a: NextAction) => void; seriesId: string;
  shortCodes: boolean; pendingId: string | null; onCheckIn: (ticketId: string) => void; notAllowed: boolean;
  retryCamera: () => void; recheck: () => void; rechecking: boolean; recheckNote: string | null;
}

function ListTab({ list, shown, cam, busy, codeInput, onCode, act, seriesId, shortCodes, pendingId, onCheckIn, notAllowed, retryCamera, recheck, rechecking, recheckNote }: ListProps) {
  const [q, setQ] = useState('');
  const searchId = useId();
  const rows = list.data?.rows;
  const term = q.trim().toLowerCase();
  const hits = useMemo(() => (term ? (rows ?? []).filter((r) => (r.firstName ?? '').toLowerCase().includes(term)) : rows ?? []), [rows, term]);
  const offline = shown?.kind === 'no_signal';
  const loadedAt = list.data ? londonClock(new Date(list.data.loadedAt).toISOString()) : null;

  const top = (
    <>
      {offline && (
        <div className="p3-door-banner" role="status" data-testid="door-offline-banner">
          NO SIGNAL &mdash; codes cannot be checked right now.{loadedAt ? ` This list was loaded at ${loadedAt}.` : ''} Find the name below, then scan again when signal is back.
        </div>
      )}
      {shown?.kind === 'too_many_attempts' && shown.from !== 'list' && !(list.isError && !list.data) && (
        <div className="p3-door-banner" role="status" data-testid="door-paused-banner">
          {RESULT_TABLE.too_many_attempts.sub(null)}. Find the name below and tap Check in.
        </div>
      )}
      {shown && shown.from === 'list' && shown.kind !== 'no_signal' && (
        <div className="p3-door-pad"><ResultCard shown={shown} act={act} /></div>
      )}
      {cameraDead(cam) && (
        <div className="p3-door-pad p3-door-stack">
          <p className="p3-door-camnote" data-testid="door-cam-dead">{CAMERA_WORDS[cam as 'denied']}</p>
          {(cam === 'none' || cam === 'failed') && (
            <button type="button" className="p3-btn p3-door-wide p3-door-tap" onClick={retryCamera} data-testid="door-cam-retry">{CAMERA_RETRY_LABEL}</button>
          )}
          <CodeBox inputRef={codeInput} busy={busy} onCode={onCode} shortCodes={shortCodes} />
        </div>
      )}
    </>
  );

  if (list.isPending) {
    return <>{top}<div className="p3-door-pad"><div className="p3-card" data-testid="door-list-loading"><strong>Loading tonight&rsquo;s list&hellip;</strong>
      <button type="button" className="p3-btn p3-btn-line p3-door-wide" onClick={() => act('scan')}>Back to scanning</button></div></div></>;
  }
  if (list.isError && !list.data) {
    return <>{top}<div className="p3-door-pad"><div className="p3-card" data-testid="door-list-error"><strong>Could not load tonight&rsquo;s list</strong>
      <p className="p3-note">Check the signal, then try again. Scanning still works when it is back.</p>
      <button type="button" className="p3-btn p3-door-wide" onClick={() => void list.refetch()} disabled={list.isFetching}>Try again</button></div></div></>;
  }
  const d = list.data!;
  if (d.result === 'not_allowed' || notAllowed) {
    return <div className="p3-door-pad"><ResultCard shown={{ kind: 'not_allowed', c: null }} act={act} recheck={recheck} rechecking={rechecking} recheckNote={recheckNote} /></div>;
  }
  if (!rows?.length) return <>{top}<EmptySold seriesId={seriesId} /></>;
  return (
    <>
      {top}
      <div className="p3-door-pad p3-door-stack">
        <label htmlFor={searchId} className="p3-door-label">Search first name</label>
        <input id={searchId} className="p3-in" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" data-testid="door-search" />
        <p className="p3-note" data-testid="door-list-note">
          {counterText(d.inCount, d.totalCount)} &middot; A&ndash;Z &middot; first name only. One row per ticket; &times;2 means an order of 2.
          {shortCodes ? ' When the person is at the door, tap Check in on their row.' : ' Read only: to check someone in, scan or type their code.'}
        </p>
        {shortCodes && busy && <p className="p3-note" data-testid="door-row-why">Checking the last ticket&hellip; wait for the answer.</p>}
        {d.truncated && <p className="p3-note" data-testid="door-truncated">Showing the first 500 tickets. Search to find a name further down.</p>}
      </div>
      {hits.length ? (
        <ul className="p3-door-list" data-testid="door-list">
          {hits.map((r) => (
            <li key={r.ticketId} className="p3-door-row" data-testid="door-row">
              <span className="p3-door-nm">{r.firstName ?? 'No name given'}{r.typeName && <small>{r.typeName}</small>}</span>
              <span className="p3-door-q" aria-label={r.quantity ? `order of ${r.quantity}` : undefined}>{r.quantity ? <>&times;{r.quantity}</> : null}</span>
              {shortCodes && !r.checkedInAt ? (
                <button
                  type="button" className="p3-btn p3-door-rowbtn" data-testid="door-row-checkin"
                  aria-disabled={busy ? 'true' : undefined}
                  aria-label={`Check in ${r.firstName ?? 'no name given'}`}
                  onClick={() => { if (!busy) onCheckIn(r.ticketId); }}
                >
                  {pendingId === r.ticketId ? <>Checking&hellip;</> : 'Check in'}
                </button>
              ) : (
                <span className={`p3-door-st${r.checkedInAt ? ' p3-door-st-in' : ''}`} data-testid="door-row-status">{r.checkedInAt ? 'In' : 'Not in'}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="p3-door-pad"><div className="p3-card" data-testid="door-no-match">
          <strong>No one called &ldquo;{q.trim()}&rdquo; on the list</strong>
          <button type="button" className="p3-btn p3-btn-line p3-door-wide" onClick={() => setQ('')}>Clear search</button>
        </div></div>
      )}
    </>
  );
}

export default DoorScreen;
