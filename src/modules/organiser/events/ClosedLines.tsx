import { closedLines, type EventWorkspace } from './eventModel';

/** An ended or archived event: why nothing here can change, and when it ended (the one-event screen and Details). */
export function ClosedLines({ ws, today, testId }: { ws: EventWorkspace; today: string; testId: string }) {
  const { lock, endedOn } = closedLines(ws, today);
  if (!lock && !endedOn) return null;
  return (
    <div className="flex flex-col gap-1 px-[4px]">
      {endedOn && <p className="text-[14px] font-semibold text-[var(--fg)]" data-testid={`${testId}-ended-on`}>{endedOn}</p>}
      {lock && <p className="text-[14px] text-[var(--mut)]" data-testid={`${testId}-lock`}>{lock}</p>}
    </div>
  );
}
