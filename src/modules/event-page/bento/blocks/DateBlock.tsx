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
        <div className="flex flex-1 flex-col justify-center">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {label.startWeekday} {label.startDay}
          </div>
          <div className="text-[22px] font-black leading-none tracking-[-0.03em]">
            {label.startMonth}
          </div>
          {label.isMultiDay && label.endDay && (
            <div
              className="mt-[2px] font-mono text-[9px] uppercase tracking-[0.14em]"
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
