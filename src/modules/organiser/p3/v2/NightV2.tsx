import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventWorkspace } from '../../events/eventModel';
import { cancelCommand, envelope, newIdempotencyKey, uncancelCommand } from '../../shared/seriesCommands';
import { invalidatePublicEventCaches } from '@/modules/organiser/shared/publicCache';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import { dateDetailQueryKey, fetchDateDetail, runOccurrenceCommand } from '../../shared/selfServeApi';
import type { DateDetail } from '../../shared/seriesModel';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { venueName } from '../../shared/publicVenues';
import { venueOverridePatch } from '../../dates/venueOverride';
import { FLYER_ACCEPT, FLYER_PROBLEM_COPY, FlyerError, checkFlyerBytes, checkFlyerFile, reencodeFlyer } from '../../shared/flyerModel';
import { uploadFlyer } from '../../shared/flyerUploadApi';
import { buildPayload, isDirty, lineupSummary, notEditableCopy, removeSessionsConfirmCopy, type DraftSession } from '../../shared/programmeModel';
import { dateOff, draftsOf, isExtra, useDateProgramme } from '../data/sessions';
import { nightLinkOf } from '../dash/shareLinks';
import { WorkspaceGate } from '../screens/EventPage';
import { useCancelReasons } from '../screens/CancelEventSheet';
import { Sheet } from '../screens/Sheet';
import { VenueList } from '../screens/VenueList';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from '../r4/EventChoice';
import { V2 } from './copy';
import { NIGHT_ABOUT_MAX, nightFieldState, nightSessionsOff, type EditorDraft, type NightPatch } from './editorModel';
import { SaveBar } from './SaveBar';
import { useEditor } from './useEditor';
import './v2.css';

type TextKey = 'title' | 'description';

/** The value this night has saved for a field (event_view_p5), null when it follows the event. */
const savedOf = (detail: DateDetail | undefined, k: TextKey): string | null =>
  (k === 'title' ? detail?.titleOverride : detail?.descriptionOverride) ?? null;

/** One "Name for this night" / "About this night" row: the current value, Usual or Changed, Back to usual. */
function NightText({ k, label, usual, saved, savedValue, patch, max, off, onSet }: {
  k: TextKey; label: string; usual: string; saved: readonly string[]; savedValue: string | null; patch: NightPatch; max?: number; off: boolean;
  onSet: (v: string | null | undefined) => void;
}) {
  const state = nightFieldState(k, saved, patch);
  const value = k in patch ? ((patch[k] as string | null) ?? '') : (savedValue ?? '');
  const Input = k === 'description' ? 'textarea' : 'input';
  const change = (v: string) => {
    if (v === (savedValue ?? '')) onSet(undefined); // typed back to what is saved: no change
    else onSet(v === '' ? null : v); // emptied: back to usual
  };
  return (
    <div className="r4-field" data-testid={`v2-night-${k}`}>
      <label htmlFor={`v2-n-${k}`} className="v2-label-above">{label}</label>
      <Input id={`v2-n-${k}`} className="r4-in v2-tap" value={value} placeholder={usual}
        maxLength={max} disabled={off} onChange={(e) => change(e.target.value)} data-testid={`v2-night-${k}-in`} />
      <div className="v2-row" style={{ padding: 0 }}>
        <span className="v2-row-help v2-row-t" data-testid={`v2-night-${k}-state`}>{state === 'changed' ? V2.changed : V2.usual}</span>
        {state === 'changed' && <button type="button" className="v2-link" disabled={off} onClick={() => onSet(savedValue == null ? undefined : null)} data-testid={`v2-night-${k}-usual`}>{V2.backToUsual}</button>}
      </div>
    </div>
  );
}

/** Sessions that night: each session with Cancel for this night / Bring back; the change waits in the save bar. */
function NightSessionsCard({ ws, occurrenceId, day, why, off, draft, update }: {
  ws: EventWorkspace; occurrenceId: string; day: string; why: string | null; off: boolean;
  draft: EditorDraft; update: (fn: (d: EditorDraft) => EditorDraft) => void;
}) {
  const prog = useDateProgramme(why ? null : occurrenceId);
  const held = draft.sessions?.[occurrenceId];
  const original = prog.data ? draftsOf(prog.data) : [];
  const rows = (held?.rows as DraftSession[] | undefined) ?? original;
  const readOnly = prog.data && !prog.data.editable ? notEditableCopy(prog.data.notEditableReason) : null;
  const [problem, setProblem] = useState<string | null>(null);
  const toggle = (key: string, offNow: boolean) => {
    if (!prog.data) return;
    const built = dateOff(rows, key, offNow);
    if (built.problem) { setProblem(built.problem); return; }
    setProblem(null);
    const next = rows.map((d) => (d.key === key ? { ...d, removed: offNow } : d));
    const changed = isDirty(next, original.length) && JSON.stringify(buildPayload(next)) !== JSON.stringify(buildPayload(original));
    const version = prog.data.version;
    update((d) => {
      const s = { ...(d.sessions ?? {}) };
      if (changed) s[occurrenceId] = { version, payload: buildPayload(next), rows: next };
      else delete s[occurrenceId];
      return { ...d, sessions: s };
    });
  };
  const blocked = why ?? readOnly;
  return (
    <section className="r4-card v2-card" data-testid="v2-night-sessions">
      <h2 className="r4-label v2-card-h">{V2.nightSessions}</h2>
      {blocked && <p className="v2-row-help" data-testid="v2-night-sessions-why">{blocked}</p>}
      {!why && prog.isPending && <p className="r4-hint">Loading the sessions&hellip;</p>}
      {!why && prog.isError && <button type="button" className="r4-chip v2-tap" onClick={() => void prog.refetch()}>Try again</button>}
      {prog.data && rows.length === 0 && <p className="v2-row-help" data-testid="v2-night-sessions-empty">{V2.noNightSessions}</p>}
      {rows.map((r) => {
        const was = original.find((o) => o.key === r.key);
        const newlyOff = r.removed && !!was && !was.removed;
        const people = lineupSummary(r.people);
        return (
          <div key={r.key} className={r.removed ? 'v2-grey' : undefined} data-testid="v2-night-session">
            <div className="v2-row" style={{ padding: 0 }}>
              <span className="v2-row-t">{r.title || 'Session'}{r.start ? ` \u00b7 ${r.start}${r.end ? `\u2013${r.end}` : ''}` : ''}</span>
              <button type="button" className="v2-link" disabled={off || !!blocked} onClick={() => toggle(r.key, !r.removed)} data-testid={r.removed ? 'v2-session-bring-back' : 'v2-session-cancel'}>
                {r.removed ? V2.sessionBringBack : isExtra(r) ? V2.sessionRemove : V2.sessionCancel}
              </button>
            </div>
            {people && <p className="v2-row-help">{people}</p>}
            {r.removed && !newlyOff && <p className="v2-row-help">{V2.sessionOff}</p>}
            {newlyOff && <p className="v2-row-help" role="note" data-testid="v2-session-warning">{removeSessionsConfirmCopy([r.title], day).consequence}</p>}
          </div>
        );
      })}
      {problem && <p className="r4-err" role="alert">{problem}</p>}
      <div className={blocked ? 'v2-grey' : undefined}>
        <Link to={P3_PATHS.eventAll(ws.series.id)} aria-disabled={!!blocked} className="v2-row" onClick={(e) => { if (blocked) e.preventDefault(); }}><span className="v2-row-t">{V2.addNightSession}</span></Link>
      </div>
    </section>
  );
}

function Night({ ws, occurrenceId }: { ws: EventWorkspace; occurrenceId: string }) {
  const date = ws.dates.find((d) => d.id === occurrenceId) ?? null;
  const [uploading, setUploading] = useState(false);
  const ed = useEditor(ws, { uploading });
  const { id, today, changes, save, toast, why, undo, doSave, venues } = ed;
  const c = useEventChoice();
  const row = c.rows.find((r) => r.id === id) ?? null;
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: dateDetailQueryKey(occurrenceId), queryFn: () => fetchDateDetail(occurrenceId), enabled: !!date });
  const day = date ? ed.dayOf(occurrenceId) : '';
  const patch: NightPatch = ed.draft.nights[occurrenceId] ?? {};
  const nightDirty = Object.keys(patch).length > 0 || !!ed.draft.sessions?.[occurrenceId];
  const [cancelling, setCancelling] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picErr, setPicErr] = useState<string | null>(null);
  if (!date) return <p className="r4-sub" data-testid="v2-night-missing">This date is not on the event any more.</p>;

  const cancelled = date.lifecycle_status === 'cancelled';
  const setPatch = (fn: (p: NightPatch) => NightPatch) => ed.update((d) => {
    const n = fn(d.nights[occurrenceId] ?? {});
    const nights = { ...d.nights };
    if (Object.keys(n).length) nights[occurrenceId] = n; else delete nights[occurrenceId];
    return { ...d, nights };
  });
  const setKey = (k: keyof NightPatch) => (v: string | null | undefined) => setPatch((p) => {
    const n = { ...p };
    if (v === undefined) delete n[k]; else n[k] = v;
    return n;
  });
  const link = typeof window === 'undefined' || !row ? null : nightLinkOf(window.location.origin, row.publicEventRef);
  const act = async (command: ReturnType<typeof uncancelCommand>) => {
    setBusy(true); setErr(null);
    try {
      await runOccurrenceCommand(envelope(date.id, date.version, command, newIdempotencyKey()));
      setCancelling(false);
    } catch (e) { setErr(commandErrorMessage(e)); } finally {
      invalidatePublicEventCaches(qc);
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(id) });
      void qc.invalidateQueries({ queryKey: dateDetailQueryKey(occurrenceId) });
      setBusy(false);
    }
  };
  const sessionsWhy = nightSessionsOff(date, today, false);
  const off = save.busy || cancelled;
  const savedVenue = detail.data?.venueOverride ?? null;
  const shownVenue = 'venue_id' in patch ? (patch.venue_id ?? ws.series.default_venue_id) : (savedVenue ?? ws.series.default_venue_id);
  const pickVenue = async (venueId: string) => {
    setPicking(false);
    const usual = venueId === ws.series.default_venue_id;
    if ((usual && !savedVenue) || venueId === savedVenue) { setPatch((p) => { const n = { ...p }; delete n.venue_id; delete n.city_id; return n; }); return; }
    const vp = await venueOverridePatch(usual ? null : venueId, venues.data);
    setPatch((p) => ({ ...p, ...vp }));
  };
  const savedPic = detail.data?.coverImageOverride ?? null;
  const shownPic = 'cover_image_url' in patch ? (patch.cover_image_url ?? ws.series.default_cover_image_url) : (savedPic ?? ws.series.default_cover_image_url);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const quick = checkFlyerFile(file);
    if (quick) { setPicErr(FLYER_PROBLEM_COPY[quick]); return; }
    setPicErr(null); setUploading(true);
    try {
      const bad = await checkFlyerBytes(file);
      if (bad) throw new FlyerError(bad);
      const url = await uploadFlyer(id, await reencodeFlyer(file));
      setKey('cover_image_url')(url);
    } catch (e) {
      setPicErr(e instanceof FlyerError ? FLYER_PROBLEM_COPY[e.problem] : commandErrorMessage(e));
    } finally { setUploading(false); }
  };

  return (
    <div className="r4-stack r4-form" data-testid="v2-night" data-id={occurrenceId}>
      <div>
        <Link className="p3-link" to={P3_PATHS.eventEdit(id)} data-testid="p3-edit-back">&larr; Back</Link>
        <div className="v2-row" style={{ padding: 0 }}>
          <h1 className="r4-h1 v2-row-t" data-testid="v2-night-date">{day}</h1>
          {!cancelled && <button type="button" className="v2-link" disabled={nightDirty || busy} onClick={() => setCancelling(true)} data-testid="v2-night-cancel">{V2.cancelNight}</button>}
        </div>
        <p className="v2-sub-line" title={ws.series.name}>{ws.series.name}</p>
        <p className="r4-hint">{V2.nightOnly(day)}</p>
        {nightDirty && !cancelled && <p className="v2-row-help">{V2.saveFirst}</p>}
      </div>

      {cancelled && (
        <div className="v2-box" data-testid="v2-night-cancelled">
          <p>{V2.nightCancelled}</p>
          <button type="button" className="r4-btn r4-btn-line v2-tap" disabled={busy} onClick={() => void act(uncancelCommand())} data-testid="v2-night-bring-back">{V2.bringNightBack}</button>
        </div>
      )}
      {err && <p className="r4-err" role="alert">{err}</p>}

      <section className="r4-card v2-card" aria-labelledby="v2-n-share">
        <h2 id="v2-n-share" className="r4-label v2-card-h">{V2.shareNight}</h2>
        <div className="r4-chips">
          <button type="button" className="r4-btn r4-btn-line v2-tap" disabled={!link}
            onClick={() => { if (link) void navigator.clipboard?.writeText(link).then(() => toast.show(V2.copied)); }} data-testid="v2-night-copy">{V2.copyLink}</button>
          <button type="button" className="r4-btn r4-btn-line v2-tap" disabled={!link || typeof navigator.share !== 'function'}
            onClick={() => { if (link) void navigator.share?.({ url: link, title: ws.series.name }).catch(() => undefined); }} data-testid="v2-night-share">{V2.share}</button>
        </div>
      </section>

      <section className="r4-card v2-card">
        {detail.isError && <p className="r4-err" role="alert">{V2.nightReadFail} <button type="button" className="v2-link" onClick={() => void detail.refetch()}>Try again</button></p>}
        <NightText k="title" label={V2.nightName} usual={ws.series.name} saved={date.override_keys} savedValue={savedOf(detail.data, 'title')} patch={patch} off={off || detail.isPending} onSet={setKey('title')} />
        <NightText k="description" label={V2.nightAbout} usual={ws.series.default_description ?? ''} saved={date.override_keys} savedValue={savedOf(detail.data, 'description')} patch={patch} max={NIGHT_ABOUT_MAX} off={off || detail.isPending} onSet={setKey('description')} />
        <button type="button" className="v2-row" disabled={off || detail.isPending} onClick={() => setPicking(true)} data-testid="v2-night-venue">
          <span className="v2-row-t">{V2.venue}: {venueName(venues.data, shownVenue) ?? (shownVenue ? 'Loading' : 'Not set')}</span>
          <span className="v2-row-help" data-testid="v2-night-venue-state">{nightFieldState('venue_id', date.override_keys, patch) === 'changed' ? V2.changed : V2.usual}</span>
        </button>
        {nightFieldState('venue_id', date.override_keys, patch) === 'changed' && (
          <button type="button" className="v2-link" disabled={off} onClick={() => void pickVenue(ws.series.default_venue_id ?? '')} data-testid="v2-night-venue-usual">{V2.backToUsual}</button>
        )}
        <div className="r4-field" data-testid="v2-night-picture">
          <label htmlFor="v2-n-pic" className="v2-label-above">{V2.nightPicture}</label>
          {shownPic && <img src={shownPic} alt="" className="v2-thumb" />}
          <input id="v2-n-pic" type="file" accept={FLYER_ACCEPT} className="r4-in v2-tap" disabled={off || uploading} onChange={(e) => void upload(e.target.files?.[0])} data-testid="v2-night-picture-file" />
          <div className="v2-row" style={{ padding: 0 }}>
            <span className="v2-row-help v2-row-t" data-testid="v2-night-picture-state">{uploading ? V2.uploading : nightFieldState('cover_image_url', date.override_keys, patch) === 'changed' ? V2.changed : V2.usual}</span>
            {nightFieldState('cover_image_url', date.override_keys, patch) === 'changed' && (
              <button type="button" className="v2-link" disabled={off || uploading} onClick={() => setKey('cover_image_url')(savedPic ? null : undefined)} data-testid="v2-night-picture-usual">{V2.backToUsual}</button>
            )}
          </div>
          {picErr && <p className="r4-err" role="alert">{picErr}</p>}
        </div>
      </section>

      <section className="r4-card v2-card" data-testid="v2-night-tickets-frame">
        <h2 className="r4-label v2-card-h">{V2.nightTickets}</h2>
        <p className="v2-slot">{V2.s2Slot}</p>
        <Link to={P3_PATHS.event(id)} className="v2-row"><span className="v2-row-t">{V2.nightGuestList}</span></Link>
      </section>

      <NightSessionsCard ws={ws} occurrenceId={occurrenceId} day={day} why={sessionsWhy} off={off} draft={ed.draft} update={ed.update} />

      {toast.node}
      <SaveBar changes={changes} busy={save.busy} failed={save.failed} why={why} onUndo={undo} onSave={() => void doSave()} />
      {save.error && !save.failed.length && <p className="r4-err" role="alert">{save.error}</p>}

      {ed.leaveSheet}
      {picking && (
        <Sheet title={V2.venue} onClose={() => setPicking(false)}>
          <VenueList venues={venues} testId="v2-night-venues">
            {(list) => list.map((v) => (
              <button key={v.id} type="button" className="p3-choice v2-tap" aria-pressed={v.id === shownVenue} onClick={() => void pickVenue(v.id)}>
                <span className="p3-row-t">{v.name}</span>
                <span className="p3-row-s">{[v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </VenueList>
        </Sheet>
      )}
      {cancelling && <CancelNightSheet day={day} busy={busy} onKeep={() => setCancelling(false)} onCancel={(reason) => void act(cancelCommand(reason))} />}
    </div>
  );
}

/** Cancel this night: reasons from cancellation_reasons (never hard-coded), acts at once, outside the save bar. */
function CancelNightSheet({ day, busy, onKeep, onCancel }: { day: string; busy: boolean; onKeep: () => void; onCancel: (reason: string) => void }) {
  const reasons = useCancelReasons();
  const [pick, setPick] = useState<string | null>(null);
  return (
    <Sheet title={`${V2.cancelNight}: ${day}`} onClose={onKeep} locked={busy}>
      <div className="r4-stack r4-sheet" data-testid="v2-cancel-night">
        <p className="r4-sub">{V2.cancelBody} {V2.cancelNow}</p>
        {reasons.isPending && <p className="r4-hint">Loading the reasons&hellip;</p>}
        {reasons.isError && <button type="button" className="r4-chip v2-tap" onClick={() => void reasons.refetch()}>Try again</button>}
        <div className="r4-chips" role="group" aria-label="Why?">
          {(reasons.data ?? []).map((r) => (
            <button key={r.key} type="button" className="r4-chip v2-tap" aria-pressed={pick === r.label} disabled={busy} onClick={() => setPick(r.label)}>{r.label}</button>
          ))}
        </div>
        <button type="button" className="r4-btn v2-tap" disabled={!pick || busy} onClick={() => pick && onCancel(pick)} data-testid="v2-cancel-night-go">{busy ? V2.saving : V2.cancelNight}</button>
        <button type="button" className="r4-btn r4-btn-line v2-tap" disabled={busy} onClick={onKeep}>{V2.keepNight}</button>
      </div>
    </Sheet>
  );
}

/** Route `events/:seriesId/night/:occurrenceId` (flag organiserEditorV2 only). */
export function NightV2Route() {
  const { occurrenceId = '' } = useParams();
  return <WorkspaceGate>{(ws) => <Night key={`${ws.series.id}:${occurrenceId}`} ws={ws} occurrenceId={occurrenceId} />}</WorkspaceGate>;
}
