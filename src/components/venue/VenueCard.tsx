import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import type { PublicVenueListItem } from '@/services/venuePublicService';
import './VenueCard.css';

type AmenityPill = { key: string; emoji: string; label: string };

const buildAmenities = (venue: PublicVenueListItem): AmenityPill[] => {
  const out: AmenityPill[] = [];
  const facilities = venue.facilities_new ?? [];
  // Floor type is now its own column on the venues table — no longer a
  // facilities_new[] entry. Surface it as the first amenity pill when set.
  if (venue.floor_type === 'wood') {
    out.push({ key: 'wood_floor', emoji: '🪵', label: 'Wood floor' });
  }
  if (facilities.includes('air_conditioning')) {
    out.push({ key: 'air_conditioning', emoji: '❄️', label: 'AC' });
  }
  if (facilities.includes('mirrors')) {
    out.push({ key: 'mirrors', emoji: '🪞', label: 'Mirrors' });
  }
  if (venue.cloakroom_available) {
    out.push({ key: 'cloakroom', emoji: '🧥', label: 'Cloakroom' });
  }
  return out;
};

/**
 * Format an ISO timestamp as a dancer-friendly relative label.
 *   today    → "Tonight"
 *   tomorrow → "Tomorrow"
 *   within 6 days → "Wednesday"
 *   further  → "26 Apr"
 *
 * Note: we DON'T include the event name here. The venue card answers
 * "when can I come dance here?" — the event name is the events page's job.
 */
const formatNextEvent = (iso: string | null): { text: string; isSoon: boolean } | null => {
  if (!iso) return null;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  const now = new Date();

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const dayDiff = Math.round(
    (startOfDay(dt).getTime() - startOfDay(now).getTime()) / 86_400_000
  );

  if (dayDiff <= 0) return { text: 'Tonight', isSoon: true };
  if (dayDiff === 1) return { text: 'Tomorrow', isSoon: true };
  if (dayDiff < 7) {
    const wd = dt.toLocaleDateString('en-GB', { weekday: 'long' });
    return { text: wd, isSoon: false };
  }
  const date = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { text: date, isSoon: false };
};

// Warm cream palette (option B) — colours tuned to read cleanly on a
// dark page background while keeping enough internal contrast for
// readability across all the text rows.
const CARD_BG = '#f7f3ea';        // warm cream surface
const CARD_IMAGE_BG = '#1a1a2e';  // dark behind images (photo fills it; muted placeholder when none)
const TEXT_PRIMARY = '#2a1f10';   // venue name — warm near-black
const TEXT_BODY = '#3a2e1c';      // body lines — slightly softer
const TEXT_MUTED = '#8a7a5c';     // walk-time, secondary annotations
const PILL_BG = '#ebe3d0';        // amenity pill background — same family as card, one stop deeper
const PILL_TEXT = '#5a4a30';      // amenity pill text — dark warm
const BORDER = '#e0d6bc';         // card border — same family, slightly darker than surface

const getThisWeekendDays = (nextEventIso: string | null): { fri: boolean; sat: boolean; sun: boolean } => {
  if (!nextEventIso) return { fri: false, sat: false, sun: false };

  const eventDate = new Date(nextEventIso);
  if (isNaN(eventDate.getTime())) return { fri: false, sat: false, sun: false };

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Calculate this coming weekend's Friday-Sunday range
  let daysUntilFriday: number;
  if (dayOfWeek <= 5) {
    daysUntilFriday = 5 - dayOfWeek;
  } else {
    daysUntilFriday = 5 + (7 - dayOfWeek);
  }

  const friday = new Date(now);
  friday.setDate(friday.getDate() + daysUntilFriday);
  friday.setHours(0, 0, 0, 0);

  const sunday = new Date(friday);
  sunday.setDate(sunday.getDate() + 2);
  sunday.setHours(23, 59, 59, 999);

  // Check if event falls within Fri-Sun range
  const inRange = eventDate >= friday && eventDate <= sunday;
  if (!inRange) return { fri: false, sat: false, sun: false };

  // Determine which specific day
  const eventDayOfWeek = eventDate.getDay();
  return {
    fri: eventDayOfWeek === 5,
    sat: eventDayOfWeek === 6,
    sun: eventDayOfWeek === 0,
  };
};

export const VenueCard = ({ venue, isWeekendFilterActive = false, isWoodFloorFilterActive = false }: { venue: PublicVenueListItem; isWeekendFilterActive?: boolean; isWoodFloorFilterActive?: boolean }) => {
  const amenities = buildAmenities(venue);
  const nextEvent = formatNextEvent(venue.next_event_iso);
  const stationName = venue.nearest_station
    ? venue.nearest_station.replace(/\s+station$/i, '') + ' Station'
    : null;
  const weekendDays = getThisWeekendDays(venue.next_event_iso);

  return (
    <Link to={`/venue-entity/${venue.id}`} className="block group h-full">
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        style={{ backgroundColor: CARD_BG, borderColor: BORDER }}
        className="h-full border rounded-2xl overflow-hidden hover:border-primary transition-all shadow-xl shadow-black/40 isolate"
      >
        {/* Image area with "Tonight" pill overlay */}
        <div style={{ backgroundColor: CARD_IMAGE_BG }} className="aspect-[4/3] relative overflow-hidden">
          {venue.cover_image ? (
            <img
              src={venue.cover_image}
              alt={venue.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20">
              <Building2 className="w-8 h-8 text-primary/40" />
            </div>
          )}
          {!isWeekendFilterActive && !isWoodFloorFilterActive && nextEvent?.isSoon && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-md shadow-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-500 w-24">
              <div className="text-[11px] font-semibold px-2 py-1.5">{nextEvent.text}</div>
              {venue.day_pattern.length > 0 && (() => {
                const now = new Date();
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = dayNames[now.getDay()];
                const otherDays = venue.day_pattern.filter(day => day !== todayName);
                return otherDays.length > 0 && (
                  <div className="text-[8px] font-medium px-2 py-1 bg-primary/80 opacity-95 border-t border-primary-foreground/20 break-words">
                    {otherDays.join(' · ')}
                  </div>
                );
              })()}
            </div>
          )}
          {!isWeekendFilterActive && !isWoodFloorFilterActive && !nextEvent?.isSoon && venue.day_pattern.length > 0 && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
              {venue.day_pattern.join(' · ')}
            </div>
          )}
          {(isWeekendFilterActive || isWoodFloorFilterActive) && (
            <div className="filter-badge-container">
              {isWoodFloorFilterActive && venue.floor_type === 'wood' && (
                <div className="filter-badge wood-floor-badge">🪵</div>
              )}
              {isWeekendFilterActive && (weekendDays.fri || weekendDays.sat || weekendDays.sun) && (
                <div className="weekend-badge-container">
                  {weekendDays.fri && (
                    <div className="weekend-badge">Fri</div>
                  )}
                  {weekendDays.sat && (
                    <div className="weekend-badge">Sat</div>
                  )}
                  {weekendDays.sun && (
                    <div className="weekend-badge">Sun</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: CARD_BG }} className="p-3">
          {/* Tier 1 — venue name */}
          <h3
            style={{ color: TEXT_PRIMARY }}
            className="text-lg font-bold tracking-tight truncate leading-tight group-hover:text-primary transition-colors"
          >
            {venue.name}
          </h3>


          {/* Tier 2 — Where */}
          {stationName && (
            <div style={{ color: TEXT_BODY }} className="mt-2 text-xs truncate">
              <span aria-hidden="true" className="mr-1.5">📍</span>
              <span>{stationName}</span>
              {venue.nearest_station_minutes != null && (
                <span style={{ color: TEXT_MUTED }}> · {venue.nearest_station_minutes} min walk</span>
              )}
            </div>
          )}

          {/* Tier 3 — Amenities */}
          {amenities.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              {amenities.map(({ key, emoji, label }) => (
                <span
                  key={key}
                  style={{ backgroundColor: PILL_BG, color: PILL_TEXT }}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                >
                  <span aria-hidden="true">{emoji}</span>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Tier 4 — Address */}
          {venue.address && (
            <div style={{ color: TEXT_BODY }} className="mt-2 text-xs underline">
              {venue.address}
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
};

export default VenueCard;
