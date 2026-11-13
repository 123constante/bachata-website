import { useCallback, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { supportLinks } from '../../shared/support';
import { useEventWorkspace } from '../../shared/runCommands';
import { useOlderDates, withOlder } from '../data/olderDates';
import type { EventWorkspace } from '../../events/eventModel';
import { Sheet } from '../screens/Sheet';
import { RetryButton } from '../screens/parts';
import { useScanner, browserDeps } from '../door/camera';
import { CAMERA_WORDS } from '../door/model';
import '../door/door.css';
import type { Night } from '../events/eventsModel';
import { addName, checkIn, readNight, removeName, restoreName, scan, setNight, tokenOf, undoCheckIn, type Outcome } from './guestListApi';
import {
  PAGE, GUEST_VIEWS, TAB_WORD, doorLine, draftOf, editBlock, emptyWords, namesWord, reasonWords, scanWords, settingsArgs, settingsError,
  stateBanner, statusLine, type GuestEntry, type GuestListView, type GuestTab, type SettingsDraft,
} from './guestListModel';

const TAP = { minHeight: 44, minWidth: 44 } as const;
const FIELD = { display: 'grid', gap: 4 } as const;
const INPUT = { minHeight: 44, width: '100%', boxSizing: 'border-box', padding: '0 12px', fontSize: 16 } as const;
const WHY_ID = 'gl-why-id';
export const GL_KEY = 'organiser-guest-list';

/** The Guest list row of the night sheet. Real only behind organiserGuestListLive; until then a Coming soon card with a way to tell us. */
export function GuestListRow({ night, onOpen }: { night: Night; onOpen: () => void }) {
  const why = useId();
  const dated = night.status === 'live' || night.status === 'cancelled';
  const blocked = !dated ? 'Guest lists belong to a dated night. Add dates to this event first.' : null;
  return (
    <div className="p3-card p3-inset" data-testid="gl-row">
      <strong className="p3-row-t">Guest list</strong>
      <p className="p3-note" id={why} data-testid="gl-row-sub">{blocked ?? (flags.organiserGuestListLive ? 'Names, door check-in and sign-up for this night.' : 'Coming soon. Dancers cannot sign up in the app yet.')}</p>
      <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={!!blocked} aria-describedby={blocked ? why : undefined} onClick={onOpen} data-testid="gl-open">
        {flags.organiserGuestListLive ? 'Open the guest list' : 'About the guest list'}
      </button>
    </div>
  );
}

function ComingSoon({ onClose }: { onClose: () => void }) {
  const { email, whatsapp } = supportLinks();
  const href = email ? `mailto:${email}?subject=${encodeURIComponent('Guest list for my night')}` : whatsapp;
  return (
    <Sheet title="Guest list" onClose={onClose}>
      <p className="p3-note" data-testid="gl-soon">Coming soon. Soon you will switch a guest list on for one night, add names, and tick people in at the door. Nothing here has been turned on for your night.</p>
      {href && <a className="p3-btn p3-btn-line p3-btn-link" style={TAP} href={href} target="_blank" rel="noopener noreferrer" data-testid="gl-tell-us">Tell us what you need</a>}
      <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onClose}>Close</button>
    </Sheet>
  );
}

/** Opens the guest list of one night: resolves the night's occurrence id on the event's own read, then shows it. */
export function GuestListSheet({ night, onClose }: { night: Night; onClose: () => void }) {
  if (!flags.organiserGuestListLive) return <ComingSoon onClose={onClose} />;
  return <Resolve night={night} onClose={onClose} />;
}

function Resolve({ night, onClose }: { night: Night; onClose: () => void }) {
  const ws = useEventWorkspace(night.seriesId);
  if (ws.isPending) return <Sheet title="Loading the night&hellip;" onClose={onClose}><p className="p3-note">This takes a second.</p></Sheet>;
  if (ws.isError) return <Sheet title="We couldn&rsquo;t open this night" onClose={onClose}><p className="p3-note">Nothing has changed. Check your connection, then try again.</p><RetryButton onClick={() => void ws.refetch()} /></Sheet>;
  return <Resolved first={ws.data} night={night} onClose={onClose} />;
}

function Resolved({ first, night, onClose }: { first: EventWorkspace; night: Night; onClose: () => void }) {
  const older = useOlderDates(first, true);
  if (first.hasMore && (older.isPending || older.isError || older.data?.complete === false)) {
    if (older.isPending) return <Sheet title="Loading the dates&hellip;" onClose={onClose}><p className="p3-note">This event has a lot of dates. This takes a second.</p></Sheet>;
    return <Sheet title="We couldn&rsquo;t load every date" onClose={onClose}><p className="p3-note">Nothing has changed. Check your connection, then try again.</p><RetryButton onClick={() => void older.refetch()} /></Sheet>;
  }
  const ws = older.data ? withOlder(first, older.data) : first;
  const id = ws.dates.find((d) => d.occurrence_date === night.date)?.id;
  if (!id) return <Sheet title="This night is not on the list" onClose={onClose}><p className="p3-note">Open the event to see its dates. Nothing has changed.</p></Sheet>;
  return <GuestListLive occurrenceId={id} title={`${night.name}, ${night.dayLabel}`} onClose={onClose} />;
}

export function GuestListLive({ occurrenceId, title, onClose }: { occurrenceId: string; title: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<GuestTab>('names');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const view = tab === 'settings' ? 'names' : tab;
  const q = useQuery({ queryKey: [GL_KEY, occurrenceId, view, query, limit], queryFn: () => readNight(occurrenceId, view, query, limit), placeholderData: (p) => p });
  const reload = useCallback(() => qc.invalidateQueries({ queryKey: [GL_KEY, occurrenceId] }), [qc, occurrenceId]);
  /** One command at a time; the outcome is said in words and the list is read again. */
  const send = async (fn: () => Promise<Outcome>, done: string): Promise<boolean> => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fn();
      setNote(r.ok ? done : reasonWords(r.reason));
      if (r.ok) await reload();
      return r.ok;
    } catch {
      setNote('We could not reach the server. Nothing was changed. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const head = <p className="p3-note" data-testid="gl-title">{title}</p>;
  if (q.isPending) return <Sheet title="Guest list" onClose={onClose}>{head}<div className="p3-card p3-state" data-testid="gl-loading"><strong>Loading the names&hellip;</strong><p>Add is off until they load.</p></div></Sheet>;
  if (q.isError) return <Sheet title="Guest list" onClose={onClose}>{head}<p className="p3-error" role="alert" data-testid="gl-error">Nothing was changed: nobody was added, removed or checked in.</p><RetryButton onClick={() => void q.refetch()} /></Sheet>;
  const v = q.data;
  if (!v.ok) return <Sheet title="Guest list" onClose={onClose}>{head}<p className="p3-note" role="alert" data-testid="gl-refused">{reasonWords(v.reason)}</p><button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onClose}>Close</button></Sheet>;

  const block = editBlock(v);
  const banner = stateBanner(v);
  return (
    <Sheet title="Guest list" onClose={onClose}>
      {head}
      <p className="p3-note" data-testid="gl-status">{statusLine(v)}</p>
      {banner && <p className="p3-note" role="status" data-testid="gl-banner">{banner}</p>}
      {block && <p className="p3-note" id={WHY_ID} data-testid="gl-why">{block}</p>}
      <div className="p3-seg" role="group" aria-label="Guest list view">
        {GUEST_VIEWS.map((t) => (
          <button key={t} type="button" style={TAP} aria-pressed={tab === t} onClick={() => { setTab(t); setNote(null); setScanning(false); }} data-testid={`gl-tab-${t}`}>
            {TAB_WORD[t]}{t === 'names' ? ` ${v.counts.names}` : t === 'door' ? ` ${v.counts.inCount}/${v.counts.names}` : ''}
          </button>
        ))}
      </div>
      <div role="status" aria-live="polite">{note && <p className="p3-note" data-testid="gl-note">{note}</p>}</div>
      {tab === 'settings' ? (
        <Settings v={v} busy={busy} onSave={(d) => {
          const a = settingsArgs(v, d);
          return a ? send(() => setNight(occurrenceId, v.night.enabled, a.capacity, a.cutoff), 'Saved.') : Promise.resolve(true);
        }} onSwitch={(on) => void send(() => setNight(occurrenceId, on, v.night.capacityMax, v.night.cutoffTime ?? ''), on ? 'Guest list is on for this night.' : 'Guest list is off for this night.')} block={block} />
      ) : (
        <>
          {tab === 'names' && <AddName busy={busy} block={block} onAdd={(n, w) => send(() => addName(occurrenceId, n, w), `${n} added.`)} />}
          {tab === 'door' && <DoorTop v={v} blocked={!v.canCheckIn} scanning={scanning} onScan={() => setScanning((s) => !s)} occurrenceId={occurrenceId} onScanned={(m) => { setNote(m); void reload(); }} />}
          <label className="p3-field" style={FIELD}><span className="p3-row-s">Search names</span>
            <input className="p3-input" style={INPUT} type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} data-testid="gl-search" /></label>
          <Rows v={v} tab={tab} query={query} busy={busy}
            onRemove={(e) => void send(() => removeName(e.id, occurrenceId), `${e.firstName} removed.`)}
            onRestore={(e) => void send(() => restoreName(e.id, occurrenceId), `${e.firstName} is back on the list.`)}
            onCheck={(e) => void send(() => (e.checkedIn ? undoCheckIn(e.id, occurrenceId) : checkIn(e.id, occurrenceId)), e.checkedIn ? `${e.firstName} is not in.` : `${e.firstName} is in.`)} />
          {v.total > v.entries.length && <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={() => setLimit((l) => l + PAGE)} data-testid="gl-more">Show {Math.min(PAGE, v.total - v.entries.length)} more ({v.entries.length} of {v.total} shown)</button>}
          <p className="p3-note" data-testid="gl-public">Names on this list are public: dancers see first names only. Nobody on it is emailed.</p>
        </>
      )}
    </Sheet>
  );
}

function AddName({ busy, block, onAdd }: { busy: boolean; block: string | null; onAdd: (n: string, everyWeek: boolean) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [every, setEvery] = useState(false);
  const off = !!block || busy;
  const trimmed = name.trim();
  return (
    <form className="p3-stack-s" onSubmit={(e) => { e.preventDefault(); if (!trimmed || off) return; void onAdd(trimmed, every).then((ok) => { if (ok) setName(''); }); }} data-testid="gl-add">
      <label className="p3-field" style={FIELD}><span className="p3-row-s">Add a first name</span>
        <input className="p3-input" style={INPUT} value={name} maxLength={80} disabled={!!block} aria-describedby={block ? WHY_ID : undefined} onChange={(e) => setName(e.target.value)} data-testid="gl-add-name" /></label>
      <label className="p3-check" style={TAP}><input type="checkbox" checked={every} disabled={!!block} onChange={(e) => setEvery(e.target.checked)} data-testid="gl-add-every" /> <span>Every week</span></label>
      <button type="submit" className="p3-btn" style={TAP} disabled={off || !trimmed} aria-describedby={block ? WHY_ID : undefined} data-testid="gl-add-go">Add{every ? ' every week' : ' for this night'}</button>
      {!block && !trimmed && <p className="p3-note">Type a first name to add it. Names you add do not use up a place.</p>}
    </form>
  );
}

function Rows({ v, tab, query, busy, onRemove, onRestore, onCheck }: { v: GuestListView; tab: GuestTab; query: string; busy: boolean; onRemove: (e: GuestEntry) => void; onRestore: (e: GuestEntry) => void; onCheck: (e: GuestEntry) => void }) {
  const [removed, setRemoved] = useState<GuestEntry[]>([]);
  if (v.entries.length === 0 && removed.length === 0) return <p className="p3-note" data-testid="gl-empty">{emptyWords(v, query.trim() !== '')}</p>;
  const ro = editBlock(v);
  return (
    <ul className="p3-card p3-list" style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="gl-list" aria-label="Names">
      {v.entries.map((e) => (
        <li key={e.id} className="p3-row" data-testid="gl-entry">
          <span className="p3-grow"><span className="p3-row-t">{e.firstName}</span><br />
            <span className="p3-row-s">{[e.everyWeek && 'Every week', e.waitlist && 'Waitlist', e.byTeam ? 'Added by the team' : 'Added by themselves', e.checkedIn && 'In'].filter(Boolean).join(' · ')}</span></span>
          {tab === 'door' ? (
            <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={!v.canCheckIn || busy} onClick={() => onCheck(e)} data-testid="gl-check">{e.checkedIn ? 'Undo' : 'Check in'}</button>
          ) : (
            <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={!!ro || busy} title={ro ?? undefined} onClick={() => { setRemoved((r) => [...r, e]); onRemove(e); }} data-testid="gl-remove" aria-label={`Remove ${e.firstName}`}>Remove</button>
          )}
        </li>
      ))}
      {removed.filter((r) => !v.entries.some((e) => e.id === r.id)).map((e) => (
        <li key={`u${e.id}`} className="p3-row" data-testid="gl-undo-row">
          <span className="p3-grow"><span className="p3-row-s">{e.firstName} was removed.</span></span>
          <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={!!ro || busy} onClick={() => { setRemoved((r) => r.filter((x) => x.id !== e.id)); onRestore(e); }} data-testid="gl-undo">Undo</button>
        </li>
      ))}
    </ul>
  );
}

function DoorTop({ v, blocked, scanning, onScan, occurrenceId, onScanned }: { v: GuestListView; blocked: boolean; scanning: boolean; onScan: () => void; occurrenceId: string; onScanned: (m: string) => void }) {
  const pct = v.counts.names ? Math.round((v.counts.inCount / v.counts.names) * 100) : 0;
  return (
    <div className="p3-stack-s" data-testid="gl-door">
      <strong className="p3-row-t" data-testid="gl-door-count">{doorLine(v.counts)}</strong>
      <progress value={pct} max={100} aria-label={doorLine(v.counts)} style={{ width: '100%' }} />
      <button type="button" className="p3-btn" style={TAP} disabled={blocked} aria-describedby={blocked ? WHY_ID : undefined} onClick={onScan} data-testid="gl-scan">{scanning ? 'Stop scanning' : 'Scan a QR code'}</button>
      {scanning && !blocked && <Scanner occurrenceId={occurrenceId} onScanned={onScanned} />}
    </div>
  );
}

function Scanner({ occurrenceId, onScanned }: { occurrenceId: string; onScanned: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const last = useRef('');
  const onCode = useCallback((raw: string) => {
    const t = tokenOf(raw);
    if (!t || busy.current || t === last.current) return;
    busy.current = true;
    last.current = t;
    scan(occurrenceId, t)
      .then((r) => onScanned(scanWords(r.ok ? { ok: true, firstName: r.firstName, alreadyIn: r.alreadyIn, counts: r.counts } : { ok: false, reason: r.reason })))
      .catch(() => { last.current = ''; onScanned('We could not reach the server. Nobody was checked in. Try again.'); })
      .finally(() => { busy.current = false; window.setTimeout(() => { last.current = ''; }, 2500); });
  }, [occurrenceId, onScanned]);
  const { state, start } = useScanner(video, true, onCode, browserDeps);
  return (
    <div className="p3-door-cam" data-testid="gl-camera" data-cam={state}>
      <video ref={video} playsInline muted aria-hidden="true" />
      {state !== 'on' && (
        <div className="p3-door-camwords-box">
          <p className="p3-door-camwords">{CAMERA_WORDS[state as Exclude<typeof state, 'on'>]}</p>
          {(state === 'none' || state === 'failed' || state === 'ask') && <button type="button" className="p3-btn p3-door-tap" onClick={start}>Start camera</button>}
        </div>
      )}
    </div>
  );
}

function Settings({ v, busy, block, onSave, onSwitch }: { v: GuestListView; busy: boolean; block: string | null; onSave: (d: SettingsDraft) => Promise<boolean>; onSwitch: (on: boolean) => void }) {
  const [d, setD] = useState<SettingsDraft>(() => draftOf(v));
  const why = useId();
  const err = settingsError(d);
  const untouched = settingsArgs(v, d) === null;
  const off = !!block || busy;
  return (
    <div className="p3-stack-s" data-testid="gl-settings">
      <label className="p3-check p3-check-switch" data-testid="gl-switch-row">
        <input type="checkbox" role="switch" checked={v.night.enabled} disabled={off} aria-describedby={block ? WHY_ID : undefined} onChange={(e) => onSwitch(e.target.checked)} data-testid="gl-switch" />
        <span className="p3-switch" aria-hidden="true" />
        <span className="p3-grow"><span className="p3-row-t">Guest list on this night</span><br /><span className="p3-row-s">{v.night.enabled ? 'Dancers can add their names.' : 'Dancers cannot add names.'}</span></span>
      </label>
      <label className="p3-field" style={FIELD}><span className="p3-row-s">Places (blank = no limit)</span>
        <input className="p3-input" style={INPUT} inputMode="numeric" value={d.places} disabled={off} onChange={(e) => setD({ ...d, places: e.target.value })} data-testid="gl-places" /></label>
      <label className="p3-field" style={FIELD}><span className="p3-row-s">Closes at (like 22:00, blank = none)</span>
        <input className="p3-input" style={INPUT} value={d.closes} disabled={off} placeholder="22:00" onChange={(e) => setD({ ...d, closes: e.target.value })} data-testid="gl-closes" /></label>
      {err && <p className="p3-error" role="alert" data-testid="gl-settings-error">{err}</p>}
      <button type="button" className="p3-btn" style={TAP} disabled={off || !!err || untouched} aria-describedby={block ? WHY_ID : untouched ? why : undefined} onClick={() => void onSave(d)} data-testid="gl-save">Save settings</button>
      {!block && <p className="p3-note" id={why} data-testid="gl-settings-why">{(untouched ? 'Change places or closing time to save. Names you add yourself never use up a place.' : `${namesWord(v.counts.names)} on the list now.`)}</p>}
    </div>
  );
}
