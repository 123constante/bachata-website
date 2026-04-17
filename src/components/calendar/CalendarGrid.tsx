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
                  ? 'bg-gradient-to-br from-[hsl(48_90%_62%)] via-[hsl(42_95%_50%)] to-[hsl(36_88%_42%)] text-black font-black shadow-[0_0_18px_hsl(42_95%_50%/0.55)]'
                  : hasEvents
                    ? 'bg-[hsl(42_90%_50%/0.08)] hover:bg-[hsl(42_90%_50%/0.16)] shadow-[0_0_10px_hsl(42_90%_50%/0.3)]'
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
        className="mt-8 pt-6 border-t border-[hsl(42_90%_50%/0.18)] text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-[hsl(42_90%_50%/0.1)] to-[hsl(36_88%_42%/0.12)] border border-[hsl(42_90%_50%/0.2)] px-4 py-2 rounded-full cursor-default"
        >
          <span className="bg-gradient-to-r from-[hsl(48_90%_62%)] to-[hsl(36_88%_42%)] bg-clip-text text-transparent">
            Select a date to see details
          </span>
        </motion.div>
      </motion.div>
    </>
  );
};
