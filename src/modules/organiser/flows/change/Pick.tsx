import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { bulkCancelCommand, bulkShiftCommand, newIdempotencyKey, type BulkCommand } from '@/modules/organiser/shared/seriesCommands';
import { dateDetailQueryKey, fetchCancellationReasons, occurrenceProgrammeQueryKey, ORGANISER_HOME_KEY, seriesWorkspaceQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import { commandErrorMessage, isVersionConflict } from '@/modules/organiser/shared/selfServeErrors';
import { Chip, FIELD_CLASS, GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { DEFAULT_REASON } from '../add/addModel';
import { EventConflict } from '../event/parts';
import { NO_COMING } from '@/modules/organiser/shared/copy';
import { BULK_REFUSED_REASON, bulkResult, changeDateList, findSeries, seriesLock, shiftPastProblem, shiftRefusal } from './changeModel';
import { runBulkCommand } from './bulkApi';
import { useChangeHome, useSeriesWorkspace } from './useChange';
import { Failed, Loading, Missing, Refusal, Step, StepList } from './parts';

type Stage = { kind: 'pick' } | { kind: 'confirm'; command: BulkCommand } | { kind: 'result'; line: string; refused: string[]; labels: Record<string, string> };
export const PICK_NONE = 'Tick at least one date';

/**
 * C58: tick several coming dates, then cancel them (one reason) or move them
 * by N days, in ONE admin_bulk_occurrence_command_p5 call (it admits the
 * series' owner/manager). One confirm with the count; the result says how
 * many changed and why the rest did not.
 */
export default function Pick() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { seriesId = '' } = useParams();
  const home = useChangeHome();
  const ws = useSeriesWorkspace(seriesId);
  const reasons = useQuery({ queryKey: ['cancellation-reasons'], queryFn: fetchCancellationReasons, staleTime: Infinity });
  const [ticked, setTicked] = useState<string[]>([]);
  const [days, setDays] = useState('7');
  const [later, setLater] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const keys = useRef(new Map<string, string>());
  const one = findSeries(home.data, seriesId);
  const back = ORG_PATHS.changeEvent(seriesId);

  let body;
  if (home.isError || ws.isError) body = <Failed error={ws.error} onRetry={() => { void home.refetch(); void ws.refetch(); }} />;
  else if (!home.data || !ws.data) body = <Loading />;
  else if (!one) body = <Missing />;
  // A paused or ended event reached by URL: the same refusal as "which date".
  else if (seriesLock(one.lifecycle_status)) body = <Refusal text={seriesLock(one.lifecycle_status) as string} seriesId={seriesId} home />;
  else if (conflict) body = <EventConflict seriesId={seriesId} testId="change-conflict" />;
  else {
    const dates = changeDateList(one, ws.data, home.data.today).all;
    const label = (id: string) => dates.find((d) => d.occurrenceId === id)?.label ?? id;
    // PAR-B S8: an unsigned number (the iPhone number pad has no minus) plus Earlier / Later.
    const n = /^\d{1,2}$/.test(days.trim()) ? Number(days.trim()) : NaN;
    const daysOk = n >= 1 && n <= 60;
    const shift = later ? n : -n;
    const ids = dates.map((d) => d.occurrenceId).filter((id) => ticked.includes(id));
    const shiftOff = shiftRefusal(ws.data.series.recurrence_rule);
    // PAR-A S1: the server refuses the whole call when a date would land before today; say so first.
    const past = daysOk ? shiftPastProblem(dates.filter((d) => ids.includes(d.occurrenceId)).map((d) => d.date), shift, home.data.today) : null;
    const moveReason = !ids.length ? PICK_NONE : daysOk ? past : 'Type a number of days from 1 to 60';
    const toggle = (id: string) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
    // (ids: ticks that are still listed, in list order, so the payload reads soonest first.)

    const run = async (command: BulkCommand) => {
      const sig = JSON.stringify(command);
      if (!keys.current.has(sig)) keys.current.set(sig, newIdempotencyKey());
      setBusy(true);
      setError(null);
      try {
        const res = await runBulkCommand(seriesId, ws.data!.series.version, command, keys.current.get(sig));
        const r = bulkResult(command.payload.occurrence_ids, res.affectedIds);
        // Labels as listed when sent: a skipped date drops out of the refreshed list.
        const labels = Object.fromEntries(command.payload.occurrence_ids.map((id) => [id, label(id)]));
        setStage({ kind: 'result', line: r.line, refused: r.refused, labels });
        setTicked([]);
      } catch (err) {
        if (isVersionConflict(err)) setConflict(true);
        else setError(commandErrorMessage(err));
      } finally {
        setBusy(false);
        void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
        void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
        void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
        // Every moved or cancelled date's own reads (detail, sessions) carry its old version.
        void queryClient.invalidateQueries({ queryKey: dateDetailQueryKey(undefined).slice(0, 1) });
        void queryClient.invalidateQueries({ queryKey: occurrenceProgrammeQueryKey(undefined).slice(0, 1) });
      }
    };

    if (stage.kind === 'result') {
      body = (
        <div className="flex flex-col gap-3" data-testid="change-pick-result" aria-live="polite">
          <p className="text-[16px] font-bold text-[var(--fg)]">{stage.line}</p>
          {stage.refused.length > 0 && (
            <ul className="flex flex-col gap-1 text-[14px] text-[var(--fg)]">
              {stage.refused.map((id) => <li key={id}>{stage.labels[id] ?? label(id)} &mdash; {BULK_REFUSED_REASON}</li>)}
            </ul>
          )}
          <PrimaryButton testId="change-pick-back" onClick={() => navigate(ORG_PATHS.event(seriesId))}>Back to the event</PrimaryButton>
        </div>
      );
    } else if (stage.kind === 'confirm') {
      const cancel = stage.command.kind === 'occurrence.bulk_cancel';
      const count = stage.command.payload.occurrence_ids.length;
      body = (
        <div className="flex flex-col gap-3" data-testid="change-pick-confirm-screen">
          <p className="text-[16px] font-bold text-[var(--fg)]">
            {stage.command.kind === 'occurrence.bulk_cancel'
              ? `Cancel ${count} date${count === 1 ? '' : 's'}?`
              : `Move ${count} date${count === 1 ? '' : 's'} ${durationDays(stage.command.payload.shift_days)}?`}
          </p>
          <p className="text-[14px] text-[var(--mut)]">{cancel ? 'Dancers see Cancelled and your reason on each one.' : 'Each date keeps its time.'}</p>
          {cancel && (reasons.data ?? []).filter((r) => r.label !== DEFAULT_REASON).length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
              {(reasons.data ?? []).filter((r) => r.label !== DEFAULT_REASON).map((r) => (
                <Chip key={r.key} selected={reason === r.label} onToggle={() => {
                  const next = reason === r.label ? null : r.label;
                  setReason(next);
                  setStage({ kind: 'confirm', command: bulkCancelCommand(stage.command.payload.occurrence_ids, next ?? DEFAULT_REASON) });
                }}>{r.label}</Chip>
              ))}
            </div>
          )}
          {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-error-message">{error}</p>}
          <PrimaryButton testId="change-pick-confirm" loading={busy} onClick={() => { if (!busy) void run(stage.command); }}>
            {cancel ? `Cancel ${count} date${count === 1 ? '' : 's'}` : `Move ${count} date${count === 1 ? '' : 's'}`}
          </PrimaryButton>
          <GhostButton testId="change-pick-edit" disabled={busy} onClick={() => setStage({ kind: 'pick' })}>Change the dates</GhostButton>
        </div>
      );
    } else {
      body = (
        <div className="flex flex-col gap-3" data-testid="change-pick-screen">
          {/* F-PAR-final N4: with nothing to tick, the empty state is the whole screen. */}
          {dates.length === 0 ? (
            <>
              <p className="text-[15px] text-[var(--fg)]" data-testid="change-pick-empty">{NO_COMING}</p>
              <PrimaryButton testId="change-pick-add" onClick={() => navigate(ORG_PATHS.addEvent(seriesId))}>Add a date</PrimaryButton>
            </>
          ) : (
            <>
            <StepList testId="change-pick-list">
              {dates.map((d) => {
                const on = ticked.includes(d.occurrenceId);
                return (
                  <button key={d.occurrenceId} type="button" role="checkbox" aria-checked={on} data-testid="change-pick-date"
                    onClick={() => toggle(d.occurrenceId)} className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left">
                    <span aria-hidden="true" className={cn('flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] border', on ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--bg)]' : 'border-[var(--line)]')}>
                      {on && <Check className="h-[16px] w-[16px]" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--fg)]">{d.label}{d.time ? `, ${d.time}` : ''}</span>
                  </button>
                );
              })}
            </StepList>
            <p className="text-[13px] text-[var(--mut)]" data-testid="change-pick-count">{ids.length} ticked</p>
            <Action testId="change-pick-cancel" reason={ids.length ? null : PICK_NONE}
              onGo={() => setStage({ kind: 'confirm', command: bulkCancelCommand(ids, reason ?? DEFAULT_REASON) })}>
              Cancel the ticked dates
            </Action>
            {/* F-PAR-final S1: the server refuses every shift of a weekly or monthly series, so its reason stands in for the move controls. */}
            {shiftOff ? (
              <p className="text-[14px] text-[var(--mut)]" data-testid="change-pick-shift-off">{shiftOff}</p>
            ) : (
              <>
                <div className="flex gap-2" role="group" aria-label="Move the ticked dates">
                  <Chip testId="change-pick-earlier" selected={!later} onToggle={() => setLater(false)}>Earlier</Chip>
                  <Chip testId="change-pick-later" selected={later} onToggle={() => setLater(true)}>Later</Chip>
                </div>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--mut)]">
                  How many days {later ? 'later' : 'earlier'}
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={days} onChange={(e) => setDays(e.target.value)} data-testid="change-pick-days"
                    className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')} />
                </label>
                <Action testId="change-pick-move" reason={moveReason} ghost onGo={() => setStage({ kind: 'confirm', command: bulkShiftCommand(ids, shift) })}>
                  Move the ticked dates
                </Action>
              </>
            )}
            </>
          )}
        </div>
      );
    }
  }

  return <Step title={one ? `${one.name}: pick dates` : 'Pick dates'} back={back}>{body}</Step>;
}

const durationDays = (n: number) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} ${n < 0 ? 'earlier' : 'later'}`;

/** A button that cannot work stays focusable, says why under it, and does nothing. */
function Action({ testId, reason, onGo, ghost = false, children }: { testId: string; reason: string | null; onGo: () => void; ghost?: boolean; children: string }) {
  const Btn = ghost ? GhostButton : PrimaryButton;
  return (
    <div className="flex flex-col gap-1">
      <Btn testId={testId} aria-disabled={reason ? true : undefined} aria-describedby={reason ? `${testId}-reason` : undefined}
        className={cn(reason && 'cursor-not-allowed opacity-60')} onClick={() => { if (!reason) onGo(); }}>
        {children}
      </Btn>
      {reason && <p id={`${testId}-reason`} data-testid={`${testId}-reason`} className="text-[13px] text-[var(--mut)]">{reason}</p>}
    </div>
  );
}
