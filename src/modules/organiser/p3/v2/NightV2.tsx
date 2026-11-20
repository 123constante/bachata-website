import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { EventWorkspace } from '../../events/eventModel';
import { fullDate } from '../../shared/dateWords';
import { londonTodayKey } from '@/lib/londonDate';
import { cancelCommand, envelope, newIdempotencyKey, uncancelCommand } from '../../shared/seriesCommands';
import { invalidatePublicEventCaches } from '@/modules/organiser/shared/publicCache';
import { eventWorkspaceQueryKey } from '../../shared/runCommands';
import { runOccurrenceCommand } from '../../shared/selfServeApi';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { nightLinkOf } from '../dash/shareLinks';
import { GuardedBack, useLeave, type Ask } from '../screens/EditTray';
import { WorkspaceGate } from '../screens/EventPage';
import { useCancelReasons } from '../screens/CancelEventSheet';
import { Sheet } from '../screens/Sheet';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from '../r4/EventChoice';
import { V2 } from './copy';
import { NIGHT_ABOUT_MAX, changeList, nightFieldState, nightSessionsOff, summaryOf, writePlan, type NightPatch } from './editorModel';
import { SaveBar, UnsavedSheet, useV2Save, useV2Toast } from './SaveBar';
import './v2.css';

type TextKey = 'title' | 'description';

/** One "Name for this night" / "About this night" row: label above the value, Usual or Changed, Back to usual. */
function NightText({ k, label, usual, saved, patch, max, off, onSet }: {
  k: TextKey; label: string; usual: string; saved: readonly string[]; patch: NightPatch; max?: number; off: boolean;
  onSet: (v: string | null | undefined) => void;
}) {
  const state = nightFieldState(k, saved, patch);
  const value = typeof patch[k] === 'string' ? (patch[k] as string) : '';
  const Input = k === 'description' ? 'textarea' : 'input';
  return (
    <div className="r4-field" data-testid={`v2-night-${k}`}>
      <label htmlFor={`v2-n-${k}`} className="v2-label-above">{label}</label>
      <Input id={`v2-n-${k}`} className="r4-in v2-tap" value={value} placeholder={state === 'changed' && !(k in patch) ? V2.changed : usual}
        maxLength={max} disabled={off} onChange={(e) => onSet(e.target.value === '' ? undefined : e.target.value)} />
      <div className="v2-row" style={{ padding: 0 }}>
        <span className="v2-row-help v2-row-t" data-testid={`v2-night-${k}-state`}>{state === 'changed' ? V2.changed : V2.usual}</span>
        {state === 'changed' && <button type="button" className="v2-link" disabled={off} onClick={() => onSet(null)} data-testid={`v2-night-${k}-usual`}>{V2.backToUsual}</button>}
      </div>
    </div>
  );
}

function Night({ ws, occurrenceId }: { ws: EventWorkspace; occurrenceId: string }) {
  const id = ws.series.id;
  const today = londonTodayKey();
  const c = useEventChoice();
  const row = c.rows.find((r) => r.id === id) ?? null;
  const date = ws.dates.find((d) => d.id === occurrenceId) ?? null;
  const [patch, setPatch] = useState<NightPatch>({});
  const save = useV2Save(id, ws.series.version);
  const toast = useV2Toast();
  const qc = useQueryClient();
  const [ask, setAsk] = useState<Ask>(null);
  const day = date ? fullDate(date.occurrence_date, today) : '';
  const draft = { event: {}, nights: { [occurrenceId]: patch } };
  const changes = date ? changeList({ name: '', about: '', venueId: null }, draft, () => day) : [];
  const dirty = changes.length > 0;
  useLeave(dirty, setAsk);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!date) return <p className="r4-sub" data-testid="v2-night-missing">This date is not on the event any more.</p>;

  const cancelled = date.lifecycle_status === 'cancelled';
  const steps = writePlan(id, [], draft, ws.dates, () => day);
  const set = (k: TextKey) => (v: string | null | undefined) => setPatch((p) => {
    const n = { ...p };
    if (v === undefined) delete n[k]; else n[k] = v;
    return n;
  });
  const doSave = async () => { const ok = await save.run(steps); if (ok) { setPatch({}); toast.show(V2.saved); } return ok; };
  const undo = () => { const s = summaryOf(changes); setPatch({}); save.forget(); toast.show(V2.undone(s)); };
  const link = typeof window === 'undefined' || !row ? null : nightLinkOf(window.location.origin, row.publicEventRef);
  const act = async (command: ReturnType<typeof uncancelCommand>) => {
    setBusy(true); setErr(null);
    try {
      await runOccurrenceCommand(envelope(date.id, date.version, command, newIdempotencyKey()));
      setCancelling(false);
    } catch (e) { setErr(commandErrorMessage(e)); } finally {
      invalidatePublicEventCaches(qc);
      void qc.invalidateQueries({ queryKey: eventWorkspaceQueryKey(id) });
      setBusy(false);
    }
  };
  const sessionsWhy = nightSessionsOff(date, today, false);
  const off = save.busy || cancelled;

  return (
    <div className="r4-stack r4-form" data-testid="v2-night" data-id={occurrenceId}>
      <div>
        <GuardedBack to={P3_PATHS.eventEdit(id)}>{null}</GuardedBack>
        <div className="v2-row" style={{ padding: 0 }}>
          <h1 className="r4-h1 v2-row-t" data-testid="v2-night-date">{day}</h1>
          {!cancelled && <button type="button" className="v2-link" disabled={dirty || busy} onClick={() => setCancelling(true)} data-testid="v2-night-cancel">{V2.cancelNight}</button>}
        </div>
        <p className="v2-sub-line" title={ws.series.name}>{ws.series.name}</p>
        <p className="r4-hint">{V2.nightOnly(day)}</p>
        {dirty && !cancelled && <p className="v2-row-help">{V2.saveFirst}</p>}
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
        <NightText k="title" label={V2.nightName} usual={ws.series.name} saved={date.override_keys} patch={patch} off={off} onSet={set('title')} />
        <NightText k="description" label={V2.nightAbout} usual={ws.series.default_description ?? ''} saved={date.override_keys} patch={patch} max={NIGHT_ABOUT_MAX} off={off} onSet={set('description')} />
        <div className="v2-row" style={{ padding: 0 }}>
          <span className="v2-row-t">{V2.venue}</span>
          <span className="v2-row-help">{nightFieldState('venue_id', date.override_keys, patch) === 'changed' ? V2.changed : V2.usual}</span>
        </div>
        <div className="v2-row" style={{ padding: 0 }}>
          <span className="v2-row-t">{V2.nightPicture}</span>
          <span className="v2-row-help">{nightFieldState('cover_image_url', date.override_keys, patch) === 'changed' ? V2.changed : V2.usual}</span>
        </div>
      </section>

      <section className="r4-card v2-card" data-testid="v2-night-tickets-frame">
        <h2 className="r4-label v2-card-h">{V2.nightTickets}</h2>
        <p className="v2-slot">{V2.s2Slot}</p>
        <a href={P3_PATHS.event(id)} className="v2-row"><span className="v2-row-t">{V2.nightGuestList}</span></a>
      </section>

      <section className="r4-card v2-card" data-testid="v2-night-sessions">
        <h2 className="r4-label v2-card-h">{V2.nightSessions}</h2>
        <div className={sessionsWhy ? 'v2-grey' : undefined}>
          <a href={P3_PATHS.eventAll(id)} aria-disabled={!!sessionsWhy} className="v2-row" onClick={(e) => { if (sessionsWhy) e.preventDefault(); }}><span className="v2-row-t">{V2.addNightSession}</span></a>
          {sessionsWhy && <p className="v2-row-help" data-testid="v2-night-sessions-why">{sessionsWhy}</p>}
        </div>
      </section>

      {toast.node}
      <SaveBar changes={changes} busy={save.busy} failed={save.failed} why={null} onUndo={undo} onSave={() => void doSave()} />
      {save.error && !save.failed.length && <p className="r4-err" role="alert">{save.error}</p>}

      {ask?.kind === 'leave' && (
        <UnsavedSheet busy={save.busy} onKeep={() => setAsk(null)}
          onThrow={() => { const go = ask.go; setPatch({}); setAsk(null); go(); }}
          onSave={() => { const go = ask.go; void doSave().then((ok) => { setAsk(null); if (ok) go(); }); }} />
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
