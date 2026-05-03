// ScheduleBlock — F.2.b refactor.
//
// Responsibilities: data fetch + day-tab UI shell.
// Layout / cell rendering delegated to ScheduleGrid + SessionCell.

import { useMemo, useState } from 'react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS } from '@/modules/event-page/bento/BentoGrid';
import {
  useProgramItems,
} from '@/modules/event-page/sections/EventScheduleGrid';
import { ScheduleGrid } from './schedule/ScheduleGrid';

// --- Day pill formatter ---

const fmtDayPill = (day: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const anchored = new Date(day + 'T12:00:00');
  if (Number.isNaN(anchored.getTime())) return day;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' }).format(anchored);
    return parts.toUpperCase();
  } catch {
    return day;
  }
};

// --- Day tabs ---

const DayTabs = ({
  days,
  active,
  onPick,
}: {
  days: string[];
  active: string;
  onPick: (day: string) => void;
}) => (
  <div
    className="-mx-1 mb-3 flex shrink-0 gap-1 overflow-x-auto pb-1"
    style={{ scrollbarWidth: 'none' }}
  >
    {days.map((day) => {
      const selected = day === active;
      return (
        <button
          key={day}
          type="button"
          onClick={() => onPick(day)}
          className="flex-shrink-0 rounded-full px-[10px] py-[4px] text-[10px] font-bold uppercase tracking-[0.06em] transition-transform duration-150 active:scale-[0.97]"
          style={
            selected
              ? {
                  background: 'hsl(var(--bento-accent))',
                  color: 'hsl(var(--bento-surface))',
                  border: '1px solid hsl(var(--bento-accent))',
                }
              : {
                  background: 'transparent',
                  color: 'hsl(var(--bento-fg))',
                  border: '1px solid var(--bento-hairline)',
                }
          }
        >
          {fmtDayPill(day)}
        </button>
      );
    })}
  </div>
);

// --- Main component ---

type ScheduleBlockProps = {
  eventId: string | null;
};

export const ScheduleBlock = ({ eventId }: ScheduleBlockProps) => {
  const { data: rawSessions = [], isLoading } = useProgramItems(eventId);

  // Unique days from all sessions (day field unchanged by normalise).
  const uniqueDays = useMemo(
    () =>
      Array.from(
        new Set(rawSessions.map((s) => s.day).filter((d): d is string => Boolean(d))),
      ).sort(),
    [rawSessions],
  );
  const isMultiDay = uniqueDays.length > 1;

  const [activeDay, setActiveDay] = useState<string | null>(null);
  const currentDay = activeDay ?? uniqueDays[0] ?? null;

  // Filter to the selected day. Pass ALL sessions when single-day.
  const visibleSessions = useMemo(() => {
    if (!isMultiDay || !currentDay) return rawSessions;
    return rawSessions.filter((s) => s.day === currentDay);
  }, [rawSessions, isMultiDay, currentDay]);

  // Ordered room list — first-appearance order respects sort_order from the RPC.
  // Empty array = single-room mode (ScheduleGrid renders horizontal rows instead of a matrix).
  const orderedRooms = useMemo(() => {
    const seen  = new Set<string>();
    const order: string[] = [];
    for (const s of visibleSessions) {
      if (s.room && !seen.has(s.room)) {
        seen.add(s.room);
        order.push(s.room);
      }
    }
    return order.length >= 2 ? order : ([] as string[]);
  }, [visibleSessions]);

  return (
    <BentoTile title="" color={BLOCK_COLORS.schedule} mode="container">
      {isMultiDay && currentDay && (
        <DayTabs days={uniqueDays} active={currentDay} onPick={setActiveDay} />
      )}

      {visibleSessions.length === 0 ? (
        <div
          className="py-2 text-center text-[11px]"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {isLoading
            ? 'Loading...'
            : rawSessions.length === 0
            ? 'Schedule coming soon'
            : 'No sessions on this day'}
        </div>
      ) : (
        <ScheduleGrid
          rooms={orderedRooms}
          sessions={visibleSessions}
          eventId={eventId}
        />
      )}
    </BentoTile>
  );
};
