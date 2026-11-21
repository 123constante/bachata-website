import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventWorkspace } from '../../events/eventModel';
import { typeWord } from '../../events/programmeSeriesModel';
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

/**
 * One prototype night row (nrow): label, the value this night shows, "Usual" or "Changed for this night",
 * a chevron, and Back to usual beside it. `htmlFor` makes the row a label for a hidden file input.
 */
function NightRow({ testId, label, value, changed, off, onOpen, htmlFor, onUsual, about }: {
  testId: string; label: string; value: string; changed: boolean; off: boolean;
  onOpen?: () => void; htmlFor?: string; onUsual: () => void; about?: boolean;
}) {
  const body: ReactNode = (
    <>
      <span className="v2-k">{label}</span>
      <span className="v2-rb">
        <span className={`v2-rt${value ? '' : ' v2-soft'}${about ? ' v2-clamp' : ''}`}>{value || V2.add}</span>
        {changed
          ? <span className="v2-ovr" data-testid={`${testId}-state`}>{V2.changed}</span>
          : value ? <span className="v2-rl" data-testid={`${testId}-state`}>{V2.usual}</span> : null}
      </span>
    </>
  );
  const cls = `v2-nr-go v2-go${label.length > 12 ? ' v2-stk' : ''}`;
  return (
    <div className="v2-r v2-nr">
      {htmlFor
        ? <label htmlFor={htmlFor} className={`${cls}${off ? ' v2-off' : ''}`} aria-disabled={off} data-testid={testId}>{body}</label>
        : <button type="button" className={cls} disabled={off} onClick={onOpen} data-testid={testId}>{body}</button>}
      {changed && <button type="button" className="v2-chg" disabled={off} onClick={onUsual} data-testid={`${testId}-usual`}>{V2.backToUsual}</button>}
    </div>
  );
}

/** The Name / About sheet: the night's own text; emptied = back to usual, typed back to the saved value = no change. */
function NightTextSheet({ k, label, usual, savedValue, patch, max, off, onSet, onClose }: {
  k: TextKey; label: string; usual: string; savedValue: string | null; patch: NightPatch; max?: number; off: boolean;
  onSet: (v: string | null | undefined) => void; onClose: () => void;
}) {
  const value = k in patch ? ((patch[k] as string | null) ?? '') : (savedValue ?? '');
  const change = (v: string) => {
    if (v === (savedValue ?? '')) onSet(undefined);
    else onSet(v === '' ? null : v);
  };
  return (
    <Sheet title={label} onClose={onClose}>
      <div className="v2-f">
        <label htmlFor={`v2-n-${k}`} className="v2-fl">{label}</label>
        <textarea id={`v2-n-${k}`} className="v2-in" rows={k === 'description' ? 6 : 3} value={value} placeholder={usual}
          maxLength={max} disabled={off} onChange={(e) => change(e.target.value)} data-testid={`v2-night-${k}-in`} />
      </div>
      <button type="button" className="r4-btn v2-tap" onClick={onClose} data-testid="v2-sheet-done">{V2.done}</button>
    </Sheet>
  );
}

/** Sessions that night: time over "to" time, title, type and people, Cancel / Bring back; the change waits in the save bar. */
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
  const full = P3_PATHS.eventAll(ws.series.id);
  const stay = (e: { preventDefault: () => void }) => { if (blocked) e.preventDefault(); };
  return (
    <section className="v2-stack" aria-labelledby="v2-n-sess" data-testid="v2-night-sessions">
      <h2 id="v2-n-sess" className="v2-lbl">{V2.nightSessions}</h2>
      <div className="v2-card">
        {blocked && <p className="v2-empty" data-testid="v2-night-sessions-why">{blocked}</p>}
        {!why && prog.isPending && <p className="v2-empty">{V2.loading}</p>}
        {!why && prog.isError && <div className="v2-r"><button type="button" className="v2-chg" onClick={() => void prog.refetch()}>Try again</button></div>}
        {prog.data && rows.length === 0 && <p className="v2-empty" data-testid="v2-night-sessions-empty">{V2.noNightSessions}</p>}
        {rows.map((r) => {
          const was = original.find((o) => o.key === r.key);
          const newlyOff = r.removed && !!was && !was.removed;
          const title = r.title.trim() || typeWord(r.type);
          const line = [typeWord(r.type), lineupSummary(r.people)].filter(Boolean).join(' · ');
          return (
            <div key={r.key} className={`v2-sess v2-nsess${r.removed ? ' v2-cx' : ''}`} data-testid="v2-night-session">
              <Link to={full} className="v2-sess-go" aria-disabled={!!blocked} onClick={stay}>
                <span className="v2-time">{r.start || '–'}{r.end && <small>{V2.to(r.end)}</small>}</span>
                <span className="v2-rb">
                  <span className="v2-rt">{title}</span>
                  <span className="v2-rl">{line}</span>
                  {r.removed && !newlyOff && <span className="v2-ovr v2-x">{V2.sessionOff}</span>}
                  {!r.removed && isExtra(r) && <span className="v2-ovr">{V2.thisNightOnly}</span>}
                  {newlyOff && <span className="v2-rl v2-wrap" role="note" data-testid="v2-session-warning">{removeSessionsConfirmCopy([r.title], day).consequence}</span>}
                </span>
              </Link>
              <button type="button" className="v2-chg" disabled={off || !!blocked} onClick={() => toggle(r.key, !r.removed)}
                aria-label={r.removed ? undefined : V2.cancelSession(title)} data-testid={r.removed ? 'v2-session-bring-back' : 'v2-session-cancel'}>
                {r.removed ? V2.sessionBringBack : isExtra(r) ? V2.sessionRemove : V2.sessionCancel}
              </button>
            </div>
          );
        })}
        {problem && <p className="v2-err" role="alert">{problem}</p>}
        <div className={`v2-r${blocked ? ' v2-off' : ''}`}>
          <Link to={full} aria-disabled={!!blocked} className="v2-chg" onClick={stay} data-testid="v2-night-add-session">{V2.addNightSession}</Link>
        </div>
      </div>
      {!blocked && <p className="v2-foot">{V2.sessionsFoot}</p>}
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
  const [editing, setEditing] = useState<TextKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picErr, setPicErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const textOff = off || detail.isPending;
  const changedOf = (k: keyof NightPatch) => nightFieldState(k, date.override_keys, patch) === 'changed';
  // the value a text row shows: this night's own text, else the event's
  const textOf = (k: TextKey, usual: string) => {
    const own = k in patch ? (patch[k] as string | null) : savedOf(detail.data, k);
    return (own ?? usual).replace(/\s+/g, ' ').trim();
  };
  const textUsual = (k: TextKey) => () => setKey(k)(savedOf(detail.data, k) == null ? undefined : null);
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
  const picChanged = changedOf('cover_image_url');
  const ownPic = 'cover_image_url' in patch ? patch.cover_image_url : savedPic;
  const picValue = uploading ? V2.uploading : ownPic ? V2.ownPicture : ws.series.default_cover_image_url ? V2.usualFlyer : '';
  const upload = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
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
  const reason = detail.data?.cancellationReason ?? null;

  return (
    <div className="v2-page" data-testid="v2-night" data-id={occurrenceId}>
      <header className="v2-top">
        <span className="v2-bk"><Link className="p3-link" to={P3_PATHS.eventEdit(id)} aria-label={V2.backToEvent} data-testid="p3-edit-back">{V2.backToEvent}</Link></span>
        <span className="v2-tt">
          <span className="v2-tt1" title={ws.series.name}>{ws.series.name}</span>
          <span className="v2-tt2" data-testid="v2-night-date">{V2.dayOnly(day)}</span>
        </span>
        {!cancelled && (
          <button type="button" className="v2-topcx" disabled={nightDirty || busy} onClick={() => setCancelling(true)} data-testid="v2-night-cancel">{V2.cancelNight}</button>
        )}
      </header>

      <div className="v2-main">
        {cancelled ? (
          <div className="v2-cxbox" data-testid="v2-night-cancelled">
            <span><b>{V2.nightCancelled}</b> {V2.nightCancelledSee(reason)}</span>
            <button type="button" className="v2-btn v2-sec" disabled={busy} onClick={() => void act(uncancelCommand())} data-testid="v2-night-bring-back">{V2.bringNightBack}</button>
          </div>
        ) : (
          <div className="v2-info" data-testid="v2-night-only">{V2.nightOnly(day)}</div>
        )}
        {nightDirty && !cancelled && <p className="v2-foot" data-testid="v2-night-save-first">{V2.cancelSaveFirst}</p>}
        {err && <p className="v2-err" role="alert">{err}</p>}

        <section className="v2-stack" aria-labelledby="v2-n-share">
          <h2 id="v2-n-share" className="v2-lbl">{V2.shareNight}</h2>
          <div className="v2-btns">
            <button type="button" className="v2-btn v2-sec v2-sm" disabled={!link}
              onClick={() => { if (link) void navigator.clipboard?.writeText(link).then(() => toast.show(V2.copied)); }} data-testid="v2-night-copy">{V2.copyLink}</button>
            <button type="button" className="v2-btn v2-sec v2-sm" disabled={!link || typeof navigator.share !== 'function'}
              onClick={() => { if (link) void navigator.share?.({ url: link, title: ws.series.name }).catch(() => undefined); }} data-testid="v2-night-share">{V2.share}</button>
          </div>
        </section>

        <div className={cancelled ? 'v2-col v2-dim' : 'v2-col'} aria-disabled={cancelled}>
          <section className="v2-stack" aria-labelledby="v2-n-name">
            <h2 id="v2-n-name" className="v2-lbl">{V2.nameAndAbout}</h2>
            <div className="v2-card">
              {detail.isError && <p className="v2-err" role="alert">{V2.nightReadFail} <button type="button" className="v2-chg" onClick={() => void detail.refetch()}>Try again</button></p>}
              <NightRow testId="v2-night-title" label={V2.nightName} value={textOf('title', ws.series.name)} changed={changedOf('title')} off={textOff}
                onOpen={() => setEditing('title')} onUsual={textUsual('title')} />
              <NightRow testId="v2-night-description" label={V2.nightAbout} value={textOf('description', ws.series.default_description ?? '')} changed={changedOf('description')} off={textOff}
                onOpen={() => setEditing('description')} onUsual={textUsual('description')} about />
            </div>
          </section>

          <section className="v2-stack" aria-labelledby="v2-n-venue">
            <h2 id="v2-n-venue" className="v2-lbl">{V2.venue}</h2>
            <div className="v2-card">
              <NightRow testId="v2-night-venue" label={V2.venue} value={venueName(venues.data, shownVenue) ?? (shownVenue ? V2.loading : '')}
                changed={changedOf('venue_id')} off={textOff} onOpen={() => setPicking(true)} onUsual={() => void pickVenue(ws.series.default_venue_id ?? '')} />
            </div>
          </section>

          <section className="v2-stack" aria-labelledby="v2-n-pic-h" data-testid="v2-night-picture">
            <h2 id="v2-n-pic-h" className="v2-lbl">{V2.nightPicture}</h2>
            <div className="v2-card">
              <input ref={fileRef} id="v2-n-pic" type="file" accept={FLYER_ACCEPT} className="v2-file" disabled={off || uploading}
                aria-label={V2.choosePicture} onChange={(e) => void upload(e.target.files?.[0])} data-testid="v2-night-picture-file" />
              <NightRow testId="v2-night-picture-row" htmlFor="v2-n-pic" label={V2.nightPicture} value={picValue} changed={picChanged} off={off || uploading}
                onUsual={() => setKey('cover_image_url')(savedPic ? null : undefined)} />
              {picErr && <p className="v2-err" role="alert">{picErr}</p>}
            </div>
          </section>

          <section className="v2-stack" aria-labelledby="v2-n-tix" data-testid="v2-night-tickets-frame">
            <h2 id="v2-n-tix" className="v2-lbl">{V2.tickets}</h2>
            <div className="v2-card"><p className="v2-empty">{V2.s2Slot}</p></div>
          </section>

          <div className="v2-card">
            <Link to={P3_PATHS.event(id)} className="v2-r v2-go v2-tall" data-testid="v2-night-guest">
              <span className="v2-rb"><span className="v2-rt">{V2.nightGuestList}</span><span className="v2-rl">{V2.nightGuestLine(day)}</span></span>
            </Link>
          </div>

          <NightSessionsCard ws={ws} occurrenceId={occurrenceId} day={day} why={sessionsWhy} off={off} draft={ed.draft} update={ed.update} />
        </div>
      </div>

      {toast.node}
      <SaveBar changes={changes} busy={save.busy} failed={save.failed} why={why} onUndo={undo} onSave={() => void doSave()} />
      {save.error && !save.failed.length && <p className="v2-err" role="alert">{save.error}</p>}

      {ed.leaveSheet}
      {editing === 'title' && (
        <NightTextSheet k="title" label={V2.nightName} usual={ws.series.name} savedValue={savedOf(detail.data, 'title')} patch={patch}
          off={textOff} onSet={setKey('title')} onClose={() => setEditing(null)} />
      )}
      {editing === 'description' && (
        <NightTextSheet k="description" label={V2.nightAbout} usual={ws.series.default_description ?? ''} savedValue={savedOf(detail.data, 'description')} patch={patch}
          max={NIGHT_ABOUT_MAX} off={textOff} onSet={setKey('description')} onClose={() => setEditing(null)} />
      )}
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
      {cancelling && <CancelNightSheet day={day} busy={busy} onKeep={() => setCancelling(false)} onCancel={(r) => void act(cancelCommand(r))} />}
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
