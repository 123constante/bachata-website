import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAreaLeaveBlocker } from '@/modules/areas/shared/useAreaLeaveBlocker';
import { isLeaveDirty, requestLeave, useLeaveGuard, useRegisterLeaveAsk } from '@/modules/areas/shared/leaveGuard';
import { useSendOnce } from '../../shared/runCommands';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import { newIdempotencyKey, type OwnerCommand } from '../../shared/seriesCommands';
import type { EventWorkspace } from '../../events/eventModel';
import { L } from '../model/labels';
import {
  attemptFor, changedElsewhere, changedKeys, pendingLines, saveButton, stepLanded, type FieldSpec, type SaveAttempt,
} from '../model/saveModel';
import { P3_PATHS } from '../shell/paths';
import { Sheet } from './Sheet';

/**
 * The ONE save model's screen half (P3 W3a, issue #26), shared by every P3 edit screen:
 * useEditForm (draft, pending list, "someone else saved" kept-typing), useSaveRun (one
 * idempotency key per command, reused by a retry), and EditTray (pending tray, Undo my changes
 * with a confirm, the Save button with its reason, the leave guard's sheet).
 */
export function useEditForm<D>(ws: EventWorkspace, initial: (ws: EventWorkspace) => D, specs: ReadonlyArray<FieldSpec<D>>) {
  const [opened, setOpened] = useState(() => ({ base: initial(ws), version: ws.series.version }));
  const [draft, setDraft] = useState<D>(opened.base);
  const own = useRef(new Set<number>());
  const changed = changedKeys(specs, opened.base, draft);
  const lines = pendingLines(specs, opened.base, draft);
  // A version change that is not this screen's own save keeps the typing and says so (W2d review nit A).
  const elsewhere = changed.length > 0 && changedElsewhere(opened.version, ws.series.version, own.current);
  const set = (patch: Partial<D>) => setDraft((d) => ({ ...d, ...patch }));
  /** "Undo my changes": back to what the screen opened with; nothing is sent. */
  const undo = () => setDraft(opened.base);
  /** "Start again from the saved version": the newest stored values, the typing dropped. */
  const restart = () => {
    const base = initial(ws);
    setOpened({ base, version: ws.series.version });
    setDraft(base);
  };
  /** After a save landed: what was sent is now the base, and its version is this screen's own. */
  const saved = (version: number | null) => {
    if (typeof version === 'number') own.current.add(version);
    setOpened({ base: draft, version: typeof version === 'number' ? version : ws.series.version });
  };
  return { base: opened.base, draft, set, setDraft, changed, lines, dirty: changed.length > 0, elsewhere, undo, restart, saved };
}

/**
 * Sends a save plan, step by step. Each command keeps its idempotency key and the version it
 * first went against until it lands, so "Try again" after a failure is the same write; a step
 * that landed is never sent twice. Refusals come back as plain words (COMMAND_COPY).
 */
export function useSaveRun(seriesId: string) {
  const once = useSendOnce(seriesId);
  const held = useRef<SaveAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (plan: readonly OwnerCommand[], version: number | null): Promise<{ ok: boolean; version: number | null }> => {
    if (!plan.length) return { ok: false, version };
    let a = attemptFor(held.current, plan, version, newIdempotencyKey);
    held.current = a;
    setBusy(true);
    setError(null);
    let last: number | null = version;
    try {
      for (let i = a.done; i < a.steps.length; i += 1) {
        const step = a.steps[i];
        const res = await once(step.command, step.version, step.key);
        last = typeof res?.new_version === 'number' ? res.new_version : last;
        a = stepLanded(a, i, last);
        held.current = a;
      }
      held.current = null;
      return { ok: true, version: last };
    } catch (e) {
      setError(commandErrorMessage(e));
      return { ok: false, version: last };
    } finally {
      setBusy(false);
    }
  };
  return { run, busy, error, clearError: () => setError(null) };
}

type Ask = { kind: 'undo' } | { kind: 'leave'; go: () => void } | { kind: 'list' } | null;

/**
 * The leave guard: the router blocker (back, links, the tab bar under the data router), the
 * store's own asking for the Back link where there is no data router, and the tab-close warning.
 */
function useLeave(dirty: boolean, setAsk: (a: Ask) => void) {
  useLeaveGuard(dirty);
  const blocker = useAreaLeaveBlocker();
  const open = useCallback((go: () => void) => setAsk({ kind: 'leave', go }), [setAsk]);
  useRegisterLeaveAsk(open);
  useEffect(() => {
    if (blocker.state === 'blocked') setAsk({ kind: 'leave', go: () => blocker.proceed?.() });
  }, [blocker, setAsk]);
  return blocker;
}

/** The screen's Back link: asks first when there are unsaved changes and no router blocker. */
export function GuardedBack({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate();
  const click = (e: MouseEvent) => {
    if (!isLeaveDirty()) return;
    e.preventDefault();
    requestLeave(() => navigate(to));
  };
  return <Link className="p3-link" to={to} onClick={click} data-testid="p3-edit-back">&larr; {L.back}</Link>;
}

export function EditTray({ lines, elsewhere, problem, lock, busy, error, onSave, onUndo, onRestart, labels }: {
  lines: string[];
  elsewhere: boolean;
  problem: string | null;
  lock?: string | null;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onUndo: () => void;
  onRestart: () => void;
  labels?: { save: string; nothing: string };
}) {
  const [ask, setAsk] = useState<Ask>(null);
  const blocker = useLeave(lines.length > 0, setAsk);
  const close = () => {
    if (blocker.state === 'blocked') blocker.reset?.();
    setAsk(null);
  };
  const btn = saveButton({ changed: lines.length, problem, lock: lock ?? null, busy, labels: labels ?? { save: L.saveAll, nothing: L.nothingChanged } });
  return (
    <>
      {lines.length > 0 && (
        <button type="button" className="p3-pending" onClick={() => setAsk({ kind: 'list' })} data-testid="p3-pending">
          <span className="p3-dot" aria-hidden="true" />
          <span className="p3-grow">{`${L.notSaved} \u00b7 ${L.changes(lines.length)} ${L.tapToSee}`}</span>
        </button>
      )}
      {elsewhere && (
        <div className="p3-warn" role="status" data-testid="p3-changed-elsewhere">
          <p className="p3-plain">{L.changedElsewhere}</p>
          <button type="button" className="p3-link" onClick={onRestart} data-testid="p3-start-again">{L.startAgain}</button>
        </div>
      )}
      <div className="p3-tray" data-testid="p3-tray">
        {error && <p className="p3-error" role="alert" data-testid="p3-save-error">{error}</p>}
        {lines.length > 0 && (
          <div className="p3-tray-row">
            <button type="button" className="p3-link" disabled={busy} onClick={() => setAsk({ kind: 'undo' })} data-testid="p3-undo-mine">{L.undoMine}</button>
          </div>
        )}
        <button type="button" className="p3-btn" disabled={!btn.enabled} onClick={onSave} data-testid="p3-save">{busy ? L.saving : btn.label}</button>
        {btn.why && <p className="p3-note" data-testid="p3-save-why">{btn.why}</p>}
      </div>
      {ask?.kind === 'undo' && (
        <Sheet title={L.undoMineTitle} onClose={close}>
          <p className="p3-mut">{L.undoMineBody}</p>
          <PendingList lines={lines} />
          <div className="p3-stack-s p3-gap-t">
            <button type="button" className="p3-btn" onClick={close} data-testid="p3-keep-editing">{L.keepEditing}</button>
            <button type="button" className="p3-btn p3-btn-line" onClick={() => { onUndo(); setAsk(null); }} data-testid="p3-undo-confirm">{L.undoMine}</button>
          </div>
        </Sheet>
      )}
      {(ask?.kind === 'leave' || ask?.kind === 'list') && (
        <Sheet title={ask.kind === 'list' ? L.pendingTitle(lines.length) : L.leaveTitle} onClose={close}>
          <p className="p3-mut">{L.leaveBody}</p>
          <PendingList lines={lines} />
          <div className="p3-stack-s p3-gap-t">
            <button type="button" className="p3-btn" onClick={close} data-testid="p3-keep-editing">{L.keepEditing}</button>
            {ask.kind === 'leave' && (
              <button type="button" className="p3-btn p3-btn-line" onClick={() => { const go = ask.go; onUndo(); setAsk(null); go(); }} data-testid="p3-leave-go">{L.leaveGo}</button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

function PendingList({ lines }: { lines: string[] }) {
  return (
    <ul className="p3-card p3-tight p3-list" data-testid="p3-pending-list">
      {lines.map((l) => <li key={l} className="p3-row"><span className="p3-grow p3-row-t">{l}</span></li>)}
    </ul>
  );
}

/** After a save: back to the event page, which shows the toast (C3 returns there too). */
export function useBackToEvent(seriesId: string, dirty: boolean) {
  const navigate = useNavigate();
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    // waits for the guard to see the saved draft as clean, so leaving does not ask
    if (done && !dirty) navigate(P3_PATHS.event(seriesId), { state: { p3Toast: done } });
  }, [done, dirty, navigate, seriesId]);
  return setDone;
}
