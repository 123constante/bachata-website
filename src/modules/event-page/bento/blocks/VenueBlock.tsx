import { MapPin } from 'lucide-react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventPageModel } from '@/modules/event-page/types';

type VenueBlockProps = {
  location: EventPageModel['location'];
  // When true, a third line showing the city name is appended (name /
  // address / city). Used when PromoBlock occupies the top-right slot and
  // the standalone CityBlock is therefore hidden — keeping the city visible
  // somewhere on the page. Phase 8c.
  showCityLine?: boolean;
  // Source event id — appended to the venue page URL as `?from=event:<id>`
  // so the venue page can run its warm-entry flow (filter the source event
  // out of "events here", show a thin breadcrumb back to the event).
  eventId?: string | null;
};

export const VenueBlock = ({ location, showCityLine = false, eventId = null }: VenueBlockProps) => {
  const hasVenueIdentity = Boolean(location.venueName || location.address);
  if (!hasVenueIdentity) return null;

  // Walking-distance line: only the first station is shown, only when both
  // the station name and a numeric walk-minute value are present.
  const nearest = location.transportJson?.nearest_stations?.[0];
  const walkMinutes = nearest?.walking_distance_minutes;
  const hasWalkingLine =
    Boolean(nearest?.station) && typeof walkMinutes === 'number' && Number.isFinite(walkMinutes);

  const showCity = showCityLine && Boolean(location.cityName);

  const href = location.venueId
    ? eventId
      ? `/venue-entity/${location.venueId}?from=event:${eventId}`
      : `/venue-entity/${location.venueId}`
    : undefined;

  return (
    <BentoTile title={BLOCK_TITLES.venue} color={BLOCK_COLORS.venue} href={href}>
      <div className="flex min-h-0 flex-1 flex-col gap-[4px]">
        {location.venueName && (
          <div className="text-[17px] font-extrabold leading-[1.1] tracking-[-0.015em]">
            {location.venueName}
          </div>
        )}
        {location.address && (
          <div
            className="text-[11px] leading-[1.3]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            {location.address}
          </div>
        )}
        {showCity && (
          <div
            className="text-[11px] leading-[1.3]"
            style={{ color: 'hsl(var(--bento-fg-muted))', opacity: 0.8 }}
          >
            {location.cityName}
          </div>
        )}
        {hasWalkingLine && (
          <div
            className="mt-auto flex items-center gap-[6px] pt-[8px] text-[10px]"
            style={{
              borderTop: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
              color: 'hsl(var(--bento-fg))',
            }}
          >
            <MapPin className="h-[14px] w-[14px] shrink-0" />
            <span className="leading-[1.2]">
              {walkMinutes} min walk from {nearest?.station}
            </span>
          </div>
        )}
      </div>
    </BentoTile>
  );
};
