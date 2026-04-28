import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { buildDateLabel } from '@/modules/event-page/bento/utils/multiDay';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

type DateBlockProps = {
  occurrence: EventPageSnapshotOccurrence | null;
  onClick?: () => void;
};

export const DateBlock = ({ occurrence, onClick }: DateBlockProps) => {
  const label = buildDateLabel(occurrence);

  return (
    <BentoTile title={BLOCK_TITLES.date} color={BLOCK_COLORS.date} onClick={onClick}>
      {label ? (
        <div className="flex h-full w-full flex-1 flex-col items-center justify-center text-center">
          {/* Full weekday name on its own line so long names like "WEDNESDAY"
              don't overflow when paired with the day number. */}
          <div
            className="text-[9px] font-bold uppercase leading-[1.1] tracking-[0.1em]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {label.startWeekday}
          </div>
          {/* Day number is now the prominent element — matches the universal
              calendar-icon pattern (weekday top, big day, month bottom). */}
          <div className="mt-[1px] text-[22px] font-black leading-none tracking-[-0.03em]">
            {label.startDay}
          </div>
          <div
            className="mt-[1px] text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {label.startMonth}
          </div>
          {label.isMultiDay && label.endDay && (
            <div
              className="mt-[3px] font-mono text-[8px] uppercase leading-[1.2] tracking-[0.12em]"
              style={{ color: 'hsl(var(--bento-fg-muted))' }}
            >
              → {label.endWeekday} {label.endDay}
              {label.endMonth && label.endMonth !== label.startMonth ? ` ${label.endMonth}` : ''}
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
