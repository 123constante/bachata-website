import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ExternalLink, Loader2, Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import {
  ORGANISER_HOME_KEY,
  dateDetailQueryKey,
  fetchOccurrenceProgramme,
  occurrenceProgrammeQueryKey,
  saveOccurrenceProgramme,
  seriesWorkspaceQueryKey,
} from '../selfServeApi';
import { isServerRefusal, programmeErrorCopy } from '../selfServeErrors';
import { UNSAVED_MESSAGE, leaveGuardEnabled } from '../editorGuards';
import {
  LEVEL_LABEL,
  LIVE_SAVE_NOTE,
  TYPE_LABEL,
  buildPayload,
  isDirty,
  newSession,
  newlyRemoved,
  notEditableCopy,
  peopleChanged,
  removeSessionsConfirmCopy,
  toDraft,
  validateProgramme,
  type DraftSession,
  type LevelKey,
  type Programme,
} from '../programmeModel';
import { ConfirmPanel } from './ConfirmPanel';
import { ProgrammeSessionRow } from './ProgrammeSessionRow';

/**
 * The programme of ONE date (classes, times, levels per session), inside the
 * date sheet. Loads organiser_get_occurrence_programme_v1, edits a local draft,
 * and saves the COMPLETE list back with organiser_set_occurrence_programme_v1
 * (programmeModel.buildPayload: every session the reader returned plus the new
 * ones, never a diff). A live date shows the change at once.
 */

type Stage = 'edit' | 'confirm' | 'done';
/** Where the focus goes after a step swaps out the control that had it (so it is never dropped on the sheet). */
type FocusTarget = 'heading' | 'save' | 'message' | 'add' | 'confirm';

interface Props {
  occurrenceId: string;
  seriesId: string;
  /** "Thu 8 Oct", for the copy. */
  dateLabel: string;
  /** The series is live: a saved change is on the site now, and "View on the site" shows. */
  live: boolean;
  publicPath: string;
  onBack: () => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const NETWORK_COPY = 'We could not confirm the save. Check your connection, then press Save the programme again.';

export function ProgrammeEditor({ occurrenceId, seriesId, dateLabel, live, publicPath, onBack, onClose, onDirtyChange }: Props) {
  const queryClient = useQueryClient();
  const programme = useQuery({
    queryKey: occurrenceProgrammeQueryKey(occurrenceId),
    queryFn: () => fetchOccurrenceProgramme(occurrenceId),
    // A background refetch must never replace what the organiser is typing.
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const [base, setBase] = useState<Programme | null>(null);
  const [rows, setRows] = useState<DraftSession[]>([]);
  const [stage, setStage] = useState<Stage>('edit');
  const [error, setError] = useState<string | null>(null);
  const [errorRowKey, setErrorRowKey] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [changed, setChanged] = useState(true);
  const [focusTo, setFocusTo] = useState<{ target: FocusTarget; n: number } | null>(null);
  const reseed = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const focusSeq = useRef(0);
  const focusNext = (target: FocusTarget) => setFocusTo({ target, n: (focusSeq.current += 1) });

  const seed = (p: Programme) => {
    setBase(p);
    setRows(toDraft(p.sessions, p.sessionPeople));
    setShowProblems(false);
    setFocusKey(null);
  };

  // The draft starts from the reader, and starts again only when a reload was asked for.
  useEffect(() => {
    if (programme.data && reseed.current) {
      reseed.current = false;
      seed(programme.data);
    }
  }, [programme.data]);

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { if (stage === 'done') doneRef.current?.focus(); }, [stage]);
  useEffect(() => {
    if (!focusTo) return;
    const t = focusTo.target;
    const el = t === 'heading' ? headingRef.current
      : t === 'save' ? saveRef.current
      : t === 'message' ? messageRef.current
      : t === 'add' ? addRef.current
      : confirmRef.current?.querySelector<HTMLElement>('input, button:not(:disabled)');
    el?.focus();
  }, [focusTo]);

  const dirty = !!base && stage !== 'done' && isDirty(rows, base.sessions.length);
  const validation = useMemo(() => validateProgramme(rows), [rows]);
  const removing = useMemo(() => newlyRemoved(rows), [rows]);

  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const save = useMutation({
    mutationFn: () => {
      if (!base) throw new Error('programme_not_loaded');
      return saveOccurrenceProgramme(occurrenceId, base.version, buildPayload(rows));
    },
    onSuccess: (result) => {
      // The save result carries no line-up: after a line-up change, read the date again for the server's own.
      const peopleSent = rows.some(peopleChanged);
      const next: Programme = { ...(base as Programme), version: result.version, sessions: result.sessions };
      queryClient.setQueryData(occurrenceProgrammeQueryKey(occurrenceId), next);
      seed(next);
      if (peopleSent) {
        void programme.refetch().then((fresh) => {
          if (fresh.data && !dirtyRef.current) seed(fresh.data);
        });
      }
      setChanged(result.changed);
      setError(null);
      setErrorRowKey(null);
      setStage('done');
      void queryClient.invalidateQueries({ queryKey: dateDetailQueryKey(occurrenceId) });
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    },
    onError: (err) => {
      setStage('edit');
      // Save was disabled while it ran, so the focus fell off it: put it on the message.
      focusNext('message');
      if (!isServerRefusal(err)) {
        setError(NETWORK_COPY);
        setErrorRowKey(null);
        return;
      }
      const copy = programmeErrorCopy(err);
      setError(copy.message);
      // The server names a payload index; the payload is the draft in order minus never-saved removals.
      const sent = rows.filter((r) => r.original || !r.removed);
      setErrorRowKey(copy.sessionIndex !== null ? sent[copy.sessionIndex]?.key ?? null : null);
      if (copy.reload) void reload();
    },
  });

  /** Fetch the date again and start the draft over from it (the error stays on screen). */
  const reload = async () => {
    const fresh = await programme.refetch();
    if (fresh.data) {
      reseed.current = false;
      seed(fresh.data);
      // A refusal that turned the date read-only swaps the whole screen: the focus goes to its heading.
      if (!fresh.data.editable) focusNext('heading');
    }
  };

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useUnsavedChangesGuard({ enabled: leaveGuardEnabled({ dirty, saving: save.isPending }), message: UNSAVED_MESSAGE });

  const update = (key: string, patch: Partial<DraftSession>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (key === errorRowKey) setErrorRowKey(null);
  };
  const remove = (row: DraftSession) => {
    // A session added on this screen was never saved: it just goes.
    if (!row.original) {
      setRows((current) => current.filter((r) => r.key !== row.key));
      focusNext('add');
    } else update(row.key, { removed: true });
  };
  const add = () => {
    const row = newSession();
    setRows((current) => [...current, row]);
    setFocusKey(`${row.key}#${(focusSeq.current += 1)}`);
  };

  const trySave = () => {
    setError(null);
    if (!dirty || save.isPending) return;
    if (!validation.ok) {
      setShowProblems(true);
      const first = validation.rows[0]?.key;
      if (first) setFocusKey(`${first}#${(focusSeq.current += 1)}`);
      else focusNext('message');
      return;
    }
    if (removing.length > 0) {
      setStage('confirm');
      focusNext('confirm');
      return;
    }
    save.mutate();
  };

  const back = () => {
    if (dirty && !window.confirm(UNSAVED_MESSAGE)) return;
    onBack();
  };

  const heading = (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="ghost" className="min-h-[44px]" onClick={back} disabled={save.isPending} data-testid="programme-back">
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
      </Button>
      <h3 ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-none">Programme for {dateLabel}</h3>
    </div>
  );

  if (programme.isLoading || (!base && !programme.isError)) {
    return (
      <div className="space-y-3" data-testid="programme-panel">
        {heading}
        <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading the programme&hellip;
        </p>
      </div>
    );
  }
  if (!base) {
    return (
      <div className="space-y-3" data-testid="programme-panel">
        {heading}
        <div className="space-y-2" role="alert">
          <p className="text-sm">We couldn&rsquo;t load the programme for this date.</p>
          <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => void reload()} disabled={programme.isFetching} data-testid="programme-retry">
            {programme.isFetching && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!base.editable) {
    const shown = base.sessions.filter((s) => s.removed !== true);
    return (
      <div className="space-y-3" data-testid="programme-panel">
        {heading}
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="programme-readonly-reason">
          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {notEditableCopy(base.notEditableReason)}
        </p>
        <ul className="space-y-2" aria-label="Programme (read only)" data-testid="programme-readonly">
          {shown.length === 0 && <li className="text-sm text-muted-foreground">No sessions on this date.</li>}
          {shown.map((s, i) => (
            <li key={i} className="rounded-md border border-border p-3 text-sm">
              <span className="block font-medium">{typeof s.title === 'string' && s.title ? s.title : TYPE_LABEL[String(s.type)] ?? 'Session'}</span>
              <span className="block text-xs text-muted-foreground">
                {[
                  TYPE_LABEL[String(s.type)],
                  s.start_time && s.end_time ? `${s.start_time} to ${s.end_time}${s.ends_next_day ? ' (finishes after midnight)' : ''}` : null,
                  Array.isArray(s.level_keys) && s.level_keys.length ? s.level_keys.map((l) => LEVEL_LABEL[l as LevelKey] ?? String(l)).join(', ') : null,
                ].filter(Boolean).join(' \u00b7 ')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="space-y-3" data-testid="programme-done" role="status">
        <p ref={doneRef} tabIndex={-1} className="text-sm font-semibold flex items-start gap-2 outline-none">
          <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
          {changed ? `The programme for ${dateLabel} is saved.` : 'Nothing needed saving. The programme is as it was.'}
        </p>
        {changed && (
          <p className="text-xs text-muted-foreground" data-testid="programme-done-live">
            {live ? 'It is live on Bachata Calendar now. Dancers see the new programme straight away.' : 'Dancers will see it once your event is live.'}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {live && (
            <Link to={publicPath} className="text-xs text-primary tap-link gap-1 me-auto" data-testid="programme-view-on-site">
              View on the site <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          )}
          <Button type="button" size="sm" variant="outline" className="min-h-[44px]" onClick={() => { setStage('edit'); focusNext('heading'); }} data-testid="programme-edit-again">Edit again</Button>
          <Button type="button" size="sm" className="min-h-[44px]" onClick={onClose} data-testid="programme-close">Done</Button>
        </div>
      </div>
    );
  }

  if (stage === 'confirm') {
    return (
      <div ref={confirmRef} className="space-y-3" data-testid="programme-panel">
        <ConfirmPanel
          testId="programme-remove-confirm"
          copy={removeSessionsConfirmCopy(removing.map((r) => r.title), dateLabel)}
          busy={save.isPending}
          onKeep={() => { setStage('edit'); focusNext('save'); }}
          onConfirm={() => save.mutate()}
        />
        {error && <p className="text-xs text-destructive" role="alert" data-testid="programme-error">{error}</p>}
      </div>
    );
  }

  const problemsFor = (key: string) => (showProblems ? validation.rows.filter((p) => p.key === key) : []);
  const errorRow = errorRowKey ? rows.find((r) => r.key === errorRowKey) : undefined;

  return (
    // scroll-margin: a field the keyboard or a Tab moves to stops above the sticky save bar, not under it.
    <div className="space-y-3 [&_:is(input,select,button)]:scroll-mb-40" data-testid="programme-panel">
      {heading}
      <p className="text-xs text-muted-foreground">
        Changes here are for {dateLabel} only.{live ? ` ${LIVE_SAVE_NOTE}` : ''}
      </p>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No sessions on this date yet. Add one below.</p>}
      <ul className="space-y-2" aria-label={`Sessions on ${dateLabel}`}>
        {rows.map((row) => (
          <ProgrammeSessionRow
            key={row.key}
            row={row}
            problems={problemsFor(row.key)}
            focusToken={focusKey && focusKey.split('#')[0] === row.key ? focusKey : null}
            live={live}
            failed={row.key === errorRowKey}
            onChange={(patch) => update(row.key, patch)}
            onRemove={() => remove(row)}
            onRestore={() => update(row.key, { removed: false })}
          />
        ))}
      </ul>
      <Button ref={addRef} type="button" size="sm" variant="outline" className="w-full min-h-[44px]" onClick={add} data-testid="programme-add">
        <Plus className="w-4 h-4" aria-hidden="true" /> Add a session
      </Button>

      {/*
        Stuck to the bottom of the date sheet. The negative bottom and margin cancel the
        sheet's own bottom padding (DateActionSheet: 1.5rem + the safe area; the margin is
        important to beat space-y on the panel), so the bar meets the sheet's edge and
        nothing scrolls into view underneath it. The messages live in the bar, next to the
        button that raised them, so they are always on screen.
      */}
      <div
        className="sticky bottom-[calc(-1.5rem_-_env(safe-area-inset-bottom))] z-10 -mx-1 !mb-[calc(-1.5rem_-_env(safe-area-inset-bottom))] flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-1 pt-2 pb-[calc(2rem_+_env(safe-area-inset-bottom))] backdrop-blur"
        data-testid="programme-save-bar"
      >
        {((showProblems && !validation.ok) || error) && (
          <div ref={messageRef} tabIndex={-1} className="w-full space-y-1 text-sm text-destructive outline-none">
            {showProblems && !validation.ok && (
              <div className="space-y-1" role="alert" data-testid="programme-problems">
                {validation.rows.length > 0 && <p>Fix the highlighted sessions before saving.</p>}
                {validation.programme.map((m) => <p key={m}>{m}</p>)}
              </div>
            )}
            {error && (
              <p role="alert" data-testid="programme-error">
                {error}
                {errorRow ? ` Check "${errorRow.title.trim() || 'the session without a name'}".` : ''}
              </p>
            )}
          </div>
        )}
        {dirty && <span className="me-auto text-xs text-muted-foreground" data-testid="programme-unsaved">Not saved yet</span>}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-[44px]"
          disabled={!dirty || save.isPending}
          onClick={() => { seed(base); setError(null); setErrorRowKey(null); focusNext('heading'); }}
          data-testid="programme-discard"
        >
          Undo changes
        </Button>
        <Button ref={saveRef} type="button" size="sm" className="min-h-[44px]" disabled={!dirty || save.isPending} onClick={trySave} data-testid="programme-save">
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save the programme
        </Button>
      </div>
    </div>
  );
}
