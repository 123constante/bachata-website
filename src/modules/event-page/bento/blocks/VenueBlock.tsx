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
};

export const VenueBlock = ({ location, showCityLine = false }: VenueBlockProps) => {
  const hasVenueIdentity = Boolean(location.venueName || location.address);
  if (!hasVenueIdentity) return null;

  // Walking-distance line: only the first station is shown, only when both
  // the station name and a numeric walk-minute value are present.
  const nearest = location.transportJson?.nearest_stations?.[0];
  const walkMinutes = nearest?.walking_distance_minutes;
  const hasWalkingLine =
    Boolean(nearest?.station) && typeof walkMinutes === 'number' && Number.isFinite(walkMinutes);

  const showCity = showCityLine && Boolean(location.cityName);

  const href = location.venueId ? `/venue-entity/${location.venueId}` : undefined;

  return (
    <BentoTile title={BLOCK_TITLES.venue} color={BLOCK_COLORS.venue} href={href}>
      <div className="flex min-h-0 flex-1 flex-col gap-[6px]">
        {location.venueName && (
          <div className="text-[17px] font-extrabold leading-[1.1] tracking-[-0.015em]">
            {location.venueName}
          </div>
        )}
        {location.address && (
          <div className="text-[11px] leading-[1.3] text-white/85">{location.address}</div>
        )}
        {showCity && (
          <div className="text-[11px] leading-[1.3] text-white/75">{location.cityName}</div>
        )}
        {hasWalkingLine && (
          <div className="mt-auto flex items-center gap-[6px] border-t border-white/20 pt-[8px] text-[10px] text-white/90">
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
