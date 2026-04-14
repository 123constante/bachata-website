import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { DAYS, isEventVisibleOnDay } from '@/components/calendar/calendarUtils';

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

  const getEventsForDay = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(12, 0, 0, 0);
    return events.filter((e) => isEventVisibleOnDay(e, checkDate, selectedCategory));
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < adjustedFirstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;

          const dayEvents = getEventsForDay(day);
          const isToday = isCurrentMonth && today.getDate() === day;
          const hasParty = dayEvents.some((e) => e.hasParty);
          const hasClass = dayEvents.some((e) => e.hasClass);
          const hasEvents = dayEvents.length > 0;

          return (
            <motion.button
              key={day}
              onClick={() => hasEvents && onDayClick(day)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all',
                isToday
                  ? 'bg-primary text-primary-foreground font-bold'
                  : hasEvents
                    ? 'bg-primary/10 hover:bg-primary/20 shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                    : 'hover:bg-surface',
                hasEvents && 'cursor-pointer',
              )}
            >
              <span className={cn('text-sm', !isToday && !hasEvents && 'text-muted-foreground')}>
                {day}
              </span>
              {hasEvents && (
                <div className="flex gap-0.5 mt-1">
                  {hasParty && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isToday ? 'bg-primary-foreground' : 'bg-festival-pink',
                      )}
                    />
                  )}
                  {hasClass && (
                    <div
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isToday ? 'bg-primary-foreground' : 'bg-festival-blue',
                      )}
                    />
                  )}
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

      {/* Hint when no day selected */}
      <motion.div
        className="mt-8 pt-6 border-t border-primary/20 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-full cursor-default"
        >
          Select a date to see details
        </motion.div>
      </motion.div>
    </>
  );
};
