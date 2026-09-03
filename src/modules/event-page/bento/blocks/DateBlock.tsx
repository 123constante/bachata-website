import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { buildDateLabel } from '@/modules/event-page/bento/utils/multiDay';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

type DateBlockProps = {
  occurrence: EventPageSnapshotOccurrence | null;
  /** Series-termination arc P4: the SERIES has stopped for good. Distinct from
   *  a past date on a series that still runs, which gets no treatment here. */
  isEnded?: boolean;
  onClick?: () => void;
};

export const DateBlock = ({ occurrence, isEnded = false, onClick }: DateBlockProps) => {
  const label = buildDateLabel(occurrence);
  const isCancelled = !!occurrence?.isCancelled;
  // Both states dim the date; only a cancellation strikes it through. An ended
  // series' final night DID happen -- striking it out would say it did not.
  //
  // Which night this is changed with P4c: occurrence_effective for an ended
  // series now resolves from the stored ended_on (the LAST night), where it used
  // to fall through to the future-first featured helper and land on the
  // FIRST-ever night. So this tile is the closing date, and the record card
  // above carries the full run.
  const dim = isCancelled || isEnded;
  const dateText = `${isCancelled ? 'line-through ' : ''}${dim ? 'opacity-60' : ''}`;

  return (
    <BentoTile title={BLOCK_TITLES.date} color={BLOCK_COLORS.date} onClick={onClick}>
      {label ? (
        <div
          className="flex h-full w-full flex-1 flex-col items-center justify-center text-center"
          // Desaturate rather than recolour: the tile keeps its own accent token,
          // so this stays correct if BLOCK_COLORS.date ever changes.
          style={isEnded ? { filter: 'saturate(0.35)' } : undefined}
          data-testid={isEnded ? 'date-ended' : undefined}
        >
          {/* Full weekday name on its own line so long names like "WEDNESDAY"
              don't overflow when paired with the day number. */}
          <div
            className={`text-[9px] font-bold uppercase leading-[1.1] tracking-[0.1em] ${dateText}`}
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {label.startWeekday}
          </div>
          {/* Day number is now the prominent element — matches the universal
              calendar-icon pattern (weekday top, big day, month bottom). */}
          <div
            className={`mt-[1px] text-[22px] font-black leading-none tracking-[-0.03em] ${dateText}`}
          >
            {label.startDay}
          </div>
          <div
            className={`mt-[1px] text-[10px] font-bold uppercase tracking-[0.12em] ${dateText}`}
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {label.startMonth}
          </div>
          {label.isMultiDay && label.endDay && !isCancelled && (
            <div
              className="mt-[3px] font-mono text-[8px] uppercase leading-[1.2] tracking-[0.12em]"
              style={{ color: 'hsl(var(--bento-fg-muted))' }}
            >
              → {label.endWeekday} {label.endDay}
              {label.endMonth && label.endMonth !== label.startMonth ? ` ${label.endMonth}` : ''}
            </div>
          )}
          {/* Caps stack in the same order the banners do: ENDED above CANCELLED.
              A series can finish its run with its final night called off, and the
              cancelled cap is the only place the reason is shown. */}
          {(isEnded || isCancelled) && (
            <div className="mt-2 flex flex-col items-center gap-1">
              {isEnded && (
                <div
                  className="rounded-sm bg-slate-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white"
                  data-testid="date-ended-badge"
                >
                  Ended
                </div>
              )}
              {isCancelled && (
                <div
                  className="rounded-sm bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white"
                  data-testid="date-cancelled-badge"
                >
                  Cancelled
                </div>
              )}
              {isCancelled && occurrence?.cancellationReasonLabel && (
                <div
                  className="text-[8px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: 'hsl(var(--bento-fg-muted))' }}
                  data-testid="date-cancelled-reason"
                >
                  {occurrence.cancellationReasonLabel}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex flex-1 items-center justify-center text-[11px]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          TBA
        </div>
      )}
    </BentoTile>
  );
};
