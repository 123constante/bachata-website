import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Filter, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { DAYS, MONTHS, isEventVisibleOnDay, matchesCategory, mondayIndex } from '@/components/calendar/calendarUtils';
import { eventCardColour } from '@/lib/eventCardColour';

interface DayDetailModalProps {
  selectedDay: number | null;
  currentMonth: number;
  currentYear: number;
  parentCategory: Category;
  events: CalendarEventItem[];
  onClose: () => void;
  /** Optional: when provided, prev/next day navigation is enabled inside the modal. */
  onChangeDate?: (newDate: Date) => void;
  /** When true, the modal shows a skeleton instead of the empty-state — used to
      avoid the brief "no events" flash during cross-month refetches. */
  eventsLoading?: boolean;
}

export const DayDetailModal = ({
  selectedDay,
  currentMonth,
  currentYear,
  parentCategory,
  events,
  onClose,
  onChangeDate,
  eventsLoading = false,
}: DayDetailModalProps) => {
  const [popupFilter, setPopupFilter] = useState<Category>(parentCategory);
  const [isMobile, setIsMobile] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    // Horizontal swipe wins if it dominates and clears the threshold.
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
      if (deltaX < 0) goToNextDay();
      else goToPrevDay();
    } else if (deltaY > 80) {
      onClose();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  // Sync filter when parentCategory or selectedDay changes
  const syncedFilter = parentCategory;

  const allDayEvents = selectedDay
    ? events.filter((e) => {
        const checkDate = new Date(currentYear, currentMonth, selectedDay);
        checkDate.setHours(12, 0, 0, 0);
        return isEventVisibleOnDay(e, checkDate, 'all');
      })
    : [];

  const displayedEvents = allDayEvents.filter((e) => matchesCategory(e, popupFilter));
  const selectedDate = selectedDay ? new Date(currentYear, currentMonth, selectedDay) : null;
  const prevDate = selectedDate ? addDays(selectedDate, -1) : null;
  const nextDate = selectedDate ? addDays(selectedDate, 1) : null;

  const goToPrevDay = () => {
    if (prevDate && onChangeDate) onChangeDate(prevDate);
  };
  const goToNextDay = () => {
    if (nextDate && onChangeDate) onChangeDate(nextDate);
  };

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setShowBottomFade(hasOverflow && !atBottom);
  };

  useEffect(updateFade, [displayedEvents.length, selectedDay, popupFilter]);

  return (
    <>
    <Dialog
      open={!!selectedDay}
      onOpenChange={(open) => {
        if (!open) onClose();
        else setPopupFilter(syncedFilter);
      }}
    >
      <DialogContent className="max-w-md w-full h-[85vh] sm:h-[600px] p-0 gap-0 overflow-hidden bg-zinc-900 border-white/10 sm:rounded-3xl rounded-t-[32px] flex flex-col shadow-2xl [&>button]:hidden">
        <div className="shrink-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Grab handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" aria-hidden="true" />
          </div>
          <DialogHeader className="px-6 pt-3 pb-4 border-b border-white/5 bg-background/95 backdrop-blur-xl space-y-5">
          {/* Headline date */}
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              aria-label="Back to calendar"
              className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 opacity-80 group-hover:opacity-100" />
            </button>

            <DialogTitle className="flex items-end gap-0.5 select-none flex-1 min-w-0">
              <span className="text-7xl font-black leading-[0.75] tracking-tighter text-primary">
                {selectedDay}
              </span>
              <div className="flex flex-col pb-1.5 pl-1 min-w-0">
                <span className="text-4xl font-black uppercase tracking-tighter text-foreground leading-[0.85]">
                  {selectedDate && DAYS[mondayIndex(selectedDate.getDay())]}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5 ml-0.5">
                  {MONTHS[currentMonth]} {currentYear}
                </span>
              </div>
            </DialogTitle>

            <button
              onClick={onClose}
              aria-label="Close"
              className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            >
              <X className="w-5 h-5 opacity-80 group-hover:opacity-100" />
            </button>
          </div>

          {/* Mobile prev / next day navigation (desktop uses fixed-position portal pills) */}
          {onChangeDate && isMobile && prevDate && nextDate && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={goToPrevDay}
                aria-label={`Previous day, ${format(prevDate, 'EEEE MMMM d')}`}
                className="flex items-center justify-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 py-2 px-3 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">{format(prevDate, 'EEE MMM d')}</span>
              </button>
              <button
                onClick={goToNextDay}
                aria-label={`Next day, ${format(nextDate, 'EEEE MMMM d')}`}
                className="flex items-center justify-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 py-2 px-3 transition-colors"
              >
                <span className="text-xs font-medium">{format(nextDate, 'EEE MMM d')}</span>
                <ChevronRight className="w-4 h-4 text-primary" />
              </button>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex items-center justify-around w-full border-b border-white/10">
            {(['all', 'parties', 'classes'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setPopupFilter(cat)}
                className={cn(
                  'flex-1 py-4 text-sm font-bold uppercase tracking-wider relative transition-colors',
                  popupFilter === cat
                    ? cat === 'parties'
                      ? 'text-festival-pink'
                      : cat === 'classes'
                        ? 'text-festival-blue'
                        : 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  {cat === 'all' && 'All'}
                  {cat === 'parties' && 'Parties'}
                  {cat === 'classes' && 'Classes'}
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full transition-colors',
                      popupFilter === cat
                        ? cat === 'parties'
                          ? 'bg-festival-pink text-background'
                          : cat === 'classes'
                            ? 'bg-festival-blue text-background'
                            : 'bg-primary text-background'
                        : 'bg-white/10 text-muted-foreground',
                    )}
                  >
                    {allDayEvents.filter((e) => matchesCategory(e, cat)).length}
                  </span>
                </span>
                {popupFilter === cat && (
                  <motion.div
                    layoutId="activeUnderline"
                    className={cn(
                      'absolute bottom-0 left-0 right-0 h-1 rounded-t-full',
                      cat === 'parties'
                        ? 'bg-festival-pink'
                        : cat === 'classes'
                          ? 'bg-festival-blue'
                          : 'bg-primary',
                    )}
                  />
                )}
              </button>
            ))}
          </div>
          </DialogHeader>
        </div>

        {/* Event list */}
        <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="h-full overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-black/20"
        >
          {displayedEvents.length > 0 ? (
            displayedEvents.map((event, i) => (
              <Link
                key={`${event.id}-${i}`}
                to={event.eventLink}
                style={{ backgroundColor: eventCardColour(event.id) }}
                className="group flex flex-col border border-white/5 hover:border-primary/20 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:brightness-110 transition-all active:scale-[0.98]"
              >
                {/* Image + title row */}
                <div className="flex min-h-24 sm:min-h-28">
                  <div className="w-24 sm:w-28 shrink-0 self-stretch relative">
                    {event.coverImageUrl ? (
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={cn(
                          'w-full h-full flex items-center justify-center',
                          event.hasParty
                            ? 'bg-festival-pink/10 text-festival-pink/40'
                            : event.hasClass
                              ? 'bg-festival-blue/10 text-festival-blue/40'
                              : 'bg-primary/10 text-primary/40',
                        )}
                      >
                        <span className="text-4xl">{event.hasParty ? '🎉' : event.hasClass ? '🎓' : '🎪'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-start items-end px-3 sm:px-5 min-w-0 text-right">
                    <h4 className="sparkle-title font-bold text-3xl sm:text-4xl leading-normal tracking-tight line-clamp-2 w-full">
                      {event.title}
                    </h4>
                    <div className="flex items-center justify-end gap-1.5 font-bold text-[12px] truncate mt-1 w-full">
                      <span className="text-[12px]">📍</span>
                      <span className="truncate tracking-wide">{event.venueName}</span>
                    </div>
                    {(event.goingCount ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-1 w-fit ml-auto">
                        {event.goingCount} going
                      </span>
                    )}
                  </div>
                </div>

                {/* Time bars */}
                {(() => {
                  const showClasses = event.hasClass && (popupFilter === 'all' || popupFilter === 'classes');
                  const showParty   = event.hasParty  && (popupFilter === 'all' || popupFilter === 'parties');
                  const showFallback = !event.hasParty && !event.hasClass;

                  const classTime = event.classStart && event.classEnd
                    ? `${event.classStart} - ${event.classEnd}`
                    : event.classStart ?? event.classEnd ?? null;

                  const partyTime = event.partyStart && event.partyEnd
                    ? `${event.partyStart} - ${event.partyEnd}`
                    : event.partyStart ?? event.partyEnd ?? null;

                  return (
                    <div className="flex flex-col text-sm">
                      {showClasses && classTime && (
                        <div className="flex items-center justify-between px-5 py-3 h-12">
                          <span className="text-lg font-bold text-white tracking-wide">CLASSES</span>
                          <span className="font-mono text-xl tracking-tight text-white opacity-90">{classTime}</span>
                        </div>
                      )}
                      {showParty && partyTime && (
                        <div className="flex items-center justify-between px-5 py-3 h-12">
                          <span className="text-lg font-bold text-white tracking-wide">PARTY</span>
                          <span className="font-mono text-xl tracking-tight text-white opacity-90">{partyTime}</span>
                        </div>
                      )}
                      {showFallback && (
                        <div className="flex items-center justify-between px-5 py-3 h-12">
                          <span className="text-lg font-bold text-white tracking-wide">EVENT</span>
                          <span className="font-mono text-xl tracking-tight text-white opacity-90">
                            {event.startTime} - {event.endTime}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Link>
            ))
          ) : null}

          {displayedEvents.length > 0 && (
            <div className="flex justify-center pt-2 pb-2">
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                ← Back to calendar
              </button>
            </div>
          )}

          {displayedEvents.length === 0 && eventsLoading && (
            <div className="space-y-4" aria-busy="true" aria-label="Loading events">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-h-24 sm:min-h-28 rounded-xl overflow-hidden border border-white/5 bg-black/30 animate-pulse"
                >
                  <div className="w-24 sm:w-28 shrink-0 self-stretch bg-white/5 border-r border-white/5" />
                  <div className="flex-1 px-3 sm:px-5 py-3 flex flex-col items-end gap-2">
                    <div className="h-6 w-3/4 rounded bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {displayedEvents.length === 0 && !eventsLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Filter className="w-6 h-6 opacity-30" />
              </div>
              <h3 className="text-lg font-medium mb-1">No {popupFilter === 'all' ? 'events' : popupFilter} found</h3>
              <p className="text-sm text-muted-foreground">Try switching tabs above to see other events.</p>
              <Button onClick={onClose} variant="ghost" className="mt-4">
                Close
              </Button>
            </div>
          )}
        </div>
        {showBottomFade && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-zinc-900"
          />
        )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Desktop prev / next day pills — rendered to document.body via portal so
        they sit on the viewport edges. Per project memory, fixed-position
        overlays rendered from inside a route must use createPortal because
        PageTransition breaks position:fixed. */}
    {onChangeDate && !isMobile && selectedDay && prevDate && nextDate && createPortal(
      <>
        <button
          onClick={goToPrevDay}
          aria-label={`Previous day, ${format(prevDate, 'EEEE MMMM d')}`}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex items-center gap-3 rounded-full bg-zinc-900/95 backdrop-blur-md border border-white/10 hover:border-primary px-4 py-3 text-white transition-colors shadow-lg shadow-black/40"
        >
          <ChevronLeft className="w-5 h-5 text-primary" />
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
              {format(prevDate, 'EEE')}
            </div>
            <div className="text-sm font-semibold leading-none">
              {format(prevDate, 'MMM d')}
            </div>
          </div>
        </button>
        <button
          onClick={goToNextDay}
          aria-label={`Next day, ${format(nextDate, 'EEEE MMMM d')}`}
          className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex items-center gap-3 rounded-full bg-zinc-900/95 backdrop-blur-md border border-white/10 hover:border-primary px-4 py-3 text-white transition-colors shadow-lg shadow-black/40"
        >
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
              {format(nextDate, 'EEE')}
            </div>
            <div className="text-sm font-semibold leading-none">
              {format(nextDate, 'MMM d')}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>
      </>,
      document.body
    )}
    </>
  );
};
