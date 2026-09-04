import { runNoun } from '@/modules/event-page/bento/utils/endedRun';
import type { RunRange } from '@/modules/event-page/bento/utils/endedRun';

type EventEndedRecordProps = {
  runRange: RunRange | null;
  /** Structural shape: one_off | recurring | course | festival. */
  eventFormat: string | null;
  eventType: string | null;
  /** Discovery genre: party | class | workshop | masterclass. Without it a
   *  weekly CLASS reads as a "night", because its format is 'recurring'. */
  eventCategory: string | null;
};

// Series-termination arc P4 -- the record card ("Archive Entry", approach B).
//
// Sits at the top of the bento column and is now the ONLY statement that the
// series has finished (2026-09-04). It used to sit under a sticky
// EventEndedBanner -- "the signal you cannot miss" to this card's "statement you
// read" -- but both printed the same run dates, so an ended page opened by
// saying the same thing twice in two registers. The banner was removed, not this
// card, because this one is the superset: the dates, a format-aware sentence,
// and the lead-in to the still-running door below it.
//
// It carries the run's dates for the reason that always applied: a one-line
// banner truncates them behind its own pill on narrow screens.
//
// runRange null => date-free copy. That is the state of every page served before
// the P4a migration exposes ended_on, so it is a live path and not a fallback
// that only exists in theory.
export const EventEndedRecord = ({
  runRange,
  eventFormat,
  eventType,
  eventCategory,
}: EventEndedRecordProps) => {
  const noun = runNoun(eventFormat, eventType, eventCategory);
  return (
    <div
      className="mb-3 rounded-xl border p-3"
      style={{
        borderColor: 'hsl(var(--bento-accent) / 0.18)',
        background: 'hsl(var(--bento-surface-raised))',
      }}
      data-testid="event-ended-record"
    >
      {runRange && (
        <>
          <div
            className="text-[9px] font-black tracking-[0.14em]"
            style={{ color: 'hsl(var(--bento-accent))' }}
          >
            RAN
          </div>
          <div
            className="mt-0.5 text-lg font-extrabold leading-tight tracking-[-0.02em]"
            style={{ color: 'hsl(var(--bento-fg))' }}
          >
            {runRange.kind === 'range' ? (
              <>
                {runRange.from} &ndash; {runRange.to}
              </>
            ) : (
              <>Until {runRange.to}</>
            )}
          </div>
        </>
      )}
      <div
        className={`text-xs leading-relaxed ${runRange ? 'mt-1.5' : ''}`}
        style={{ color: 'hsl(var(--bento-fg-muted))' }}
      >
        This {noun} has finished and is no longer running. Have a look at what else is on
        below.
      </div>
    </div>
  );
};
