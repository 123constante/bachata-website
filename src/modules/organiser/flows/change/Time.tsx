import { useState } from 'react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { setTimeCommand } from '@/modules/organiser/shared/seriesCommands';
import { localAsZTime } from '@/modules/organiser/shared/homeModel';
import { FIELD_CLASS } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { DateStep, type DateStepReady } from './DateStep';
import { timeDoneMessage } from './changeModel';
import { useChangeSend } from './useChange';
import { SaveButton } from './parts';
import { EventConflict } from '../event/parts';

/** C5: the time of this one date. Save only once the time differs from the current one. */
export default function Time() {
  return (
    <DateStep back={ORG_PATHS.changeDate}>
      {(ready) => <TimeForm key={ready.occurrenceId} {...ready} />}
    </DateStep>
  );
}

function TimeForm({ seriesId, occurrenceId, date, detail }: DateStepReady) {
  // The date's own start (what set_time writes and what "which date" shows), so one
  // fact reads the same on both screens; event_view's session-derived start is the fallback.
  const current = localAsZTime(date.materialised_start_utc) ?? detail.start ?? '';
  const [value, setValue] = useState(current);
  const { send, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  if (conflict) return <EventConflict seriesId={seriesId} testId="change-conflict" />;
  const ready = /^\d{2}:\d{2}$/.test(value) && value !== current;
  return (
    <div className="flex flex-col gap-3" data-testid="change-time-screen">
      <input
        type="time"
        aria-label="Start time"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 5))}
        data-testid="change-time-input"
        className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')}
      />
      <SaveButton
        ready={ready}
        reason="Pick a new time"
        busy={busy}
        error={error}
        // An empty end lets the server keep the date's length.
        onSave={() => void send(setTimeCommand(value, null), detail.version, timeDoneMessage(value))}
      />
    </div>
  );
}
