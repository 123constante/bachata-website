import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { DAYS, getDayDotFlags } from '@/components/calendar/calendarUtils';

interface CalendarGridProps {
  currentMonth: number;
  currentYear: number;
  selectedCategory: Category;
  events: CalendarEventItem[];
  onDayClick: (day: number) => void;
}

export const CalendarGrid = ({
  currentMonth,
  currentYear,
  selectedCategory,
  events,
  onDayClick,
}: CalendarGridProps) => {
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  const cells: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Collapse fully-invisible leading weeks in the current month so the user
  // doesn't stare at rows of past-date blanks. A week is dropped when every
  // cell is either a leading-null or a past-date. Non-current months render
  // all weeks untouched so trailing months aren't affected.
  let displayCells = cells;
  if (isCurrentMonth) {
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const visibleWeeks = weeks.filter((week) =>
      week.some((c) => c !== null && c >= today.getDate()),
    );
    displayCells = visibleWeeks.flat();
  }

  return (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-bold tracking-wider uppercase text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 auto-rows-fr gap-1">
        {displayCells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="aspect-square rounded-xl" />;

          const isPast = isCurrentMonth && day < today.getDate();
          if (isPast) return <div key={`past-${day}`} className="aspect-square rounded-xl" />;

          const checkDate = new Date(currentYear, currentMonth, day);
          checkDate.setHours(12, 0, 0, 0);
          const { hasEvents, hasParty, hasClass } = getDayDotFlags(events, checkDate, selectedCategory);
          const isToday = isCurrentMonth && today.getDate() === day;

          return (
            <motion.button
              key={day}
              onClick={() => hasEvents && onDayClick(day)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all',
                isToday
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : hasEvents
                    ? 'hover:bg-white/5 shadow-[0_0_8px_hsl(42_90%_50%/0.15)]'
                    : 'hover:bg-surface',
                hasEvents && 'cursor-pointer',
              )}
            >
              <span className={cn('text-sm font-semibold', !isToday && !hasEvents && 'text-muted-foreground')}>
                {day}
              </span>
              {hasEvents && (
                <div className="flex gap-0.5 mt-1">
                  {hasParty && <div className="w-1.5 h-1.5 rounded-full bg-festival-pink" />}
                  {hasClass && <div className="w-1.5 h-1.5 rounded-full bg-festival-blue" />}
                  {!hasParty && !hasClass && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isToday ? 'bg-primary-foreground' : 'bg-primary',
                      )}
                    />
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </>
  );
};
