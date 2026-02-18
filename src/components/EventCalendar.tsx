import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ChevronRight as ChevronRightIcon, List, Calendar as CalendarIcon, MapPin, Clock, Users, Flame, Filter } from 'lucide-react';
import { cn, resolveEventImage } from '@/lib/utils';
// import { supabase } from '@/integrations/supabase/client'; // Removed direct supabase usage
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCity } from '@/contexts/CityContext';

interface EventCalendarProps {
  defaultCategory?: 'all' | 'parties' | 'classes';
}

type Category = 'all' | 'parties' | 'classes';
type ViewType = 'calendar' | 'list' | 'levels';

interface EventData {
  id: string;
  date: number;
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  instanceDateIso?: string; // Storing the ISO string for robust comparison
  type: 'parties' | 'classes' | 'both';
  meta_data: any; // Added for filtering
  key_times?: any; // Added fallback for root-level key_times
  backendType: string; // Added for reference
  hasParty: boolean;
  hasClass: boolean;
  title: string;
  startTime: string; // Primary display time
  endTime: string;   // Primary display end time
  partyStart?: string;
  partyEnd?: string;
  classStart?: string;
  classEnd?: string;
  venueName: string;
  address: string;
  venuePage: string;
  eventLink: string;
  coverImageUrl?: string | null;
  attendanceCount?: number;
}

interface SupabaseEvent {
  id: string;
  name: string;
  date: string;
  social_start: string | null;
  social_end: string | null;
  class_start: string | null;
  class_end: string | null;
  venue_id: string | null;
  venues: {
    name: string;
    address: string;
  } | null;
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// --- Phase 2 Helpers: Smart Logic Extraction ---
// Removed complex getEventFlags logic in favor of backend booleans (Migration 20260122120000)

// --- Step 3: Fix the Date Matching (Missing Dots) ---
const isSameDay = (eventInstanceDate: string | undefined, calendarDate: Date) => {
   if (!eventInstanceDate) return false;
   // Slice the ISO string to get YYYY-MM-DD
   return eventInstanceDate.split('T')[0] === calendarDate.toISOString().split('T')[0];
};

/**
 * Checks if an event should appear on a specific calendar day.
 * - Handles Multi-day events (appears on all days in range)
 * - Normalized date comparison (ignores time)
 */
const isEventVisibleOnDay = (event: EventData, checkDate: Date, selectedCategory: Category) => {
  // 1. Date Comparison
    let isVisible = false;

    // Robust Check: Use String Comparison if available
    if (event.instanceDateIso) {
        isVisible = isSameDay(event.instanceDateIso, checkDate);
    } else {
        // Fallback: Date Range Check
        isVisible = checkDate >= event.startDate && checkDate <= event.endDate;
    }

    if (!isVisible) return false;

    // 2. Category Filter - SIMPLIFIED (Source of Truth)
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'parties') return event.hasParty;
    if (selectedCategory === 'classes') return event.hasClass;
    
    return true;
};

// --- Step 2b: Simplified Filter for List View ---
const shouldShowEventInTab = (event: EventData, activeTab: Category) => {
  // Fix for "All" tab: Only show if it is actually valid (has either Party OR Class)
  // This prevents "ghost" events (where both are toggled off) from appearing
  if (activeTab === 'all') {
    return event.hasParty || event.hasClass;
  }
  
  if (activeTab === 'parties') return event.hasParty;
  if (activeTab === 'classes') return event.hasClass;
  return true;
};

// --- Step 3: Fix the Date Matching (Missing Dots) ---

export const EventCalendar = ({ defaultCategory = 'all' }: EventCalendarProps) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(defaultCategory);
  const [view, setView] = useState<ViewType>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [popupFilter, setPopupFilter] = useState<Category>('all');
  const { citySlug } = useCity();

  // Sync popup filter with main filter when opening
  useEffect(() => {
    if (selectedDay) {
        // If the main category is 'all', use 'all'. Otherwise match it.
        setPopupFilter(selectedCategory);
    }
  }, [selectedDay, selectedCategory]);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const queryStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const queryEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 0), [currentYear, currentMonth]);

  const { data: rawEvents, isLoading } = useCalendarEvents({
    rangeStart: queryStart,
    rangeEnd: queryEnd,
    citySlug
  });

  const events = useMemo(() => {
    if (!rawEvents) return [];
    
    return rawEvents.map((event) => {
        // Handle Date Range
        const instanceDate = new Date(event.instance_date);
        
        // Normalize time component
        const normalizedStart = new Date(instanceDate);
        normalizedStart.setHours(0,0,0,0);
        
        const normalizedEnd = new Date(instanceDate);
        normalizedEnd.setHours(23,59,59,999);

        // Helper to format time
        const formatTime = (time: string | null) => {
          if (!time) return undefined;
          return time.substring(0, 5); // Extracts HH:MM from HH:MM:SS
        };

        // 1. Parse Meta Data first (to access key_times)
        let meta: Record<string, any> = {};
        try {
          meta = (typeof event.meta_data === 'string' ? JSON.parse(event.meta_data) : event.meta_data) || {};
        } catch (e) {
          console.warn('Failed to parse meta_data for event', event.event_id, e);
        }
        
        // Support both meta_data.key_times AND root-level key_times (legacy/fallback)
        // Now fully supported by RPC returning key_times directly
          let keyTimes = event.key_times;
          if (typeof keyTimes === 'string') {
             try {
               const parsed = JSON.parse(keyTimes);
               keyTimes = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
             } catch (e) {
               // If it's a string but doesn't parse, fail safe.
                console.warn('Failed to parse key_times for event', event.event_id, e);
               keyTimes = {};
             }
          }

          const isKeyTimesEmpty =
           keyTimes &&
           typeof keyTimes === 'object' &&
           !Array.isArray(keyTimes) &&
           Object.keys(keyTimes).length === 0;

          if (!keyTimes || isKeyTimesEmpty) {
           keyTimes = meta.key_times || {};
          }

        let programHasParty = false;
        let programHasClass = false;
        if (Array.isArray(meta.program)) {
          for (const item of meta.program) {
            if (item?.type === 'party') {
              programHasParty = true;
            }
            if (item?.type === 'class' || item?.type === 'workshop') {
              programHasClass = true;
            }
            if (Array.isArray(item?.music_styles) && item.music_styles.includes('party')) {
              programHasParty = true;
            }
          }
        }

        // 3. Determine Flags (RPC-first, program, then key_times fallback)
        const hasParty = event.has_party ?? (meta.program ? programHasParty : !!keyTimes.party?.active);
        const hasClass = event.has_class ?? (meta.program ? programHasClass : !!keyTimes.classes?.active);

        // Extract Times for display
        const partyStart = event.party_start || keyTimes?.party?.start || undefined;
        const partyEnd = event.party_end || keyTimes?.party?.end || undefined;
        const classStart = event.class_start || keyTimes?.classes?.start || undefined;
        const classEnd = event.class_end || keyTimes?.classes?.end || undefined;
        
        // Determine event type
        let eventType: 'parties' | 'classes' | 'both';
        if (hasParty && hasClass) eventType = 'both';
        else if (hasParty) eventType = 'parties';
        else eventType = 'classes';
        
        // Default display times
        const globalStartTime = formatTime(event.start_time);
        const globalEndTime = formatTime(event.end_time);

        const startTime = partyStart || classStart || globalStartTime || 'TBA';
        const endTime = partyEnd || classEnd || globalEndTime || 'TBA';
        
        return {
          id: event.event_id,
          date: instanceDate.getDate(),
          month: instanceDate.getMonth(),
          year: instanceDate.getFullYear(),
          startDate: normalizedStart,
          endDate: normalizedEnd,
          instanceDateIso: event.instance_date, // Store original ISO string
          type: eventType,
          meta_data: meta,
          backendType: event.type,
          hasParty, 
          hasClass,
          title: event.name,
          startTime,
          endTime,
          partyStart,
          partyEnd,
          classStart,
          classEnd,
          venueName: event.location || 'Venue TBA',
          address: event.location || 'Address TBA',
          venuePage: '', 
          eventLink: `/event/${event.event_id}`,
          coverImageUrl: resolveEventImage(event.photo_url, null),
          attendanceCount: 0
        };
    });
  }, [rawEvents]);



  // Get first day of month (0 = Sunday, adjust for Monday start)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  // Get days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Get today
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Filter events for current view
  const getEventsForDay = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(12,0,0,0); // Normalise to Noon to avoid timezone edge cases

    return events.filter(event => isEventVisibleOnDay(event, checkDate, selectedCategory));
  };
  
  // Get all filtered events for the entire month
  const getFilteredEventsForMonth = () => {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    monthEnd.setHours(23,59,59,999);

    // Note: We don't use isEventVisibleOnDay here because we are checking for ANY overlap with the month
    return events.filter(event =>
      event.endDate >= monthStart && event.startDate <= monthEnd &&
      shouldShowEventInTab(event, selectedCategory)
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  };

  // Get ALL events for a day (regardless of category filter)
  const getAllEventsForDay = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(12,0,0,0);

    return events.filter(event => isEventVisibleOnDay(event, checkDate, 'all'));
  };

  // Get events of OTHER type for the selected day (for dropdown)
  const getOtherTypeEvents = (day: number) => {
    const checkDate = new Date(currentYear, currentMonth, day);
    checkDate.setHours(12,0,0,0);
    const otherType = selectedCategory === 'parties' ? 'classes' : 'parties';
    
    return events.filter(event => {
         // 1. Must match date
         const isVisibleDate = event.instanceDateIso 
           ? isSameDay(event.instanceDateIso, checkDate)
           : (checkDate >= event.startDate && checkDate <= event.endDate);
           
       if (!isVisibleDate) return false;

       // 2. Must match the OTHER category
       return shouldShowEventInTab(event, otherType as Category);
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => {
    const events = getEventsForDay(day);
    if (events.length > 0) {
      setSelectedDay(day);
    }
  };

  // Generate calendar days
  const calendarDays = [];
  for (let i = 0; i < adjustedFirstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get events for popup (Option 1: Get ALL and filter locally)
  const allDayEvents = selectedDay ? getAllEventsForDay(selectedDay) : [];
  const displayedPopupEvents = allDayEvents.filter(event => shouldShowEventInTab(event, popupFilter));

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
            {/* Main Content */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1"
                >
                  <div className="flex-1">
                    {/* Top Control Bar */}
                    <div className="flex flex-col border-b border-primary/10">
                      
                      {/* ROW 1: Month Navigation */}
                      <div className="flex items-center justify-center px-4 pt-4 pb-2">
                        {/* Month Navigation */}
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

                      {/* ROW 2: Category Tabs (Center) */}
                      <nav className="relative flex items-center justify-center gap-6 pb-4">
                        {(['all', 'parties', 'classes'] as Category[]).map((category) => (
                          <motion.button
                            key={category}
                            onClick={() => {
                              setSelectedCategory(category);
                              setSelectedDay(null);
                            }}
                            className={cn(
                              "relative text-sm font-medium px-2 py-2 transition-colors",
                              selectedCategory === category 
                                ? (category === 'parties' ? 'text-festival-pink' : category === 'classes' ? 'text-festival-blue' : 'text-primary')
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <span className="flex items-center gap-1.5">
                              {category === 'all' && <span className="text-xs">✨</span>}
                              {category === 'parties' && <span className="text-xs">🎉</span>}
                              {category === 'classes' && <span className="text-xs">🎓</span>}
                              {category === 'all' && 'All'}
                              {category === 'parties' && 'Parties'}
                              {category === 'classes' && 'Classes'}
                            </span>
                            {/* Sliding underline indicator */}
                            {selectedCategory === category && (
                              <motion.div
                                layoutId="activeTabUnderline"
                                className={cn(
                                  "absolute bottom-0 left-0 right-0 h-0.5 rounded-full",
                                  category === 'parties' ? 'bg-festival-pink' : category === 'classes' ? 'bg-festival-blue' : 'bg-primary'
                                )}
                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                              />
                            )}
                          </motion.button>
                        ))}
                      </nav>
                    </div>

                    {/* Content Area - Calendar or List */}
                    <div className="p-4 pt-4 min-h-[400px]">
                      {view === 'calendar' ? (
                        <>
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {DAYS.map((day) => (
                              <div
                                key={day}
                                className="text-center text-xs font-medium text-muted-foreground py-1"
                              >
                                {day}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, index) => {
                              if (day === null) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
                              }

                              const events = getEventsForDay(day);
                              const isToday = isCurrentMonth && today.getDate() === day;
                              const hasParty = events.some(e => e.hasParty);
                              const hasClass = events.some(e => e.hasClass);
                              const hasEvents = events.length > 0;

                              return (
                                <motion.button
                                  key={day}
                                  onClick={() => handleDayClick(day)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className={cn(
                                    "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all",
                                    isToday 
                                      ? "bg-primary text-primary-foreground font-bold" 
                                      : hasEvents
                                        ? "bg-primary/10 hover:bg-primary/20 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                                        : "hover:bg-surface",
                                    hasEvents && "cursor-pointer"
                                  )}
                                >
                                  <span className={cn(
                                    "text-sm",
                                    !isToday && !hasEvents && "text-muted-foreground"
                                  )}>
                                    {day}
                                  </span>
                                  {hasEvents && (
                                    <div className="flex gap-0.5 mt-1">
                                      {hasParty && (
                                        <div className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          isToday ? "bg-primary-foreground" : "bg-festival-pink"
                                        )} />
                                      )}
                                      {hasClass && (
                                        <div className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          isToday ? "bg-primary-foreground" : "bg-festival-blue"
                                        )} />
                                      )}
                                    </div>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                          {!selectedDay && (
                          <motion.div 
                            className="mt-8 pt-6 border-t border-primary/20 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                          >
                             <motion.div
                              animate={{ 
                                y: [0, -5, 0],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-full cursor-default"
                            >
                              👇 Select a date to see details
                            </motion.div>
                          </motion.div>
                          )}
                        </>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-3"
                        >
                          {getFilteredEventsForMonth().length > 0 ? (
                            getFilteredEventsForMonth().map((event, i) => (
                              <motion.div
                                key={event.id}
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
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{DAYS[new Date(event.year, event.month, event.date).getDay() === 0 ? 6 : new Date(event.year, event.month, event.date).getDay() - 1]}</span>
                                      <span className="text-lg font-bold text-primary leading-none">{event.date}</span>
                                    </div>

                                    {/* Image Thumbnail (Real or Placeholder) */}
                                    <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-primary/10 bg-muted/20">
                                      {event.coverImageUrl ? (
                                        <img 
                                          src={event.coverImageUrl} 
                                          alt={event.title}
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className={cn(
                                          "w-full h-full flex items-center justify-center",
                                          event.type === 'parties' ? "bg-festival-pink/10" : "bg-festival-blue/10"
                                        )}>
                                          <span className="text-2xl opacity-50">
                                            {event.type === 'parties' ? '�' : '�🎓'}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Details Column */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                                      {/* Row 1: Title & Venue */}
                                      <div className="flex items-center gap-2 min-w-0">
                                        <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors shrink-0 max-w-[60%]">
                                          {event.title}
                                        </h4>
                                        <span className="text-xs text-muted-foreground truncate shrink-0">
                                          @ {event.venueName}
                                        </span>
                                      </div>
                                      
                                      {/* Row 2: Classes & Party */}
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs w-full mt-0.5">
                                        {event.hasClass && (selectedCategory === 'all' || selectedCategory === 'classes') && (
                                          <div className="flex items-center gap-1.5 text-festival-blue shrink-0">
                                            <span className="font-bold">Classes</span>
                                            <span className="font-mono opacity-90">
                                              {(event.classStart || '').substring(0,5)} - {(event.classEnd || '').substring(0,5)}
                                            </span>
                                          </div>
                                        )}
                                        
                                        {event.hasParty && (selectedCategory === 'all' || selectedCategory === 'parties') && (
                                          <div className="flex items-center gap-1.5 text-festival-pink shrink-0">
                                            <span className="font-bold">Party</span>
                                            <span className="font-mono opacity-90">
                                              {(event.partyStart || '').substring(0,5)} - {(event.partyEnd || '').substring(0,5)}
                                            </span>
                                          </div>
                                        )}

                                        {!event.hasClass && !event.hasParty && (
                                          <span className="text-muted-foreground font-mono">
                                            {(event.startTime || '').substring(0,5)} - {(event.endTime || '').substring(0,5)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                  </div>
                                </Link>
                              </motion.div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                              <p className="text-4xl mb-2">🏜️</p>
                              <p>No events found for {MONTHS[currentMonth]}</p>
                              <button 
                                onClick={() => setSelectedCategory('all')} 
                                className="text-sm text-primary hover:underline mt-2"
                              >
                                Clear filters
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                  
                  {/* Vertical View Tabs - Right Side (Text) */}
                  <div className="flex flex-col border-l border-primary/10">
                    {(['calendar', 'list', 'levels'] as ViewType[]).map((viewType) => (
                      <button
                        key={viewType}
                        onClick={() => setView(viewType)}
                        className={cn(
                          "px-2 py-4 text-[10px] font-medium transition-all relative",
                          "[writing-mode:vertical-rl] rotate-180",
                          view === viewType 
                            ? "bg-primary/10 text-primary border-r-2 border-primary" 
                            : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                        )}
                      >
                        {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal for Selected Date */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md w-full h-[85vh] sm:h-[600px] p-0 gap-0 overflow-hidden bg-zinc-900 border-white/10 sm:rounded-3xl rounded-t-[32px] flex flex-col shadow-2xl [&>button]:hidden">
           <DialogHeader className="px-6 pt-8 pb-6 border-b border-white/5 bg-background/95 backdrop-blur-xl shrink-0 space-y-6">
              {/* Option X: The Headline Date (Big & Bold) */}
              <div className="flex items-start justify-between">
                 <DialogTitle className="flex items-end gap-0.5 select-none">
                     <span className="text-7xl font-black leading-[0.75] tracking-tighter text-primary">
                        {selectedDay && new Date(currentYear, currentMonth, selectedDay).getDate()}
                     </span>
                     <div className="flex flex-col pb-1.5 pl-1">
                        <span className="text-4xl font-black uppercase tracking-tighter text-foreground leading-[0.85]">
                            {selectedDay && DAYS[new Date(currentYear, currentMonth, selectedDay).getDay() === 0 ? 6 : new Date(currentYear, currentMonth, selectedDay).getDay() - 1]}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5 ml-0.5">
                            {selectedDay && MONTHS[currentMonth]} {currentYear}
                        </span>
                     </div>
                 </DialogTitle>
                 
                 <button 
                   onClick={() => setSelectedDay(null)}
                   className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors group"
                 >
                   <X className="w-6 h-6 opacity-70 group-hover:opacity-100" />
                 </button>
              </div>

              {/* Option C: Minimal Underline Tabs */}
              <div className="flex items-center justify-around w-full border-b border-white/10">
                   {(['all', 'parties', 'classes'] as Category[]).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setPopupFilter(cat)}
                        className={cn(
                          "flex-1 py-4 text-sm font-bold uppercase tracking-wider relative transition-colors",
                          popupFilter === cat 
                            ? (cat === 'parties' ? "text-festival-pink" : cat === 'classes' ? "text-festival-blue" : "text-primary") 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                         <span className="flex items-center justify-center gap-2">
                             {cat === 'all' && 'All'}
                             {cat === 'parties' && 'Parties'}
                             {cat === 'classes' && 'Classes'}
                             <span className={cn(
                               "text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 transition-colors",
                               popupFilter === cat ? "bg-current text-background" : "text-muted-foreground"
                             )}>
                               {allDayEvents.filter(e => shouldShowEventInTab(e, cat)).length}
                             </span>
                         </span>
                         {/* Active Underline */}
                         {popupFilter === cat && (
                           <motion.div
                             layoutId="activeUnderline"
                             className={cn(
                               "absolute bottom-0 left-0 right-0 h-1 rounded-t-full",
                               cat === 'parties' ? "bg-festival-pink" : cat === 'classes' ? "bg-festival-blue" : "bg-primary"
                             )}
                           />
                         )}
                      </button>
                   ))}
              </div></DialogHeader>
          
           <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-transparent to-black/20">
             {displayedPopupEvents.length > 0 ? (
                displayedPopupEvents.map((event, i) => (
                              <Link 
                                key={event.id || i}
                                to={event.eventLink}
                                className="group flex flex-col bg-black hover:bg-black/80 border border-white/5 hover:border-primary/20 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] mb-6"
                              >
                                {/* TOP SECTION: Image + Text (Approx 50% visual weight) */}
                                <div className="flex h-24">
                                  {/* Image: Square, Fixed aspect ratio */}
                                  <div className="aspect-square shrink-0 bg-muted/20 relative border-r border-white/5">
                                    {event.coverImageUrl ? (
                                      <img 
                                        src={event.coverImageUrl} 
                                        alt={event.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className={cn(
                                        "w-full h-full flex items-center justify-center",
                                        event.type === 'parties' ? "bg-festival-pink/10 text-festival-pink/40" : "bg-festival-blue/10 text-festival-blue/40"
                                      )}>
                                         {event.type === 'parties' ? <span className="text-4xl">🎉</span> : <span className="text-4xl">🎓</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Text Info: Title & Venue */}
                                  <div className="flex-1 flex flex-col justify-center items-end px-5 min-w-0 bg-black/20 text-right">
                                    <h4 className="font-bold text-[35px] leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-2 w-full">
                                      {event.title}
                                    </h4>
                                    <div className="flex items-center justify-end gap-1.5 font-bold text-[12px] truncate mt-1 w-full">
                                        <span className="text-[12px]">📍</span>
                                        <span className="truncate tracking-wide">{event.venueName}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* BOTTOM SECTION: Time Bars */}
                                <div className="flex flex-col text-sm border-t border-white/5">
                                   {/* Classes Bar */}
                                   {event.hasClass && (popupFilter === 'all' || popupFilter === 'classes') && (
                                       <div className="flex items-center justify-between px-5 py-3 bg-festival-blue/5 border-b border-white/5 last:border-0 h-12">
                                           <span className="text-lg font-bold text-festival-blue tracking-wide">CLASSES</span>
                                           <span className="font-mono text-xl tracking-tight opacity-90">
                                             {(event.classStart || '').substring(0,5)} - {(event.classEnd || '').substring(0,5)}
                                           </span>
                                       </div>
                                   )}
                                   
                                   {/* Party Bar */}
                                   {event.hasParty && (popupFilter === 'all' || popupFilter === 'parties') && (
                                       <div className="flex items-center justify-between px-5 py-3 bg-festival-pink/5 h-12">
                                           <span className="text-lg font-bold text-festival-pink tracking-wide">PARTY</span>
                                           <span className="font-mono text-xl tracking-tight opacity-90">
                                             {(event.partyStart || '').substring(0,5)} - {(event.partyEnd || '').substring(0,5)}
                                           </span>
                                       </div>
                                   )}
                                </div>
                              </Link>
                            ))
            ) : (
               <div className="text-center py-12">
                 <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4"><Filter className="w-6 h-6 opacity-30" /></div>
                 <h3 className="text-lg font-medium mb-1">No {popupFilter} found</h3>
                 <p className="text-sm text-muted-foreground">
                   Try switching tabs above to see other events.
                 </p>
                 {/* Cleaned up old buttons */}
                 {false && (
                   <div>Old buttons hidden</div>
                 )}
                    <Button 
                      onClick={() => setSelectedCategory(selectedCategory === 'parties' ? 'classes' : 'parties')}
                      variant="link"
                      className="mt-2"
                    >
                      {/* Removed */}
                    </Button>
                 {false ? ( null ) : (
                   <Button 
                     onClick={() => setSelectedDay(null)}
                     variant="ghost"
                     className="mt-4"
                   >
                     Close
                   </Button>
                 )}
               </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default EventCalendar;
