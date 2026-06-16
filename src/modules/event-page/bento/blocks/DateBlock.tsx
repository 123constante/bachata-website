import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { buildDateLabel } from '@/modules/event-page/bento/utils/multiDay';
import { BENTO_TYPE } from '@/modules/event-page/bento/blocks/bentoType';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

type DateBlockProps = {
  occurrence: EventPageSnapshotOccurrence | null;
  onClick?: () => void;
};

export const DateBlock = ({ occurrence, onClick }: DateBlockProps) => {
  const label = buildDateLabel(occurrence);
  const isCancelled = !!occurrence?.isCancelled;

  return (
    <BentoTile title={BLOCK_TITLES.date} color={BLOCK_COLORS.date} onClick={onClick}>
      {label ? (
        <div className="flex h-full w-full flex-1 flex-col items-center justify-center text-center">
          {/* Full weekday name on its own line so long names like "WEDNESDAY"
              don't overflow when paired with the day number. */}
          <div
            className={`font-bold uppercase leading-[1.1] tracking-[0.1em] ${isCancelled ? 'line-through opacity-60' : ''}`}
            style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.weekday }}
          >
            {label.startWeekday}
          </div>
          {/* Day number is now the prominent element — matches the universal
              calendar-icon pattern (weekday top, big day, month bottom). */}
          <div
            className={`mt-[1px] font-black leading-none tracking-[-0.03em] ${isCancelled ? 'line-through opacity-60' : ''}`}
            style={{ fontSize: BENTO_TYPE.dayNumber }}
          >
            {label.startDay}
          </div>
          <div
            className={`mt-[1px] font-bold uppercase tracking-[0.12em] ${isCancelled ? 'line-through opacity-60' : ''}`}
            style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.month }}
          >
            {label.startMonth}
          </div>
          {label.isMultiDay && label.endDay && !isCancelled && (
            <div
              className="mt-[3px] font-mono uppercase leading-[1.2] tracking-[0.12em]"
              style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.multiDay }}
            >
              &rarr; {label.endWeekday} {label.endDay}
              {label.endMonth && label.endMonth !== label.startMonth ? ` ${label.endMonth}` : ''}
            </div>
          )}
          {isCancelled && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div
                className="rounded-sm px-2 py-0.5 font-bold uppercase tracking-[0.12em] text-white"
                style={{ background: 'hsl(var(--bento-danger))', fontSize: BENTO_TYPE.badge }}
                data-testid="date-cancelled-badge"
              >
                Cancelled
              </div>
              {occurrence?.cancellationReasonLabel && (
                <div
                  className="font-semibold uppercase tracking-[0.1em]"
                  style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.badge }}
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
          className="flex flex-1 items-center justify-center"
          style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.timePast }}
        >
          TBA
        </div>
      )}
    </BentoTile>
  );
};
