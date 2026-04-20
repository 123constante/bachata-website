import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useCity } from '@/contexts/CityContext';
import type { Category, ViewType, VenueCoordMap } from '@/components/calendar/calendarUtils';
import { MONTHS, transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CalendarListView } from '@/components/calendar/CalendarListView';
import { DayDetailModal } from '@/components/calendar/DayDetailModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const CalendarSkeleton = ({ view, month, year }: { view: ViewType; month: number; year: number }) => {
  if (view === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-primary/10 p-3">
            <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
            <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const firstDay = new Date(year, month, 1).getDay();
  const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = adjustedFirst + daysInMonth;

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: cellCount }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </>
  );
};

interface EventCalendarProps {
  defaultCategory?: Category;
}

const VIEW_STORAGE_KEY = 'bachata-calendar-view';

export const EventCalendar = ({ defaultCategory = 'all' }: EventCalendarProps) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(defaultCategory);
  const [view, setView] = useState<ViewType>(() => {
    if (typeof window === 'undefined') return 'calendar';
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'list' || stored === 'calendar' ? stored : 'calendar';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // TODO: Re-enable Near Me when we decide where it should live
  // const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  // const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const userLocation = null;
  const { citySlug } = useCity();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const now = new Date();
  const isAtCurrentMonth = currentMonth === now.getMonth() && currentYear === now.getFullYear();

  const queryStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const queryEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 1), [currentYear, currentMonth]);

  const { data: rawEvents, isLoading: isEventsLoading } = useCalendarEvents({ rangeStart: queryStart, rangeEnd: queryEnd, citySlug });

  // Unique raw event IDs — used for both the venue-coord fetch and attendance counts.
  const rawEventIds = useMemo(
    () => Array.from(new Set((rawEvents ?? []).map((e) => e.event_id))),
    [rawEvents],
  );

  // Venue coordinates per event_id. The calendar RPC doesn't return lat/lng,
  // so fetch events→venues separately and build a Map the transform consumes.
  // Only runs when "Near me" is active — otherwise the coords are unused.
  const { data: venueCoords } = useQuery<VenueCoordMap>({
    queryKey: ['calendar-venue-coords', rawEventIds],
    queryFn: async () => {
      const map: VenueCoordMap = new Map();
      if (!rawEventIds.length) return map;
      const { data, error } = await supabase
        .from('events')
        .select('id, venues(lat, lng)')
        .in('id', rawEventIds);
      if (error || !data) return map;
      for (const row of data as Array<{ id: string; venues: { lat: number | null; lng: number | null } | null }>) {
        if (row.venues) {
          map.set(row.id, { lat: row.venues.lat ?? null, lng: row.venues.lng ?? null });
        }
      }
      return map;
    },
    enabled: rawEventIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const baseEvents = useMemo(
    () => (rawEvents ? transformCalendarEvents(rawEvents, venueCoords) : []),
    [rawEvents, venueCoords],
  );

  // Unique event IDs to batch-fetch attendance counts
  const eventIds = useMemo(() => Array.from(new Set(baseEvents.map((e) => e.id))), [baseEvents]);

  const { data: attendanceCounts } = useQuery({
    queryKey: ['calendar-attendance-counts', eventIds],
    queryFn: async () => {
      if (!eventIds.length) return {} as Record<string, number>;
      const { data, error } = await (supabase.rpc as any)('get_event_attendance_counts', {
        p_event_ids: eventIds,
      });
      if (error || !data) return {} as Record<string, number>;
      const map: Record<string, number> = {};
      (data as Array<{ event_id: string; going_count: number }>).forEach((row) => {
        map[row.event_id] = row.going_count;
      });
      return map;
    },
    enabled: eventIds.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  const events = useMemo(() => {
    if (!attendanceCounts) return baseEvents;
    return baseEvents.map((e) => ({
      ...e,
      goingCount: attendanceCounts[e.id] ?? 0,
    }));
  }, [baseEvents, attendanceCounts]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + (direction === 'next' ? 1 : -1));
      return next;
    });
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => setSelectedDay(day);

  // TODO: Re-enable Near Me when we decide where it should live
  // const handleNearMe = useCallback(async () => {
  //   if (locationStatus === 'granted' && userLocation) {
  //     setUserLocation(null); setLocationStatus('idle'); return;
  //   }
  //   if (typeof window === 'undefined' || !window.isSecureContext) {
  //     setLocationStatus('denied'); return;
  //   }
  //   if (!('geolocation' in navigator)) { setLocationStatus('denied'); return; }
  //   try {
  //     if ('permissions' in navigator) {
  //       const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
  //       if (status.state === 'denied') { setLocationStatus('denied'); return; }
  //     }
  //   } catch {}
  //   setLocationStatus('loading');
  //   setView('list');
  //   navigator.geolocation.getCurrentPosition(
  //     (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationStatus('granted'); },
  //     (err) => { console.error('[Near me]', err.code, err.message); setLocationStatus('denied'); setTimeout(() => setLocationStatus('idle'), 4000); },
  //     { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  //   );
  // }, [locationStatus, userLocation]);

  return (
    <section className="py-6 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div
          className="bg-card border border-[hsl(42_90%_50%/0.22)] rounded-3xl overflow-hidden relative shadow-[0_0_0_1px_hsl(42_90%_50%/0.06),_0_8px_48px_hsl(42_90%_50%/0.07)]"
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
                      disabled={isAtCurrentMonth}
                      aria-label="Previous month"
                      className={cn(
                        'p-1.5 rounded-full transition-colors',
                        isAtCurrentMonth
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-primary/10',
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-lg font-black tracking-tight min-w-[120px] text-center">
                      {MONTHS[currentMonth]} {currentYear}
                    </h3>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-1.5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* TODO: Re-enable Near Me toggle when we decide where it should live
                  <button
                    onClick={handleNearMe}
                    title={locationStatus === 'denied' ? 'Location access denied' : 'Sort by distance'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all min-h-[32px]',
                      locationStatus === 'granted'
                        ? 'bg-gradient-to-r from-[hsl(48_90%_62%)] via-[hsl(42_95%_50%)] to-[hsl(36_88%_42%)] text-black font-semibold shadow-[0_0_12px_hsl(42_95%_50%/0.4)]'
                        : locationStatus === 'denied'
                          ? 'bg-destructive/20 text-destructive'
                          : 'bg-[hsl(42_90%_50%/0.1)] text-primary hover:bg-[hsl(42_90%_50%/0.18)]',
                    )}
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Near me</span>
                  </button>
                  */}
                </div>

                {/* View toggle (Calendar / List) */}
                <div className="flex justify-center pt-1 pb-2">
                  <ToggleGroup
                    type="single"
                    value={view}
                    onValueChange={(v) => { if (v) setView(v as ViewType); }}
                    aria-label="Calendar view"
                    size="sm"
                    className="rounded-full border border-primary/15 bg-card p-1"
                  >
                    <ToggleGroupItem
                      value="calendar"
                      aria-label="Calendar grid view"
                      className="rounded-full px-3 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-4 h-4" />
                        Calendar
                      </span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="list"
                      aria-label="List view"
                      className="rounded-full px-3 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                    >
                      <span className="flex items-center gap-1.5">
                        <List className="w-4 h-4" />
                        List
                      </span>
                    </ToggleGroupItem>
                  </ToggleGroup>
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
                            'absolute bottom-0 left-0 right-0 h-[3px] rounded-full',
                            category === 'parties'
                              ? 'bg-festival-pink'
                              : category === 'classes'
                                ? 'bg-festival-blue'
                                : 'bg-gradient-to-r from-[hsl(48_90%_62%)] via-[hsl(42_95%_50%)] to-[hsl(36_88%_42%)]',
                          )}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </nav>
              </div>

              {/* Content area */}
              <div className="p-4 pt-4 min-h-0 sm:min-h-[400px]">
                {isEventsLoading ? (
                  <CalendarSkeleton view={view} month={currentMonth} year={currentYear} />
                ) : view === 'calendar' ? (
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
                    userLocation={userLocation}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
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
