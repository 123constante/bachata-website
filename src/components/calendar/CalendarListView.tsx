import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { CalendarEventItem, Category } from '@/components/calendar/calendarUtils';
import { MONTHS, matchesCategory } from '@/components/calendar/calendarUtils';

type UserLocation = { lat: number; lng: number };

interface CalendarListViewProps {
  currentMonth: number;
  currentYear: number;
  selectedCategory: Category;
  events: CalendarEventItem[];
  onClearFilters: () => void;
  userLocation?: UserLocation | null;
}

const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── D8 Marquee date header ────────────────────────────────────────────────
const GOLD_LIT = '#f4c673';
const GOLD_DIM = 'rgba(212, 165, 90, 0.55)';
const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

interface MarqueeDateHeaderProps {
  date: number;
  month: number;
  dayOfWeek: string;
  isToday: boolean;
  relative: string;
}

const MarqueeDateHeader = ({ date, month, dayOfWeek, isToday, relative }: MarqueeDateHeaderProps) => {
  const Bulb = ({ lit }: { lit: boolean }) => (
    <div style={{
      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
      background: lit ? GOLD_LIT : GOLD_DIM,
      boxShadow: lit ? `0 0 4px ${GOLD_LIT}` : 'none',
    }} />
  );
  const BulbRow = () => (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
      {Array.from({ length: 11 }).map((_, i) => <Bulb key={i} lit={isToday} />)}
    </div>
  );
  return (
    <div style={{ textAlign: 'center', padding: '14px 0 12px' }}>
      <BulbRow />
      <div style={{ padding: '8px 0' }}>
        <div style={{
          fontFamily: '"Bebas Neue", "Anton", impact, sans-serif',
          fontSize: 26, letterSpacing: 3, lineHeight: 1, fontWeight: 700,
          color: isToday ? GOLD_LIT : 'hsl(var(--foreground))',
        }}>
          {dayOfWeek.slice(0, 3)} {date}
        </div>
        <div style={{
          fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600,
          color: 'hsl(var(--muted-foreground))',
        }}>
          {MONTHS_SHORT[month]}
          {' · '}
          <span style={{ color: isToday ? GOLD_LIT : 'hsl(var(--muted-foreground))' }}>
            {relative.toUpperCase()}
          </span>
        </div>
      </div>
      <BulbRow />
    </div>
  );
};

// ── W13 Cream Paper event card ────────────────────────────────────────────
const INK = '#3a2418';
const INK_MUTED = '#7a5c4a';
const CARD_BG = '#ede3cf';
const CLASS_COLOR = '#b8731f';
const PARTY_COLOR = '#a44326';

type EventRowProps = {
  event: CalendarEventItem;
  delayIndex: number;
  userLocation: UserLocation | null;
  selectedCategory: Category;
};

const EventRow = ({ event, delayIndex, userLocation, selectedCategory }: EventRowProps) => {
  const delay = Math.min(delayIndex * 0.04, 0.4);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link
        to={event.eventLink}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 14px 14px 18px',
          background: CARD_BG,
          borderRadius: 8,
          border: '1px solid rgba(58, 36, 24, 0.12)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          textDecoration: 'none',
        }}
      >
        {/* Info — left, flex-1 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, lineHeight: 1.2,
            color: INK, letterSpacing: -0.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {event.title}
          </div>
          <div style={{
            fontSize: 12.5, color: INK_MUTED, fontStyle: 'italic',
            fontFamily: '"Cormorant Garamond", Georgia, serif', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            at {event.venueName}
          </div>

          {((event.goingCount ?? 0) > 0 || (userLocation && event.venueLat != null)) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              {(event.goingCount ?? 0) > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#6b4c2a',
                  background: 'rgba(58,36,24,0.10)', borderRadius: 999,
                  padding: '2px 8px',
                }}>
                  {event.goingCount} going
                </span>
              )}
              {userLocation && event.venueLat != null && (
                <span style={{
                  fontSize: 10, color: INK_MUTED,
                  background: 'rgba(58,36,24,0.07)', borderRadius: 999,
                  padding: '2px 8px',
                }}>
                  {haversineMiles(userLocation.lat, userLocation.lng, event.venueLat!, event.venueLng!).toFixed(1)} mi
                </span>
              )}
            </div>
          )}

          {event.hasClass && (selectedCategory === 'all' || selectedCategory === 'classes') && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 13 }}>
              <span style={{ color: CLASS_COLOR, fontWeight: 700 }}>Classes</span>
              <span style={{ color: INK, fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>
                {event.classStart ?? ''}{event.classEnd ? ` – ${event.classEnd}` : ''}
              </span>
            </div>
          )}
          {event.hasParty && (selectedCategory === 'all' || selectedCategory === 'parties') && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 13 }}>
              <span style={{ color: PARTY_COLOR, fontWeight: 700 }}>Party</span>
              <span style={{ color: INK, fontVariantNumeric: 'tabular-nums', opacity: 0.75 }}>
                {event.partyStart ?? ''}{event.partyEnd ? ` – ${event.partyEnd}` : ''}
              </span>
            </div>
          )}
          {!event.hasClass && !event.hasParty && (
            <div style={{ fontSize: 13, color: INK_MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
            </div>
          )}
        </div>

        {/* Image — right, 62×62 */}
        <div style={{
          width: 62, height: 62, borderRadius: 4, overflow: 'hidden',
          flexShrink: 0, background: '#d4c4a8',
        }}>
          {event.coverImageUrl ? (
            <img
              src={event.coverImageUrl}
              alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, opacity: 0.5,
            }}>
              {event.type === 'parties' ? '🎉' : '🎓'}
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M5 3 L9 7 L5 11" stroke={INK} strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </motion.div>
  );
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

  const now = new Date();
  const isCurrentMonth =
    currentYear === now.getFullYear() && currentMonth === now.getMonth();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const effectiveStart =
    isCurrentMonth && todayStart > monthStart ? todayStart : monthStart;

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filtered = events
    .filter(
      (e) =>
        e.endDate >= effectiveStart &&
        e.startDate <= monthEnd &&
        matchesCategory(e, selectedCategory),
    )
    .sort((a, b) => {
      if (userLocation && a.venueLat != null && b.venueLat != null) {
        const distA = haversineMiles(userLocation.lat, userLocation.lng, a.venueLat!, a.venueLng!);
        const distB = haversineMiles(userLocation.lat, userLocation.lng, b.venueLat!, b.venueLng!);
        return distA - distB;
      }
      return a.startDate.getTime() - b.startDate.getTime();
    });

  const dayGroups = useMemo(() => {
    if (userLocation) return null;
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of filtered) {
      const arr = map.get(event.instanceDateIso) ?? [];
      arr.push(event);
      map.set(event.instanceDateIso, arr);
    }
    return map;
  }, [filtered, userLocation]);

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

  if (dayGroups) {
    let flat = 0;
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="space-y-4"
      >
        {Array.from(dayGroups.entries()).map(([iso, dayEvents]) => {
          const first = dayEvents[0];
          const headerDate = new Date(first.year, first.month, first.date);
          const daysDiff = Math.round(
            (headerDate.getTime() - todayMidnight.getTime()) / 86_400_000,
          );
          const relative =
            daysDiff === 0 ? 'Today' : daysDiff === 1 ? 'Tomorrow' : `In ${daysDiff} days`;
          const isToday = daysDiff === 0;
          const dayOfWeek = format(headerDate, 'EEEE').toUpperCase();

          return (
            <section key={iso}>
              <MarqueeDateHeader
                date={first.date}
                month={first.month}
                dayOfWeek={dayOfWeek}
                isToday={isToday}
                relative={relative}
              />
              <div className="space-y-3">
                {dayEvents.map((event) => {
                  const thisIndex = flat++;
                  return (
                    <EventRow
                      key={`${event.id}-${event.instanceDateIso}`}
                      event={event}
                      delayIndex={thisIndex}
                      userLocation={userLocation ?? null}
                      selectedCategory={selectedCategory}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      {filtered.map((event, i) => (
        <EventRow
          key={`${event.id}-${event.instanceDateIso}`}
          event={event}
          delayIndex={i}
          userLocation={userLocation ?? null}
          selectedCategory={selectedCategory}
        />
      ))}
    </motion.div>
  );
};
