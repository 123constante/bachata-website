import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useCity } from '@/contexts/CityContext';
import type { Category, ViewType } from '@/components/calendar/calendarUtils';
import { MONTHS, transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarListView } from '@/components/calendar/CalendarListView';
import { DayDetailModal } from '@/components/calendar/DayDetailModal';

interface EventCalendarProps {
  defaultCategory?: Category;
}

export const EventCalendar = ({ defaultCategory = 'all' }: EventCalendarProps) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(defaultCategory);
  const [view, setView] = useState<ViewType>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const { citySlug } = useCity();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const queryStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const queryEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 0), [currentYear, currentMonth]);

  const { data: rawEvents } = useCalendarEvents({ rangeStart: queryStart, rangeEnd: queryEnd, citySlug });

  const events = useMemo(() => (rawEvents ? transformCalendarEvents(rawEvents) : []), [rawEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + (direction === 'next' ? 1 : -1));
      return next;
    });
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => setSelectedDay(day);

  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-surface/50 backdrop-blur-sm border border-primary/20 rounded-3xl overflow-hidden relative"
        >
          <div className="flex">
            {/* Main content */}
            <div className="flex-1">
              {/* Top control bar */}
              <div className="flex flex-col border-b border-primary/10">
                {/* Month navigation */}
                <div className="flex items-center justify-center px-4 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-base font-semibold min-w-[120px] text-center">
                      {MONTHS[currentMonth]} {currentYear}
                    </h3>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Category tabs */}
                <nav className="relative flex items-center justify-center gap-6 pb-4">
                  {(['all', 'parties', 'classes'] as Category[]).map((category) => (
                    <motion.button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedDay(null);
                      }}
                      className={cn(
                        'relative text-sm font-medium px-2 py-2 transition-colors',
                        selectedCategory === category
                          ? category === 'parties'
                            ? 'text-festival-pink'
                            : category === 'classes'
                              ? 'text-festival-blue'
                              : 'text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span className="flex items-center gap-1.5">
                        {category === 'all' && <><span className="text-xs">✨</span> All</>}
                        {category === 'parties' && <><span className="text-xs">🎉</span> Parties</>}
                        {category === 'classes' && <><span className="text-xs">🎓</span> Classes</>}
                      </span>
                      {selectedCategory === category && (
                        <motion.div
                          layoutId="activeTabUnderline"
                          className={cn(
                            'absolute bottom-0 left-0 right-0 h-0.5 rounded-full',
                            category === 'parties'
                              ? 'bg-festival-pink'
                              : category === 'classes'
                                ? 'bg-festival-blue'
                                : 'bg-primary',
                          )}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </nav>
              </div>

              {/* Content area */}
              <div className="p-4 pt-4 min-h-[400px]">
                {view === 'calendar' ? (
                  <CalendarGrid
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    selectedCategory={selectedCategory}
                    events={events}
                    onDayClick={handleDayClick}
                  />
                ) : (
                  <CalendarListView
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    selectedCategory={selectedCategory}
                    events={events}
                    onClearFilters={() => setSelectedCategory('all')}
                  />
                )}
              </div>
            </div>

            {/* View tabs (vertical, right side) */}
            <div className="flex flex-col border-l border-primary/10">
              {(['calendar', 'list'] as ViewType[]).map((viewType) => (
                <button
                  key={viewType}
                  onClick={() => setView(viewType)}
                  className={cn(
                    'px-2 py-4 text-[10px] font-medium transition-all relative',
                    '[writing-mode:vertical-rl] rotate-180',
                    view === viewType
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface/50',
                  )}
                >
                  {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Day detail modal */}
      <DayDetailModal
        selectedDay={selectedDay}
        currentMonth={currentMonth}
        currentYear={currentYear}
        parentCategory={selectedCategory}
        events={events}
        onClose={() => setSelectedDay(null)}
      />
    </section>
  );
};

export default EventCalendar;
