import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { courseLadderModel } from '@/modules/event-page/bento/blocks/courseLadderModel';
import {
  formatDateLabel,
  formatTime,
  formatDuration,
  isOccurrenceToday,
} from '@/modules/event-page/bento/blocks/occurrenceFormat';

// Approach A -- Weeks Ladder. Renders a course's occurrences as a vertical
// Week 1..N progression: a connecting spine, numbered nodes, the next session
// pulsing, and past weeks dimmed. Used in place of the flat DatesBlock when
// event.type === 'course'.
//
// The arithmetic lives in courseLadderModel, not here: a cancelled night is
// unnumbered and does not count, so a four-date course with one night called
// off is a three-week course whose remaining weeks renumber. Deriving that from
// the array index -- which is what this file used to do -- got both answers
// wrong the moment anything was cancelled. Ordering is the snapshot RPC's.
//
// A cancelled row therefore shows a dot instead of a numbered node and reads
// "Cancelled" where the week number would be. It carries no Cancelled badge:
// the row already says so, in the slot the reader is looking at.

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
  const { rows, weekCount, finished } = courseLadderModel(occurrences);

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

          {rows.map(({ occurrence: occ, weekNumber, isNext, isPast, isCancelled }) => {
            const isActive = occ.occurrenceId === currentOccurrenceId;
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
                {/* Node -- numbered when the session is going ahead, a dot when not. */}
                <span className="relative z-[2] flex h-7 w-7 flex-none items-center justify-center">
                  {isNext && (
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ background: 'hsl(var(--bento-accent))' }}
                      aria-hidden="true"
                    />
                  )}
                  {isCancelled ? (
                    <span
                      className="relative flex h-7 w-7 items-center justify-center"
                      aria-hidden="true"
                    >
                      <span
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ background: 'hsl(var(--bento-fg-muted) / 0.55)' }}
                      />
                    </span>
                  ) : (
                    <span
                      className="relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold"
                      style={
                        isNext
                          ? { background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }
                          : {
                              background: 'hsl(var(--bento-surface))',
                              border: '2px solid hsl(var(--bento-accent) / 0.18)',
                              color: 'hsl(var(--bento-fg-muted))',
                            }
                      }
                    >
                      {weekNumber}
                    </span>
                  )}
                </span>

                {/* Label */}
                <div className="flex flex-1 flex-col gap-[1px]">
                  <span
                    className="text-[12px] font-extrabold leading-none"
                    style={{
                      color: isCancelled
                        ? 'rgba(248,113,113,0.7)'
                        : isNext
                          ? 'hsl(var(--bento-fg))'
                          : 'hsl(var(--bento-fg-muted))',
                    }}
                  >
                    {isCancelled ? 'Cancelled' : `Week ${weekNumber}`}
                  </span>
                  <span className="text-[9.5px] font-semibold" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
                    {dateLabel}
                  </span>
                  {!isCancelled && (isNext || today) && (
                    <span className="mt-[3px] flex gap-1">
                      <span
                        className="rounded-[3px] px-[4px] py-px text-[6.5px] font-extrabold uppercase tracking-[0.06em]"
                        style={{ background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' }}
                      >
                        {today ? 'Today' : 'Next session'}
                      </span>
                    </span>
                  )}
                </div>

                {/* Time */}
                {!isCancelled && time && (
                  <div className="flex flex-col items-end gap-[2px]">
                    <span
                      className="leading-none tracking-[-0.01em]"
                      style={{
                        fontSize: isNext ? '13px' : '11px',
                        fontWeight: isNext ? 900 : 700,
                        color: isNext ? 'hsl(var(--bento-accent))' : 'hsl(var(--bento-fg-muted))',
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
