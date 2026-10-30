import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import '../theme/p3.css';
import './door.css';
import { P3_PATHS } from '../shell/paths';
import {
  ACTION_LABEL,
  CAMERA_WORDS,
  RESULT_TABLE,
  cameraDead,
  codeBoxBlock,
  counterText,
  createScanGate,
  londonClock,
  parseCode,
  personOf,
  type CheckIn,
  type DoorResult,
  type NextAction,
} from './model';
import { checkInTicket, doorKeys, fetchDoorList, isSignedOut, type DoorList } from './data';
import { browserDeps, buzz, useScanner, type ScannerDeps } from './camera';

/*
 * The door scanner (layout C): a Scan tab (camera, the one answer, the code box) and a
 * Tonight's list tab (first name, quantity, In / Not in). The list is READ-ONLY in v1: there is
 * no RPC that checks someone in by ticket id, so a guest without a scannable QR is checked in by
 * typing the code from their ticket email into the code box.
 */

type Tab = 'scan' | 'list';
interface Shown { kind: DoorResult; c: CheckIn | null }

export function DoorScreen() {
  const { seriesId = '' } = useParams();
  return <Door seriesId={seriesId} />;
}

export function Door({ seriesId, deps = browserDeps }: { seriesId: string; deps?: ScannerDeps }) {
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
  const [signedOut, setSignedOut] = useState(false);
  const [counts, setCounts] = useState<{ in: number; total: number } | null>(null);
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

  const run = useCallback(async (code: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const c = await checkInTicket(code, seriesId);
      onScreen.current = code;
      setShown({ kind: c.result, c });
      buzz(RESULT_TABLE[c.result].vibrate);
      if (c.in_count != null && c.total_count != null) setCounts({ in: c.in_count, total: c.total_count });
      if (c.result === 'ok') void qc.invalidateQueries({ queryKey: doorKeys.list(uid, seriesId) });
    } catch (e) {
      if (isSignedOut(e)) setSignedOut(true);
      else {
        setShown({ kind: 'no_signal', c: null });
        setTab('list');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [qc, seriesId, uid]);

  const onCamera = useCallback((raw: string) => {
    const code = parseCode(raw);
    if (!code || busyRef.current || code === onScreen.current || !gate.current.accept(code)) return;
    void run(code);
  }, [run]);

  const video = useRef<HTMLVideoElement>(null);
  const keep = !shown || RESULT_TABLE[shown.kind].keepScanning;
  const camOn = tab === 'scan' && !notAllowed && !noneSold && !out && keep;
  const cam = useScanner(video, camOn, onCamera, deps);

  // a camera that is blocked or missing will not come back by itself: open the list once
  const opened = useRef(false);
  useEffect(() => {
    if (cameraDead(cam) && !opened.current) { opened.current = true; setTab('list'); }
  }, [cam]);

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
  const submitCode = (code: string) => {
    gate.current.reset();
    setTab('scan');
    void run(code);
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
        {out ? (
          <div className="p3-card p3-door-pad" data-testid="door-signed-out">
            <strong>You were signed out</strong>
            <p className="p3-note">Sign in again to check tickets.</p>
            <button type="button" className="p3-btn p3-door-wide" onClick={() => window.location.reload()}>Sign in again</button>
          </div>
        ) : tab === 'scan' ? (
          <ScanTab
            video={video} cam={cam} counts={shownCounts} shown={shown} busy={busy} notAllowed={notAllowed}
            noneSold={noneSold} seriesId={seriesId} act={act} codeInput={codeInput} onCode={submitCode}
          />
        ) : (
          <ListTab list={list} shown={shown} cam={cam} busy={busy} codeInput={codeInput} onCode={submitCode} act={act} seriesId={seriesId} />
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
  video: React.RefObject<HTMLVideoElement>; cam: ReturnType<typeof useScanner>; counts: { in: number; total: number } | null;
  shown: Shown | null; busy: boolean; notAllowed: boolean; noneSold: boolean; seriesId: string;
  act: (a: NextAction) => void; codeInput: React.RefObject<HTMLInputElement>; onCode: (code: string) => void;
}

function ScanTab({ video, cam, counts, shown, busy, notAllowed, noneSold, seriesId, act, codeInput, onCode }: ScanProps) {
  if (notAllowed) return <div className="p3-door-pad"><ResultCard shown={shown?.kind === 'not_allowed' ? shown : { kind: 'not_allowed', c: null }} act={act} /></div>;
  if (noneSold) return <EmptySold seriesId={seriesId} />;
  return (
    <>
      <div className={`p3-door-cam${shown ? ' p3-door-cam-short' : ''}`} data-testid="door-camera" data-cam={cam}>
        <video ref={video} playsInline muted aria-hidden="true" />
        {cam === 'on' ? (
          <div className="p3-door-finder" aria-hidden="true"><i /><i /><i /><i /></div>
        ) : (
          <p className="p3-door-camwords" data-testid="door-cam-words">{CAMERA_WORDS[cam]}</p>
        )}
        <div className="p3-door-camtop"><Counter counts={counts} /></div>
        {cam === 'on' && !shown && <p className="p3-door-hint">Point the camera at the QR code</p>}
      </div>
      <div className="p3-door-pad" aria-live="polite">
        {busy ? (
          <div className="p3-card" data-testid="door-checking"><strong>Checking&hellip;</strong></div>
        ) : shown ? (
          <ResultCard shown={shown} act={act} />
        ) : (
          <CodeBox inputRef={codeInput} busy={busy} onCode={onCode} />
        )}
      </div>
    </>
  );
}

function ResultCard({ shown, act }: { shown: Shown; act: (a: NextAction) => void }) {
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

function CodeBox({ inputRef, busy, onCode }: { inputRef: React.RefObject<HTMLInputElement>; busy: boolean; onCode: (code: string) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const block = codeBoxBlock(text, busy);
  return (
    <form
      className="p3-door-codebox"
      data-testid="door-codebox"
      onSubmit={(e) => {
        e.preventDefault();
        const code = parseCode(text);
        if (block || !code) return;
        setText('');
        onCode(code);
      }}
    >
      <label htmlFor={id} className="p3-door-label">Ticket code (from the buyer&rsquo;s ticket email)</label>
      <div className="p3-door-coderow">
        <input
          id={id} ref={inputRef} className="p3-in p3-door-in" value={text} onChange={(e) => setText(e.target.value)}
          autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="go"
          aria-describedby={block ? `${id}-why` : undefined} data-testid="door-code-input"
        />
        <button type="submit" className="p3-btn p3-door-check" aria-disabled={block ? 'true' : undefined} data-testid="door-code-check">Check</button>
      </div>
      {block && text && <p id={`${id}-why`} className="p3-note" data-testid="door-code-why">{block}</p>}
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
  shown: Shown | null; cam: ReturnType<typeof useScanner>; busy: boolean;
  codeInput: React.RefObject<HTMLInputElement>; onCode: (code: string) => void; act: (a: NextAction) => void; seriesId: string;
}

function ListTab({ list, shown, cam, busy, codeInput, onCode, act, seriesId }: ListProps) {
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
      {cameraDead(cam) && (
        <div className="p3-door-pad p3-door-stack">
          <p className="p3-door-camnote" data-testid="door-cam-dead">{CAMERA_WORDS[cam as 'denied']}</p>
          <CodeBox inputRef={codeInput} busy={busy} onCode={onCode} />
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
  if (d.result === 'not_allowed') {
    return <div className="p3-door-pad"><ResultCard shown={{ kind: 'not_allowed', c: null }} act={act} /></div>;
  }
  if (!rows?.length) return <>{top}<EmptySold seriesId={seriesId} /></>;
  return (
    <>
      {top}
      <div className="p3-door-pad p3-door-stack">
        <label htmlFor={searchId} className="p3-door-label">Search first name</label>
        <input id={searchId} className="p3-in" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" data-testid="door-search" />
        <p className="p3-note" data-testid="door-list-note">
          {counterText(d.inCount, d.totalCount)} &middot; A&ndash;Z &middot; first name only. One row per ticket; &times;2 means an order of 2. Read only: to check someone in, scan or type their code.
        </p>
        {d.truncated && <p className="p3-note" data-testid="door-truncated">Showing the first 500 tickets. Search to find a name further down.</p>}
      </div>
      {hits.length ? (
        <ul className="p3-door-list" data-testid="door-list">
          {hits.map((r) => (
            <li key={r.ticketId} className="p3-door-row" data-testid="door-row">
              <span className="p3-door-nm">{r.firstName ?? 'No name given'}{r.typeName && <small>{r.typeName}</small>}</span>
              <span className="p3-door-q" aria-label={r.quantity ? `order of ${r.quantity}` : undefined}>{r.quantity ? <>&times;{r.quantity}</> : null}</span>
              <span className={`p3-door-st${r.checkedInAt ? ' p3-door-st-in' : ''}`} data-testid="door-row-status">{r.checkedInAt ? 'In' : 'Not in'}</span>
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
