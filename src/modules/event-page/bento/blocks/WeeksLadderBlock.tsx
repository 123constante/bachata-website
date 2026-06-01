import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import {
  formatDateLabel,
  formatTime,
  formatDuration,
  isOccurrenceToday,
} from '@/modules/event-page/bento/blocks/occurrenceFormat';

// Approach A -- Weeks Ladder. Renders a course's occurrences as a vertical
// Week 1..N progression: a connecting spine, numbered nodes, the next session
// pulsing, and past weeks dimmed. Used in place of the flat DatesBlock when
// event.type === 'course'. Week count and ordering derive purely from the
// occurrences array (already date-ordered by the snapshot RPC).

type WeeksLadderBlockProps = {
  occurrences: EventPageSnapshotOccurrence[];
  currentOccurrenceId: string | null;
  level?: string | null;
};

export const WeeksLadderBlock = ({
  occurrences,
  currentOccurrenceId,
  level,
}: WeeksLadderBlockProps) => {
  const weekCount = occurrences.length;
  // The next session is the first non-past, non-cancelled occurrence. When
  // none remain the course has finished and nothing pulses.
  const nextIdx = occurrences.findIndex((o) => !o.isPast && !o.isCancelled);
  const finished = nextIdx === -1;

  return (
    <BentoTile title="Course" color="hsl(var(--bento-surface-raised))" mode="multi-target">
      <div className="px-1 pb-1">
        <div
          className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em]"
          style={{ color: 'hsl(var(--bento-accent))' }}
        >
          {finished ? (
            <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>Course finished</span>
          ) : (
            <>
              <span>{weekCount}-week progressive course</span>
              {level && (
                <span style={{ color: 'hsl(var(--bento-fg-muted))' }}>&middot; {level}</span>
              )}
            </>
          )}
        </div>

        <div className="relative">
          {/* Connecting spine behind the nodes. */}
          <span
            className="absolute w-[2px]"
            style={{
              left: '13px',
              top: '20px',
              bottom: '20px',
              background: 'hsl(var(--bento-accent) / 0.18)',
            }}
            aria-hidden="true"
          />

          {occurrences.map((occ, i) => {
            const isActive = occ.occurrenceId === currentOccurrenceId;
            const isUpcoming = i === nextIdx;
            const isPast = occ.isPast;
            const dimmed = isPast && !isActive;
            const dateLabel = formatDateLabel(occ);
            const time = formatTime(occ.startsAt);
            const duration = formatDuration(occ.startsAt, occ.endsAt);
            const today = isOccurrenceToday(occ);

            return (
              <Link
                key={occ.occurrenceId}
                to={`?occurrenceId=${occ.occurrenceId}`}
                className="relative flex items-center gap-3 py-[9px]"
                style={{ opacity: dimmed ? 0.4 : undefined }}
              >
                {/* Node */}
                <span className="relative z-[2] flex h-7 w-7 flex-none items-center justify-center">
                  {isUpcoming && (
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ background: 'hsl(var(--bento-accent))' }}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className="relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold"
                    style={
                      isUpcoming
                        ? { background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }
                        : {
                            background: 'hsl(var(--bento-surface))',
                            border: '2px solid hsl(var(--bento-accent) / 0.18)',
                            color: 'hsl(var(--bento-fg-muted))',
                          }
                    }
                  >
                    {i + 1}
                  </span>
                </span>

                {/* Label */}
                <div className="flex flex-1 flex-col gap-[1px]">
                  <span
                    className="text-[12px] font-extrabold leading-none"
                    style={{
                      color: occ.isCancelled
                        ? 'rgba(248,113,113,0.7)'
                        : isUpcoming
                          ? 'hsl(var(--bento-fg))'
                          : 'hsl(var(--bento-fg-muted))',
                      textDecoration: occ.isCancelled ? 'line-through' : undefined,
                    }}
                  >
                    Week {i + 1}
                  </span>
                  <span className="text-[9.5px] font-semibold" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
                    {dateLabel}
                  </span>
                  {(isUpcoming || today || occ.isCancelled) && (
                    <span className="mt-[3px] flex gap-1">
                      {occ.isCancelled ? (
                        <span
                          className="rounded-[3px] px-[4px] py-px text-[6.5px] font-extrabold uppercase tracking-[0.06em]"
                          style={{ background: '#dc2626', color: '#fff' }}
                        >
                          Cancelled
                        </span>
                      ) : (
                        <span
                          className="rounded-[3px] px-[4px] py-px text-[6.5px] font-extrabold uppercase tracking-[0.06em]"
                          style={{ background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }}
                        >
                          {today ? 'Today' : 'Next session'}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Time */}
                {!occ.isCancelled && time && (
                  <div className="flex flex-col items-end gap-[2px]">
                    <span
                      className="leading-none tracking-[-0.01em]"
                      style={{
                        fontSize: isUpcoming ? '13px' : '11px',
                        fontWeight: isUpcoming ? 900 : 700,
                        color: isUpcoming ? 'hsl(var(--bento-accent))' : 'hsl(var(--bento-fg-muted))',
                      }}
                    >
                      {time}
                    </span>
                    {duration && (
                      <span className="text-[7.5px] font-semibold leading-none" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
                        {duration}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </BentoTile>
  );
};
