import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { moveDateCommand } from '@/modules/organiser/shared/seriesCommands';
import { DateStep, type DateStepReady } from './DateStep';
import { dayDoneMessage, findSeries, moveDays } from './changeModel';
import { useChangeHome, useChangeSend } from './useChange';
import { Conflict, StepList, StepRow } from './parts';

/**
 * C5c: move this date to another day. The list is the next 30 days minus the
 * days that already hold a date of this series; a tap is the ONE command
 * (occurrence.move_date, D39). The day travels as a wall-clock YYYY-MM-DD and
 * the server rebuilds the instant from the series' time zone (R3-18).
 */
export default function Day() {
  return (
    <DateStep back={ORG_PATHS.changeDate} title={() => 'Move to'}>
      {(ready) => <DayList key={ready.occurrenceId} {...ready} />}
    </DateStep>
  );
}

function DayList({ seriesId, occurrenceId, today, ws, detail }: DateStepReady) {
  const home = useChangeHome();
  const { send, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  const series = findSeries(home.data, seriesId);
  if (conflict) return <Conflict seriesId={seriesId} />;
  const days = series ? moveDays(series, ws, today) : [];
  return (
    <>
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-error-message">{error}</p>}
      <StepList testId="change-day-list">
        {days.map((d) => (
          <StepRow
            key={d.date}
            testId="change-day-row"
            label={d.label}
            disabled={busy}
            onClick={() => { if (!busy) void send(moveDateCommand(d.date), detail.version, dayDoneMessage(d.date)); }}
          />
        ))}
      </StepList>
    </>
  );
}
