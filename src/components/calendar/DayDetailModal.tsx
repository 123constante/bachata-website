import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { DAYS, MONTHS, isEventVisibleOnDay, matchesCategory, mondayIndex } from '@/components/calendar/calendarUtils';

interface DayDetailModalProps {
  selectedDay: number | null;
  currentMonth: number;
  currentYear: number;
  parentCategory: Category;
  events: CalendarEventItem[];
  onClose: () => void;
}

export const DayDetailModal = ({
  selectedDay,
  currentMonth,
  currentYear,
  parentCategory,
  events,
  onClose,
}: DayDetailModalProps) => {
  const [popupFilter, setPopupFilter] = useState<Category>(parentCategory);

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

  return (
    <Dialog
      open={!!selectedDay}
      onOpenChange={(open) => {
        if (!open) onClose();
        else setPopupFilter(syncedFilter);
      }}
    >
      <DialogContent className="max-w-md w-full h-[85vh] sm:h-[600px] p-0 gap-0 overflow-hidden bg-zinc-900 border-white/10 sm:rounded-3xl rounded-t-[32px] flex flex-col shadow-2xl [&>button]:hidden">
        <DialogHeader className="px-6 pt-8 pb-6 border-b border-white/5 bg-background/95 backdrop-blur-xl shrink-0 space-y-6">
          {/* Headline date */}
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-end gap-0.5 select-none">
              <span className="text-7xl font-black leading-[0.75] tracking-tighter text-primary">
                {selectedDay}
              </span>
              <div className="flex flex-col pb-1.5 pl-1">
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
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors group"
            >
              <X className="w-6 h-6 opacity-70 group-hover:opacity-100" />
            </button>
          </div>

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
                      'text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 transition-colors',
                      popupFilter === cat ? 'bg-current text-background' : 'text-muted-foreground',
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

        {/* Event list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-transparent to-black/20">
          {displayedEvents.length > 0 ? (
            displayedEvents.map((event, i) => (
              <Link
                key={`${event.id}-${i}`}
                to={event.eventLink}
                className="group flex flex-col bg-black hover:bg-black/80 border border-white/5 hover:border-primary/20 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] mb-6"
              >
                {/* Image + title row */}
                <div className="flex h-24">
                  <div className="aspect-square shrink-0 bg-muted/20 relative border-r border-white/5">
                    {event.coverImageUrl ? (
                      <img
                        src={event.coverImageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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

                  <div className="flex-1 flex flex-col justify-center items-end px-3 sm:px-5 min-w-0 bg-black/20 text-right">
                    <h4 className="font-bold text-base sm:text-lg leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2 w-full">
                      {event.title}
                    </h4>
                    <div className="flex items-center justify-end gap-1.5 font-bold text-[12px] truncate mt-1 w-full">
                      <span className="text-[12px]">📍</span>
                      <span className="truncate tracking-wide">{event.venueName}</span>
                    </div>
                  </div>
                </div>

                {/* Time bars */}
                <div className="flex flex-col text-sm border-t border-white/5">
                  {event.hasClass && (popupFilter === 'all' || popupFilter === 'classes') && (
                    <div className="flex items-center justify-between px-5 py-3 bg-festival-blue/5 border-b border-white/5 last:border-0 h-12">
                      <span className="text-lg font-bold text-festival-blue tracking-wide">CLASSES</span>
                      <span className="font-mono text-xl tracking-tight opacity-90">
                        {event.classStart ?? ''} - {event.classEnd ?? ''}
                      </span>
                    </div>
                  )}
                  {event.hasParty && (popupFilter === 'all' || popupFilter === 'parties') && (
                    <div className="flex items-center justify-between px-5 py-3 bg-festival-pink/5 h-12">
                      <span className="text-lg font-bold text-festival-pink tracking-wide">PARTY</span>
                      <span className="font-mono text-xl tracking-tight opacity-90">
                        {event.partyStart ?? ''} - {event.partyEnd ?? ''}
                      </span>
                    </div>
                  )}
                  {!event.hasParty && !event.hasClass && (
                    <div className="flex items-center justify-between px-5 py-3 bg-primary/5 h-12">
                      <span className="text-lg font-bold text-primary tracking-wide">EVENT</span>
                      <span className="font-mono text-xl tracking-tight opacity-90">
                        {event.startTime} - {event.endTime}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))
          ) : (
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
      </DialogContent>
    </Dialog>
  );
};
