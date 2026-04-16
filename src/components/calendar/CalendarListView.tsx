import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { DAYS, MONTHS, matchesCategory } from '@/components/calendar/calendarUtils';

interface CalendarListViewProps {
  currentMonth: number;
  currentYear: number;
  selectedCategory: Category;
  events: CalendarEventItem[];
  onClearFilters: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const CalendarListView = ({
  currentMonth,
  currentYear,
  selectedCategory,
  events,
  onClearFilters,
  userLocation,
}: CalendarListViewProps) => {
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const filtered = events
    .filter(
      (e) =>
        e.endDate >= monthStart &&
        e.startDate <= monthEnd &&
        matchesCategory(e, selectedCategory),
    )
    .sort((a, b) => {
      // When near-me active and venues have coords: sort by distance
      if (userLocation && a.venueLat != null && b.venueLat != null) {
        const distA = haversineMiles(userLocation.lat, userLocation.lng, a.venueLat!, a.venueLng!);
        const distB = haversineMiles(userLocation.lat, userLocation.lng, b.venueLat!, b.venueLng!);
        return distA - distB;
      }
      return a.startDate.getTime() - b.startDate.getTime();
    });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p className="text-4xl mb-2">🏜️</p>
        <p>No events found for {MONTHS[currentMonth]}</p>
        <button onClick={onClearFilters} className="text-sm text-primary hover:underline mt-2">
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {filtered.map((event, i) => {
        const dayOfWeek = new Date(event.year, event.month, event.date).getDay();
        const dayLabel = DAYS[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

        return (
          <motion.div
            key={`${event.id}-${event.instanceDateIso}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={event.eventLink}
              className="block bg-card hover:bg-muted/50 border border-primary/10 rounded-xl p-3 transition-all group"
            >
              <div className="flex items-center gap-4">
                {/* Date Column */}
                <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/5 rounded-lg border border-primary/10 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{dayLabel}</span>
                  <span className="text-lg font-bold text-primary leading-none">{event.date}</span>
                </div>

                {/* Image Thumbnail */}
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-primary/10 bg-muted/20">
                  {event.coverImageUrl ? (
                    <img
                      src={event.coverImageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={cn(
                        'w-full h-full flex items-center justify-center',
                        event.type === 'parties' ? 'bg-festival-pink/10' : 'bg-festival-blue/10',
                      )}
                    >
                      <span className="text-2xl opacity-50">{event.type === 'parties' ? '🎉' : '🎓'}</span>
                    </div>
                  )}
                </div>

                {/* Details Column */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                      {event.title}
                    </h4>
                    <span className="text-xs text-muted-foreground truncate">@ {event.venueName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {(event.goingCount ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        {event.goingCount} going
                      </span>
                    )}
                    {userLocation && event.venueLat != null && (
                      <span className="text-[10px] text-muted-foreground bg-muted/30 rounded-full px-2 py-0.5">
                        {haversineMiles(userLocation.lat, userLocation.lng, event.venueLat!, event.venueLng!).toFixed(1)} mi
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs w-full mt-0.5">
                    {event.hasClass && (
                      <div className="flex items-center gap-1.5 text-festival-blue shrink-0">
                        <span className="font-bold">Classes</span>
                        <span className="font-mono opacity-90">
                          {event.classStart ?? ''} - {event.classEnd ?? ''}
                        </span>
                      </div>
                    )}
                    {event.hasParty && (
                      <div className="flex items-center gap-1.5 text-festival-pink shrink-0">
                        <span className="font-bold">Party</span>
                        <span className="font-mono opacity-90">
                          {event.partyStart ?? ''} - {event.partyEnd ?? ''}
                        </span>
                      </div>
                    )}
                    {!event.hasClass && !event.hasParty && (
                      <span className="text-muted-foreground font-mono">
                        {event.startTime} - {event.endTime}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
