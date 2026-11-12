import { useCallback, useId, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bulkCancelCommand } from '../../shared/seriesCommands';
import { runBulkCommand } from '../../flows/change/bulkApi';
import { bulkResult } from '../../flows/change/changeModel';
import { DEFAULT_REASON } from '../../flows/add/addModel';
import { fetchCancellationReasons, ORGANISER_HOME_KEY } from '../../shared/selfServeApi';
import { useSendOnce, useEventWorkspace, eventWorkspaceQueryKey } from '../../shared/runCommands';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { newIdempotencyKey } from '../../shared/seriesCommands';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { removeCommand, STATUS_COPY } from '../data/eventPage';
import type { P3Row } from '../data/home';
import { useGatedCopy } from '../onboarding/gate';
import { DateSheets } from '../screens/DateSheet';
import { Sheet } from '../screens/Sheet';
import { Toast } from '../screens/Toast';
import type { Done } from '../screens/StatusSheet';
import { RetryButton } from '../screens/parts';
import { P3_PATHS } from '../shell/paths';
import { PAGE_FIRST, PAGE_MORE, SCOPE, buildEvents, type Filter, type Night, type Seat } from './eventsModel';
import { EventsView, NightSheet } from './EventsView';

/** "Every night": the existing occurrence.bulk_cancel (same command and reason list as the Change dates screen) for every coming night. The count is named before anything is sent. */
export function CancelEveryNight({ seriesId, version, ids, onDone, onClose }: { seriesId: string; version: number; ids: string[]; onDone: (d: Done) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const reasons = useQuery({ queryKey: ['cancellation-reasons'], queryFn: fetchCancellationReasons, staleTime: Infinity });
  const gated = useGatedCopy();
  const [key] = useState(newIdempotencyKey);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errId = useId();
  const n = ids.length;
  if (n === 0) {
    return <Sheet title="No coming nights to cancel" onClose={onClose}><p className="p3-note" data-testid="ev-every-none">Every night has passed or is already cancelled. Nothing has changed.</p></Sheet>;
  }
  const word = `${n} night${n === 1 ? '' : 's'}`;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await runBulkCommand(seriesId, version, bulkCancelCommand(ids, reason ?? DEFAULT_REASON), key);
      const r = bulkResult(ids, res.affectedIds);
      onDone({ text: r.refused.length ? `${r.done} night${r.done === 1 ? '' : 's'} cancelled, ${r.refused.length} not changed.` : `${word} cancelled.`, undo: null });
    } catch (e) {
      setError(gated(e, commandErrorMessage));
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    }
  };
  const list = (reasons.data ?? []).filter((r) => r.label !== DEFAULT_REASON);
  return (
    <Sheet title={`Cancel all ${word}?`} onClose={onClose}>
      <p className="p3-note" data-testid="ev-every-body">{n === 1 ? 'This cancels 1 night.' : `This cancels ${n} nights.`} Dancers see Cancelled and your reason on each one.</p>
      {list.length > 0 && (
        <div className="p3-stack-s" role="group" aria-label="Reason">
          {list.map((r) => (
            <button key={r.key} type="button" className={`p3-btn ${reason === r.label ? '' : 'p3-btn-line'}`} style={{ minHeight: 44 }} aria-pressed={reason === r.label} onClick={() => setReason(reason === r.label ? null : r.label)}>{r.label}</button>
          ))}
        </div>
      )}
      {error && <p className="p3-error" role="alert" id={errId} data-testid="ev-every-error">{error}</p>}
      <div className="p3-stack-s">
        <button type="button" className="p3-btn p3-btn-danger" style={{ minHeight: 44 }} disabled={busy} onClick={() => void go()} data-testid="ev-every-confirm">{busy ? <>Working&hellip;</> : `Cancel ${word}`}</button>
        <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={onClose}>Keep them</button>
      </div>
    </Sheet>
  );
}

/** Cancel one night through the existing date sheet (the event's own read, then DateSheets). Nothing is sent until the reason is picked and confirmed there. */
export function CancelNight({ night, today, onDone, onClose }: { night: Night; today: string; onDone: (d: Done) => void; onClose: () => void }) {
  const ws = useEventWorkspace(night.seriesId);
  const [scoped, setScoped] = useState<'one' | 'all' | null>(null);
  if (ws.isPending) return <Sheet title="Loading the night&hellip;" onClose={onClose}><p className="p3-note">This takes a second.</p></Sheet>;
  if (ws.isError) {
    return (
      <Sheet title="We couldn&rsquo;t open this night" onClose={onClose}>
        <p className="p3-note">Nothing has changed. Check your connection, then try again.</p>
        <RetryButton onClick={() => void ws.refetch()} />
      </Sheet>
    );
  }
  const id = ws.data.dates.find((d) => d.occurrence_date === night.date)?.id;
  if (!id) {
    return <Sheet title="This night is not on the list" onClose={onClose}><p className="p3-note">Open the event to see its dates. Nothing has changed.</p></Sheet>;
  }
  // Only an event with several coming nights is asked "which nights?".
  const comingDates = ws.data.dates.filter((d) => d.occurrence_date >= today && d.lifecycle_status !== 'cancelled');
  if (scoped === 'all') return <CancelEveryNight seriesId={night.seriesId} version={ws.data.series.version} ids={comingDates.map((d) => d.id)} onDone={onDone} onClose={onClose} />;
  if (!scoped && comingDates.length >= SCOPE.askFrom) {
    return (
      <Sheet title={SCOPE.title} onClose={onClose}>
        <div className="p3-stack-s" data-testid="ev-scope">
          <button type="button" className="p3-btn" style={{ minHeight: 44 }} onClick={() => setScoped('one')} data-testid="ev-scope-one">{SCOPE.one}</button>
          <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={() => setScoped('all')} data-testid="ev-scope-all">{SCOPE.all}</button>
        </div>
      </Sheet>
    );
  }
  // The reason picker opens straight away: the date action list is not in the way.
  return <DateSheets ws={ws.data} today={today} open={{ kind: 'date', id, start: 'cancel' }} onClose={onClose} onDone={onDone} />;
}

/** Delete draft: the existing Remove command (series.set_lifecycle archived). Nobody is told: a draft was never on the calendar. */
export function DeleteDraft({ night, onDone, onClose }: { night: Night; onDone: (d: Done) => void; onClose: () => void }) {
  const ws = useEventWorkspace(night.seriesId);
  const once = useSendOnce(night.seriesId);
  const gated = useGatedCopy();
  const [key] = useState(newIdempotencyKey);
  const loadErr = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    if (!ws.data) return;
    setBusy(true);
    setError(null);
    try {
      await once(removeCommand(), ws.data.series.version, key);
      onDone({ text: 'Draft archived. Your team can restore it.', undo: null, removed: true });
    } catch (e) {
      setError(gated(e, commandErrorMessage));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={`Delete the draft ${night.name}?`} onClose={onClose}>
      <p className="p3-note" data-testid="ev-delete-body">It was never on the calendar, so nobody is told. It leaves your events. {STATUS_COPY.removeSub.split('. ').pop()}</p>
      {ws.isError && <p className="p3-error" role="alert" id={loadErr} data-testid="ev-delete-load-error">We couldn&rsquo;t load the draft. Nothing has changed.</p>}
      {error && <p className="p3-error" role="alert" data-testid="ev-delete-error">{error}</p>}
      <div className="p3-stack-s">
        <button type="button" className="p3-btn p3-btn-danger" style={{ minHeight: 44 }} disabled={busy || !ws.data} aria-describedby={ws.isError ? loadErr : undefined} onClick={() => void go()} data-testid="ev-delete-confirm">{busy || ws.isPending ? <>Working&hellip;</> : 'Yes, delete the draft'}</button>
        <button type="button" className="p3-btn p3-btn-line" style={{ minHeight: 44 }} onClick={onClose}>Keep the draft</button>
      </div>
    </Sheet>
  );
}

type Open = { kind: 'night' | 'cancel' | 'delete'; night: Night } | null;

/** The organiser Events tab behind flags.organiserDash: the model's list, the night sheet, and the two commands that exist (cancel one date, delete a draft). */
export function DashEvents({ rows, today, page }: { rows: readonly P3Row[]; today: string; page: HomeOrganiser }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE_FIRST);
  const [showPast, setShowPast] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [note, setNote] = useState<Done | null>(null);
  const seat: Seat = page.role as Seat;
  const model = useMemo(() => buildEvents({ rows, today, seat, query, filter, shown, showPast }), [rows, today, seat, query, filter, shown, showPast]);
  const close = useCallback(() => setOpen(null), []);
  const clearNote = useCallback(() => setNote(null), []);
  const done = (d: Done) => { setOpen(null); setNote({ ...d, undo: null }); };
  return (
    <>
      <EventsView
        model={model} pageId={page.id} query={query} filter={filter}
        onQuery={(q) => { setQuery(q); setShown(PAGE_FIRST); }} onFilter={(f) => { setFilter(f); setShown(PAGE_FIRST); }}
        onClear={() => { setQuery(''); setFilter('all'); setShown(PAGE_FIRST); }}
        onMore={() => setShown((s) => s + PAGE_MORE)} onShowPast={() => setShowPast(true)}
        onOpenNight={(n) => setOpen({ kind: 'night', night: n })}
      />
      {open?.kind === 'night' && (
        <NightSheet night={open.night} onClose={close} openTo={P3_PATHS.event(open.night.openId)}
          onCancel={() => setOpen({ kind: 'cancel', night: open.night })} onDelete={() => setOpen({ kind: 'delete', night: open.night })} />
      )}
      {open?.kind === 'cancel' && <CancelNight night={open.night} today={today} onDone={done} onClose={close} />}
      {open?.kind === 'delete' && <DeleteDraft night={open.night} onDone={done} onClose={close} />}
      {note && <Toast done={note} onUndo={clearNote} onClose={clearNote} />}
    </>
  );
}
