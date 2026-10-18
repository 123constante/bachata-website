import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { resetTimeCommand, setTimeCommand } from '@/modules/organiser/shared/seriesCommands';
import { localAsZTime } from '@/modules/organiser/shared/homeModel';
import { toDraft } from '@/modules/organiser/shared/programmeModel';
import { sessionName, typeLabel } from '@/modules/organiser/shared/sessionSummary';
import { useNextDateProgramme } from '@/modules/organiser/events/eventsApi';
import { FIELD_CLASS, GhostButton } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { DateStep, type DateStepReady } from './DateStep';
import {
  END_GUARD, FESTIVAL_TIME, deltaLine, endBoxShown, endProblem, festivalTimeNext, hasOwnTime, isFestival, lastEnding, nightStart, previewTimes, timeDelta,
  timeDoneMessage, type TimedSession,
} from './changeModel';
import { useChangeSend } from './useChange';
import { Loading, SaveButton, StepList, StepRow } from './parts';
import { EventConflict } from '../event/parts';

/** The reset button's label AND its done line (F-PAR N2: one wording). */
export const BACK_TO_USUAL_DONE = 'Back to the usual time';

/**
 * C5: the time of this one date, with its sessions (PARITY-GAP "What Change
 * time would need to show"). occurrence.set_time moves EVERY session by the
 * same delta, so the screen shows exactly that before Save. A typed end is
 * offered only where the server gives it to the session the night ends with
 * (endBoxShown, F-PAR decision 1); elsewhere the organiser changes one
 * session's time. One pinned command per save.
 */
export default function Time() {
  return (
    <DateStep back={ORG_PATHS.changeDate}>
      {(ready) => (isFestival(ready.ws.series)
        ? <FestivalTime seriesId={ready.seriesId} occurrenceId={ready.occurrenceId} />
        : <TimeForm key={ready.occurrenceId} {...ready} />)}
    </DateStep>
  );
}

/** F-PAR-final N2: set_time refuses a festival, so the reason and the way on come before any form. */
function FestivalTime({ seriesId, occurrenceId }: { seriesId: string; occurrenceId: string }) {
  const navigate = useNavigate();
  const programme = useNextDateProgramme(occurrenceId);
  if (programme.isPending) return <Loading />;
  const editable = !!programme.data?.editable;
  return (
    <div className="flex flex-col gap-3" data-testid="change-time-festival">
      <p className="text-[15px] text-[var(--fg)]">{FESTIVAL_TIME}</p>
      <p className="text-[14px] text-[var(--mut)]">{festivalTimeNext(editable)}</p>
      {editable && (
        <GhostButton testId="change-time-festival-sessions" onClick={() => navigate(ORG_PATHS.dateLineup(seriesId, occurrenceId))}>
          Open Sessions
        </GhostButton>
      )}
    </div>
  );
}

function TimeForm({ seriesId, occurrenceId, date, detail, ws }: DateStepReady) {
  const navigate = useNavigate();
  const ids = useId();
  const programme = useNextDateProgramme(occurrenceId);
  // The date's own start (what set_time writes and what "which date" shows), so one
  // fact reads the same on both screens; event_view's session-derived start is the fallback.
  const current = localAsZTime(date.materialised_start_utc) ?? detail.start ?? '';
  const [value, setValue] = useState(current);
  const [end, setEnd] = useState('');
  const { send, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  if (conflict) return <EventConflict seriesId={seriesId} testId="change-conflict" />;
  if (programme.isPending) return <Loading />;

  const sessions: TimedSession[] = programme.data
    ? toDraft(programme.data.sessions, programme.data.sessionPeople)
      .filter((s) => !s.removed && s.start)
      // The night's order (08:00 rollover): an after-midnight session comes last.
      .sort((a, b) => (nightStart(a.start) ?? 0) - (nightStart(b.start) ?? 0))
      .map((s) => ({ key: s.key, name: sessionName(s), kind: typeLabel(s.type), start: s.start, end: s.end }))
    : [];
  const many = sessions.length > 1;
  const endBox = endBoxShown(sessions);
  const last = lastEnding(sessions);
  const currentEnd = (sessions.length === 1 && sessions[0].end) || detail.end || '';
  const delta = timeDelta(current, value);
  // A typed end is kept even when it equals today's end: moving the start
  // without it would push the end by the same delta.
  const endGiven = endBox && /^\d{2}:\d{2}$/.test(end);
  const startOk = /^\d{2}:\d{2}$/.test(value);
  const endTyped = endGiven && (end !== (last?.end ?? currentEnd) || value !== current);
  const lastNewStart = (delta === null ? null : previewTimes(sessions, delta, null).find((s) => s.key === last?.key)?.newStart) ?? value;
  const badEnd = endTyped ? endProblem(many ? lastNewStart : value, end) : null;
  const ready = startOk && (value !== current || endTyped) && !badEnd;
  // An end the server would refuse never shows as a new time (PAR-B S1): the old end, moved, stays.
  const preview = delta === null
    ? sessions.map((s) => ({ ...s, newStart: s.start, newEnd: s.end }))
    : previewTimes(sessions, delta, endTyped && !badEnd ? end : null);
  const own = hasOwnTime(date, ws.series.default_local_start_time);
  const endLabel = many && last ? `End of ${last.name}` : 'End time';
  // PAR-B S3: the date can start before its first session (a door time); say which start this is.
  const startLabel = sessions.length && sessions[0].start !== current ? 'Night starts' : many ? 'New start' : 'Start time';
  const one = sessions.length === 1 ? preview[0] : null;
  const oneMoved = !!one && (one.newStart !== one.start || one.newEnd !== one.end);
  const endNow = last?.end ?? currentEnd;
  const startId = `${ids}-start`;
  const endId = `${ids}-end`;
  const hintId = `${ids}-hint`;

  return (
    <div className="flex flex-col gap-3" data-testid="change-time-screen">
      {many && (
        <StepList testId="change-time-sessions">
          {preview.map((s) => {
            const moved = s.newStart !== s.start || s.newEnd !== s.end;
            return (
              <div key={s.key} data-testid="change-time-session" className="flex min-h-[48px] items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{s.name}</span>
                  <span className="block text-[13px] text-[var(--mut)]">{s.kind}</span>
                </span>
                <span className="shrink-0 text-right text-[14px]">
                  <span className={cn('block', moved ? 'text-[var(--mut)] line-through' : 'text-[var(--fg)]')}>{s.start}&ndash;{s.end}</span>
                  {moved && <span className="block font-semibold text-[var(--fg)]">{s.newStart}&ndash;{s.newEnd}</span>}
                </span>
              </div>
            );
          })}
        </StepList>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={startId} className="text-[13px] font-semibold text-[var(--mut)]" data-testid="change-time-start-label">{startLabel}</label>
        <input
          id={startId}
          type="time"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 5))}
          data-testid="change-time-input"
          className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')}
        />
      </div>
      {endBox ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={endId} className="text-[13px] font-semibold text-[var(--mut)]">{endLabel} (optional)</label>
          <input
            id={endId}
            type="time"
            aria-describedby={hintId}
            value={end}
            placeholder={endNow}
            onChange={(e) => setEnd(e.target.value.slice(0, 5))}
            data-testid="change-time-end"
            className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')}
          />
          <span id={hintId} className="text-[13px] text-[var(--mut)]">Leave it empty to keep the length{endNow ? ` (ends ${endNow} now)` : ''}.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1" data-testid="change-time-end-guard">
          <p className="text-[14px] text-[var(--fg)]">{END_GUARD}.</p>
          <button
            type="button"
            data-testid="change-time-end-sessions"
            onClick={() => navigate(ORG_PATHS.dateLineup(seriesId, occurrenceId))}
            className="inline-flex min-h-[44px] items-center self-start text-[15px] font-semibold text-[var(--gold)] underline"
          >
            Open Sessions
          </button>
        </div>
      )}
      {/* Mounted from the start so the first change is announced (PAR-B N9). */}
      <div aria-live="polite" data-testid="change-time-live" className="text-[14px] font-semibold text-[var(--fg)]">
        {many && delta !== null && delta !== 0 && <p data-testid="change-time-delta">{deltaLine(delta)}</p>}
        {one && oneMoved && (
          <p data-testid="change-time-one-preview">Now {one.start}&ndash;{one.end} &rarr; new {one.newStart}&ndash;{one.newEnd}</p>
        )}
      </div>
      <SaveButton
        ready={ready}
        reason={badEnd ?? 'Pick a new time'}
        busy={busy}
        error={error}
        // An empty end lets the server keep the date's length.
        onSave={() => void send(setTimeCommand(value, endTyped ? end : null), detail.version, timeDoneMessage(value))}
      />
      <StepList testId="change-time-more">
        <StepRow
          testId="change-time-one"
          label={<>Change one session&rsquo;s time</>}
          sub={<>Open this date&rsquo;s sessions</>}
          onClick={() => navigate(ORG_PATHS.dateLineup(seriesId, occurrenceId))}
        />
      </StepList>
      {own && (
        <GhostButton
          testId="change-time-reset"
          disabled={busy}
          onClick={() => void send(resetTimeCommand(), detail.version, BACK_TO_USUAL_DONE)}
        >
          {BACK_TO_USUAL_DONE}{ws.series.default_local_start_time ? ` (${ws.series.default_local_start_time.slice(0, 5)})` : ''}
        </GhostButton>
      )}
    </div>
  );
}
