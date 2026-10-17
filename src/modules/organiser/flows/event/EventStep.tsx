import { useState } from 'react';
import { weekdayOfKey } from '@/lib/londonDate';
import { lifecycleCommand } from '@/modules/organiser/shared/seriesCommands';
import { ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import {
  dayChangeCommand, otherUpcoming, readIsFull, stopRepeatingCommand, weeklyUntilCommand, wsComing, type EventWorkspace,
} from '@/modules/organiser/events/eventModel';
import { allowedEndChoices, firstOnWeekday } from '@/modules/organiser/events/dateCap';
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

/**
 * C44 + C16: stop repeating, choosing the last date (the old editor's "until"):
 * ONE series.stop_repeating keeping the coming dates up to it. The default is
 * the last listed date, so every coming date stays (as before). The keep list
 * is what stops the server deleting them (_cmd_series_stop_repeating_p5).
 */
function StopStep({ ws, today }: { ws: EventWorkspace; today: string }) {
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  const coming = wsComing(ws, today);
  const [last, setLast] = useState<string | null>(coming[coming.length - 1]?.id ?? null);
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  const cut = coming.findIndex((d) => d.id === last);
  const keep = cut < 0 ? coming : coming.slice(0, cut + 1);
  const gone = coming.length - keep.length;
  const n = keep.length;
  const dates = `${n} ${n === 1 ? 'date' : 'dates'}`;
  const line = `${dates} ${n === 1 ? 'stays' : 'stay'}.${gone ? ` ${gone} after ${n === 1 ? 'it' : 'them'} ${gone === 1 ? 'comes' : 'come'} off.` : ''} No new dates after ${n === 1 ? 'it' : 'them'}.`;
  return (
    <>
      {coming.length > 1 && (
        <>
          <p className="text-[15px] text-[var(--fg)]">Which is the last date?</p>
          <div role="radiogroup" aria-label="Last date" className="flex flex-col gap-2">
            {coming.map((d) => (
              <ChoiceButton key={d.id} selected={last === d.id} onPick={() => setLast(d.id)} testId="event-stop-last">{dayLabel(d.occurrence_date)}</ChoiceButton>
            ))}
          </div>
        </>
      )}
      <p className="text-[16px] font-bold text-[var(--fg)]" data-testid="event-stop-line">{line}</p>
      <SendButton label="Stop repeating" reason={null} busy={busy}
        onSend={() => void sendThenDone(ws.series.version, stopRepeatingCommand(keep.map((d) => d.id)), { title: 'Saved', message: `Stops repeating - ${dates} ${n === 1 ? 'stays' : 'stay'}` })} />
      <StepError text={error} />
    </>
  );
}

/**
 * C40: a `recurring` event with no rule (its dates set one by one) becomes
 * weekly: ONE series.set_recurrence on the chosen weekday, ending on a date
 * that keeps it within 30 coming dates. With no old rule the server removes
 * nothing, so every date already listed stays.
 */
function WeeklyStep({ ws, today }: { ws: EventWorkspace; today: string }) {
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  const next = wsComing(ws, today)[0]?.occurrence_date ?? null;
  const [picked, setPicked] = useState<number | null>(next ? weekdayOfKey(next) : null);
  const [until, setUntil] = useState<string | null>(null);
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  const start = picked === null ? null : firstOnWeekday(today, picked);
  const choices = start ? allowedEndChoices({ today, startDate: start, otherUpcoming: otherUpcoming(ws.dates, today, start) }) : [];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const reason = picked === null ? 'Pick a day' : !choices.length ? 'No end fits: 30 coming dates are already listed.' : !until ? 'Pick how long it is listed' : null;
  return (
    <>
      <p className="text-[15px] text-[var(--fg)]">Every week on</p>
      <div role="radiogroup" aria-label="Day" className="flex flex-col gap-2">
        {order.map((d) => (
          <ChoiceButton key={d} selected={picked === d} onPick={() => { setPicked(d); setUntil(null); }} testId={`event-day-${d}`}>{WEEKDAY[d]}</ChoiceButton>
        ))}
      </div>
      {choices.length > 0 && (
        <>
          <p className="text-[15px] text-[var(--fg)]">Listed until</p>
          <div role="radiogroup" aria-label="Listed until" className="flex flex-col gap-2">
            {choices.map((c) => (
              <ChoiceButton key={c.until} selected={until === c.until} onPick={() => setUntil(c.until)} testId="event-weekly-until">
                {`${c.count} weeks, until ${dayLabel(c.until)}`}
              </ChoiceButton>
            ))}
          </div>
        </>
      )}
      <p className="text-[14px] text-[var(--mut)]" data-testid="event-weekly-line">Dates already listed stay. New dates are added each week.</p>
      <SendButton label="Make it weekly" reason={reason} busy={busy}
        onSend={() => start && until && picked !== null && void sendThenDone(ws.series.version, weeklyUntilCommand(start, until), { title: 'Saved', message: `Every ${WEEKDAY[picked]}` })} />
      <StepError text={error} />
    </>
  );
}

/**
 * The step a `?do=` URL names, on the event's own route. A step the event
 * cannot take (a stale link, a course's stop) shows the reason, never a button.
 */
export function EventStep({ ws, today, step }: { ws: EventWorkspace; today: string; step: EventStepName }) {
  const row = eventActions(ws.series, readIsFull(ws, today))[step];
  const body = !row || row.reason ? (
    <p className="text-[15px] text-[var(--mut)]" data-testid="event-step-refused">{row?.reason ?? 'This event cannot do that now.'}</p>
  ) : step === 'pause' ? <LifecycleStep ws={ws} to="paused" />
    : step === 'resume' ? <LifecycleStep ws={ws} to="live" />
      : step === 'end' ? <EndStep ws={ws} today={today} />
        : step === 'day' ? <DayStep ws={ws} />
          : step === 'weekly' ? <WeeklyStep ws={ws} today={today} />
            : <StopStep ws={ws} today={today} />;
  return (
    <EventStepShell seriesId={ws.series.id} title={`${ACTION_LABEL[step]} - ${ws.series.name}`}>
      {body}
    </EventStepShell>
  );
}
