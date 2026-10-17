import { useState } from 'react';
import { lifecycleCommand } from '@/modules/organiser/shared/seriesCommands';
import { ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { dayChangeCommand, stopKeepingCommand, wsComing, type EventWorkspace } from '@/modules/organiser/events/eventModel';
import { EndStep } from './EndStep';
import { ACTION_LABEL, WEEKDAY, eventActions, type EventStepName } from './eventSteps';
import { ChoiceButton, EventConflict, EventStepShell, SendButton, StepError } from './parts';
import { useEventSend } from './useEventSend';

/** C42a-b: Pause / Resume, ONE series.set_lifecycle {to}. */
function LifecycleStep({ ws, to }: { ws: EventWorkspace; to: 'paused' | 'live' }) {
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  const done = to === 'paused'
    ? { title: 'Paused', message: `Paused - ${ws.series.name}` }
    : { title: 'Live', message: `Live - ${ws.series.name}` };
  return (
    <>
      <SendButton label={to === 'paused' ? 'Pause' : 'Resume'} reason={null} busy={busy}
        onSend={() => void sendThenDone(ws.series.version, lifecycleCommand(to), done)} />
      <StepError text={error} />
    </>
  );
}

/** C43: change the day, ONE series.set_recurrence (the rule's end kept); Save waits for a new day. */
function DayStep({ ws }: { ws: EventWorkspace }) {
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  const current = ownerWeeklyRule(ws.series)?.weekdays[0] ?? null;
  const [picked, setPicked] = useState<number | null>(current);
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  // Monday first, Sunday last.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const save = () => picked !== null && sendThenDone(ws.series.version, dayChangeCommand(ws.series.recurrence_rule, picked), {
    title: 'Saved', message: `Every ${WEEKDAY[picked]}`,
  });
  return (
    <>
      <div role="radiogroup" aria-label="Day" className="flex flex-col gap-2">
        {order.map((d) => (
          <ChoiceButton key={d} selected={picked === d} onPick={() => setPicked(d)} testId={`event-day-${d}`}>{WEEKDAY[d]}</ChoiceButton>
        ))}
      </div>
      <SendButton label="Change the day" reason={picked === current ? 'Pick another day' : null} busy={busy} onSend={() => void save()} />
      <StepError text={error} />
    </>
  );
}

/** C44: stop repeating, a confirm then ONE series.stop_repeating keeping every coming date. */
function StopStep({ ws, today }: { ws: EventWorkspace; today: string }) {
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  const n = wsComing(ws, today).length;
  const dates = `${n} ${n === 1 ? 'date' : 'dates'}`;
  return (
    <>
      <p className="text-[16px] font-bold text-[var(--fg)]" data-testid="event-stop-line">{`${dates} stay. No new dates after them.`}</p>
      <SendButton label="Stop repeating" reason={null} busy={busy}
        onSend={() => void sendThenDone(ws.series.version, stopKeepingCommand(ws, today), { title: 'Saved', message: `Stops repeating - ${dates} stay` })} />
      <StepError text={error} />
    </>
  );
}

/**
 * The step a `?do=` URL names, on the event's own route. A step the event
 * cannot take (a stale link, a course's stop) shows the reason, never a button.
 */
export function EventStep({ ws, today, step }: { ws: EventWorkspace; today: string; step: EventStepName }) {
  const row = eventActions(ws.series)[step];
  const body = !row || row.reason ? (
    <p className="text-[15px] text-[var(--mut)]" data-testid="event-step-refused">{row?.reason ?? 'This event cannot do that now.'}</p>
  ) : step === 'pause' ? <LifecycleStep ws={ws} to="paused" />
    : step === 'resume' ? <LifecycleStep ws={ws} to="live" />
      : step === 'end' ? <EndStep ws={ws} today={today} />
        : step === 'day' ? <DayStep ws={ws} />
          : <StopStep ws={ws} today={today} />;
  return (
    <EventStepShell seriesId={ws.series.id} title={`${ACTION_LABEL[step]} - ${ws.series.name}`}>
      {body}
    </EventStepShell>
  );
}
