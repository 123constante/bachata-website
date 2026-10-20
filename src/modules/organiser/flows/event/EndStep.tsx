import { useState } from 'react';
import { WARN_END } from '@/modules/organiser/shared/copy';
import { endRunCommand, readIsFull, tonightDate, wsComing, type EventWorkspace, type TodaySession } from '@/modules/organiser/events/eventModel';
import { endLine } from './eventSteps';
import { ChoiceButton, EventConflict, SendButton, StepError } from './parts';
import { useEventSend } from './useEventSend';

/**
 * C42c: End, with its confirm line and the ONE warning (WARN_END, R3-8: only
 * an admin can leave 'ended'). A date tonight is the organiser's call (the
 * server asks: ran, or not running), so End waits for the answer. C42d is the
 * shared Done screen without Undo.
 */
export function EndStep({ ws, today }: { ws: EventWorkspace; today: string }) {
  const seriesId = ws.series.id;
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const tonight = tonightDate(ws, today);
  const [answer, setAnswer] = useState<TodaySession | null>(null);
  if (conflict) return <EventConflict seriesId={seriesId} />;
  // A full read misses the soonest dates: say what End does without a count (REVIEW-S5 SHOULD-1).
  const coming = readIsFull(ws, today) ? null : wsComing(ws, today).filter((d) => d.occurrence_date > today).length;
  const end = () => sendThenDone(ws.series.version, endRunCommand(tonight ? answer : null), { title: 'Ended', message: `Ended - ${ws.series.name}` });
  return (
    <>
      <p className="text-[16px] font-bold text-[var(--fg)]" data-testid="event-end-line">{endLine(coming)}</p>
      <p className="text-[14px] text-[var(--mut)]" data-testid="event-end-warning">{WARN_END}</p>
      {tonight && (
        <div role="radiogroup" aria-label="Tonight" className="flex flex-col gap-2">
          <ChoiceButton selected={answer === 'ran'} onPick={() => setAnswer('ran')} testId="event-end-tonight-ran">Tonight runs</ChoiceButton>
          <ChoiceButton selected={answer === 'not_running'} onPick={() => setAnswer('not_running')} testId="event-end-tonight-off">Tonight is off</ChoiceButton>
        </div>
      )}
      <SendButton label="End this event" reason={tonight && !answer ? 'Say if tonight runs' : null} busy={busy} onSend={() => void end()} />
      <StepError text={error} />
    </>
  );
}
