import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import {
  formatDateLabel,
  formatTime,
  formatDuration,
  isOccurrenceToday,
} from '@/modules/event-page/bento/blocks/occurrenceFormat';
import { BENTO_TYPE } from '@/modules/event-page/bento/blocks/bentoType';

type DatesBlockProps = {
  occurrences: EventPageSnapshotOccurrence[];
  currentOccurrenceId: string | null;
};

export const DatesBlock = ({ occurrences, currentOccurrenceId }: DatesBlockProps) => (
  <BentoTile title={BLOCK_TITLES.dates} color={BLOCK_COLORS.dates} mode="multi-target">
    <div className="overflow-hidden rounded-[12px]">
      {occurrences.map((occ, i) => {
        const isActive  = occ.occurrenceId === currentOccurrenceId;
        const isToday   = isOccurrenceToday(occ);
        const isPastDim = occ.isPast && !isActive;
        const dateLabel = formatDateLabel(occ);
        const time      = formatTime(occ.startsAt);
        const duration  = formatDuration(occ.startsAt, occ.endsAt);
        const isLast    = i === occurrences.length - 1;

        let rowBg: string | undefined;
        if (isActive)             rowBg = 'hsl(var(--bento-accent) / 0.05)';
        else if (occ.isCancelled) rowBg = 'hsl(var(--bento-danger) / 0.10)';
        else if (isToday)         rowBg = 'hsl(var(--bento-accent) / 0.03)';

        return (
          <Link
            key={occ.occurrenceId}
            to={`?occurrenceId=${occ.occurrenceId}`}
            aria-label={`View ${dateLabel}${occ.isCancelled ? ' (cancelled)' : ''}`}
            className="relative flex items-center px-3 py-[9px]"
            style={{
              background: rowBg,
              opacity: isPastDim ? 0.3 : undefined,
              borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.035)',
            }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-[2px]"
                style={{ background: 'hsl(var(--bento-accent))' }}
              />
            )}

            <div className="flex flex-1 flex-col gap-[2px]">
              <span
                className="leading-none"
                style={{
                  fontSize: BENTO_TYPE.dateLabel,
                  fontWeight: isActive ? 800 : 700,
                  color: occ.isCancelled ? 'hsl(var(--bento-danger) / 0.7)' : 'hsl(var(--bento-fg))',
                  textDecoration: occ.isCancelled ? 'line-through' : undefined,
                }}
              >
                {dateLabel}
              </span>

              {(isToday || occ.isCancelled) && (
                <div className="mt-[2px] flex flex-wrap gap-1">
                  {isToday && !occ.isCancelled && (
                    <span
                      className="rounded-[3px] px-[4px] py-px font-extrabold uppercase tracking-[0.06em]"
                      style={{ fontSize: BENTO_TYPE.badge, background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }}
                    >
                      Today
                    </span>
                  )}
                  {occ.isCancelled && (
                    <span
                      className="rounded-[3px] px-[4px] py-px font-extrabold uppercase tracking-[0.06em]"
                      style={{ fontSize: BENTO_TYPE.badge, background: 'hsl(var(--bento-danger))', color: '#fff' }}
                    >
                      Cancelled
                    </span>
                  )}
                </div>
              )}
            </div>

            {!occ.isCancelled && (
              <div className="flex flex-col items-end gap-[2px]">
                {time && (
                  <span
                    className="leading-none tracking-[-0.01em]"
                    style={{
                      fontSize: occ.isPast ? BENTO_TYPE.timePast : BENTO_TYPE.time,
                      fontWeight: occ.isPast ? 700 : 900,
                      color: occ.isPast
                        ? 'hsl(var(--bento-fg-muted))'
                        : 'hsl(var(--bento-accent))',
                    }}
                  >
                    {time}
                  </span>
                )}
                {duration && (
                  <span
                    className="font-semibold leading-none"
                    style={{ color: 'hsl(var(--bento-fg-muted))', fontSize: BENTO_TYPE.duration }}
                  >
                    {duration}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  </BentoTile>
);
