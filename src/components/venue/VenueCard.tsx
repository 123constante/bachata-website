import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import type { PublicVenueListItem } from '@/services/venuePublicService';

type AmenityPill = { key: string; emoji: string; label: string };

const buildAmenities = (venue: PublicVenueListItem): AmenityPill[] => {
  const out: AmenityPill[] = [];
  const facilities = venue.facilities_new ?? [];
  if (facilities.includes('wood_floor')) {
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
 *   today    → "Tonight 7:30pm"
 *   tomorrow → "Tomorrow 9pm"
 *   within 6 days → "Wednesday 7:30pm"
 *   further  → "26 Apr 7:30pm"
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

  // Manual 12-hour format so we never end up with stray '19' from a
  // locale that uses 24-hour and a stripped ':00'. Examples:
  //   19:00 → '7pm'   19:30 → '7:30pm'   0:00 → '12am'   12:00 → '12pm'
  const hour24 = dt.getHours();
  const minute = dt.getMinutes();
  const ampm = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 || 12;
  const time = minute === 0
    ? `${hour12}${ampm}`
    : `${hour12}:${String(minute).padStart(2, '0')}${ampm}`;

  if (dayDiff <= 0) return { text: `Tonight ${time}`, isSoon: true };
  if (dayDiff === 1) return { text: `Tomorrow ${time}`, isSoon: true };
  if (dayDiff < 7) {
    const wd = dt.toLocaleDateString('en-GB', { weekday: 'long' });
    return { text: `${wd} ${time}`, isSoon: false };
  }
  const date = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { text: `${date} ${time}`, isSoon: false };
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

export const VenueCard = ({ venue }: { venue: PublicVenueListItem }) => {
  const amenities = buildAmenities(venue);
  const nextEvent = formatNextEvent(venue.next_event_iso);
  const stationName = venue.nearest_station
    ? venue.nearest_station.replace(/\s+station$/i, '') + ' Station'
    : null;

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
          {nextEvent?.isSoon && (
            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
              {nextEvent.text}
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

          {/* Tier 2 — When (recurring pattern; specific next-event time
              shown only as the 'Tonight 7pm' pill on the image) */}
          {venue.day_pattern.length > 0 && (
            <div style={{ color: TEXT_BODY }} className="mt-2.5 text-xs leading-snug">
              <span aria-hidden="true" className="mr-1.5">📅</span>
              <span className="font-medium">
                {venue.day_pattern.join(' · ')}
              </span>
            </div>
          )}

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
        </div>
      </motion.div>
    </Link>
  );
};

export default VenueCard;
