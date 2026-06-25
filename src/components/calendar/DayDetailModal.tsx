import { useState, useEffect, useRef } from 'react';
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
  /** When true, the modal shows a skeleton instead of the empty-state -- used to
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
  const [showBottomFade, setShowBottomFade] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    // Horizontal swipe wins if it dominates and clears the threshold.
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 80) {
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
    <Dialog
      open={!!selectedDay}
      onOpenChange={(open) => {
        if (!open) onClose();
        else setPopupFilter(syncedFilter);
      }}
    >
      <DialogContent className="max-w-md w-full h-[85vh] sm:h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden bg-zinc-900 border-white/10 sm:rounded-3xl rounded-t-[32px] flex flex-col shadow-2xl [&>button]:hidden top-auto sm:top-[50%] bottom-0 sm:bottom-auto left-0 sm:left-[50%] right-0 sm:right-auto translate-x-0 sm:translate-x-[-50%] translate-y-0 sm:translate-y-[-50%]">
        <div className="shrink-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Grab handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" aria-hidden="true" />
          </div>
          <DialogHeader className="px-4 pt-3 pb-4 border-b border-white/5 bg-background/95 backdrop-blur-xl space-y-5">
          {/* Headline date + inline prev/next nav */}
          <div className="flex items-start gap-2">
            <button
              onClick={onClose}
              aria-label="Back to calendar"
              className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 opacity-80 group-hover:opacity-100" />
            </button>

            {onChangeDate && prevDate ? (
              <button
                onClick={goToPrevDay}
                aria-label={`Previous day, ${format(prevDate, 'EEEE MMMM d')}`}
                className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
              >
                <ChevronLeft className="w-5 h-5 text-primary opacity-90 group-hover:opacity-100" />
              </button>
            ) : <div className="w-11 shrink-0" />}

            <DialogTitle className="flex items-end gap-0.5 select-none flex-1 min-w-0">
              <span className="text-6xl font-black leading-[0.75] tracking-tighter text-primary">
                {selectedDay}
              </span>
              <div className="flex flex-col pb-1 pl-1 min-w-0">
                <span className="text-3xl font-black uppercase tracking-tighter text-foreground leading-[0.85]">
                  {selectedDate && DAYS[mondayIndex(selectedDate.getDay())]}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5 ml-0.5">
                  {MONTHS[currentMonth]} {currentYear}
                </span>
              </div>
            </DialogTitle>

            {onChangeDate && nextDate ? (
              <button
                onClick={goToNextDay}
                aria-label={`Next day, ${format(nextDate, 'EEEE MMMM d')}`}
                className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
              >
                <ChevronRight className="w-5 h-5 text-primary opacity-90 group-hover:opacity-100" />
              </button>
            ) : <div className="w-11 shrink-0" />}

            <button
              onClick={onClose}
              aria-label="Close"
              className="h-11 w-11 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
            >
              <X className="w-5 h-5 opacity-80 group-hover:opacity-100" />
            </button>
          </div>

          {/* Category tabs */}
          <div role="tablist" aria-label="Filter events by type" className="flex items-center justify-around w-full border-b border-white/10">
            {(['all', 'parties', 'classes'] as Category[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setPopupFilter(cat)}
                role="tab"
                aria-selected={popupFilter === cat}
                aria-label={`${cat === 'all' ? 'All' : cat === 'parties' ? 'Parties' : 'Classes'}, ${allDayEvents.filter((e) => matchesCategory(e, cat)).length} events`}
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
          className="h-full overflow-y-auto touch-pan-y overscroll-y-contain p-4 space-y-3 bg-gradient-to-b from-transparent to-black/20"
        >
          {displayedEvents.length > 0 ? (
            displayedEvents.map((event, i) => {
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
                <Link
                  key={`${event.id}-${i}`}
                  to={event.eventLink}
                  style={{ backgroundColor: eventCardColour(event.id) }}
                  className="group flex min-h-[80px] border border-white/5 hover:border-primary/20 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:brightness-110 transition-all active:scale-[0.98]"
                >
                  {/* Left image — overflow-hidden clips CancelledRedStrip to image bounds */}
                  <div className="w-[90px] shrink-0 self-stretch relative overflow-hidden">
                    {event.coverImageUrl ? (
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        className={cn(
                          'w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500',
                          event.isCancelled && 'brightness-[0.55] saturate-[0.6]',
                        )}
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
                          event.isCancelled && 'brightness-[0.55] saturate-[0.6]',
                        )}
                      >
                        <span aria-hidden="true" className="text-3xl">
                          {event.hasParty ? '🎉' : event.hasClass ? '🎓' : '🎪'}
                        </span>
                      </div>
                    )}
                    {event.isCancelled && (
                      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                        <div className="w-full border-y-2 border-white py-1 text-center"
                          style={{ background: 'rgba(220,38,38,0.94)', textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white leading-none">Cancelled</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right info */}
                  <div className="flex-1 flex flex-col justify-between px-3 py-3 min-w-0 gap-2">
                    <div className="min-w-0">
                      {event.isFestival && (
                        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400 text-background text-[10px] font-extrabold tracking-wider px-2 py-0.5 uppercase shadow-sm">
                          Festival
                        </span>
                      )}
                      <h4
                        className={cn(
                          'font-bold text-[15px] leading-tight line-clamp-2',
                          event.isCancelled && 'line-through opacity-60',
                        )}
                      >
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1 min-w-0">
                        <span aria-hidden="true" className="text-[11px] shrink-0">📍</span>
                        <span className="text-[11px] font-semibold text-muted-foreground truncate">{event.venueName}</span>
                      </div>
                    </div>

                    {/* Times -- dot + coloured label + muted range, matching the map list style */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {showClasses && classTime && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-festival-blue" aria-hidden="true" />
                          <span className="font-bold text-festival-blue">Class</span>
                          <span>{classTime}</span>
                        </span>
                      )}
                      {showParty && partyTime && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-festival-pink" aria-hidden="true" />
                          <span className="font-bold text-festival-pink">Party</span>
                          <span>{partyTime}</span>
                        </span>
                      )}
                      {showFallback && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          <span className="font-bold text-primary">Event</span>
                          <span>{event.startTime} &ndash; {event.endTime}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : null}

          {displayedEvents.length > 0 && (
            <div className="flex justify-center pt-2 pb-2">
              <button
                onClick={onClose}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
              >
                &larr; Back to calendar
              </button>
            </div>
          )}

          {displayedEvents.length === 0 && eventsLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Loading events">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-h-[80px] rounded-xl overflow-hidden border border-white/5 bg-black/30 animate-pulse"
                >
                  <div className="w-[90px] shrink-0 self-stretch bg-white/5 border-r border-white/5" />
                  <div className="flex-1 px-3 py-3 flex flex-col justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="h-4 w-3/4 rounded bg-white/10" />
                      <div className="h-3 w-1/2 rounded bg-white/5" />
                    </div>
                    <div className="h-6 w-2/5 rounded-full bg-white/5" />
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
  );
};
