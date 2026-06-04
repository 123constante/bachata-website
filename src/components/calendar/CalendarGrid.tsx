import { motion, useReducedMotion } from 'framer-motion';
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

  const displayCells = cells;

  const prefersReducedMotion = useReducedMotion();
  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleString('en-GB', { month: 'long' });

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
          if (day === null) return <div key={`empty-${index}`} aria-hidden="true" className="aspect-square rounded-xl" />;

          const isPast = isCurrentMonth && day < today.getDate();
          if (isPast) {
            return (
              <div
                key={`past-${day}`}
                className="aspect-square rounded-xl flex items-center justify-center"
              >
                <span className="text-sm text-muted-foreground/40">{day}</span>
              </div>
            );
          }

          const checkDate = new Date(currentYear, currentMonth, day);
          checkDate.setHours(12, 0, 0, 0);
          const { hasEvents, hasParty, hasClass, hasFestival } = getDayDotFlags(events, checkDate, selectedCategory);
          const isToday = isCurrentMonth && today.getDate() === day;

          return (
            <motion.button
              key={day}
              onClick={() => hasEvents && onDayClick(day)}
              aria-label={`${day} ${monthLabel} ${currentYear}${hasEvents ? ', view events' : ', no events'}`}
              aria-current={isToday ? 'date' : undefined}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              className={cn(
                'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all',
                isToday
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : hasEvents
                    ? 'hover:bg-white/5 shadow-[0_0_8px_hsl(42_90%_50%/0.10)]'
                    : 'hover:bg-surface',
                hasEvents && 'cursor-pointer',
              )}
            >
              <span className={cn('text-sm font-semibold', !isToday && !hasEvents && 'text-muted-foreground')}>
                {day}
              </span>
              {hasEvents && (
                <div className="flex gap-0.5 mt-1">
                  {hasFestival && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-amber-200/50" title="Festival" />}
                  {hasParty && <div className="w-1.5 h-1.5 rounded-full bg-festival-pink" />}
                  {hasClass && <div className="w-1.5 h-1.5 rounded-full bg-festival-blue" />}
                  {!hasParty && !hasClass && !hasFestival && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isToday ? 'bg-primary ring-1 ring-primary-foreground' : 'bg-primary',
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
