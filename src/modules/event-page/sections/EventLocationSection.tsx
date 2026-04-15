import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { EventPageModel } from '@/modules/event-page/types';

type EventLocationSectionProps = {
  location: EventPageModel['location'];
};

export const EventLocationSection = ({ location }: EventLocationSectionProps) => {
  if (!location.isVisible) return null;

  const hasLocationInfo = location.venueName || location.address || location.postcode;
  if (!hasLocationInfo) return null;

  const venueHref = location.venueId ? `/venue-entity/${location.venueId}` : null;

  const content = (
    <div className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.06] transition-all active:scale-[0.98]">
      <div className="flex items-start gap-2">
        <MapPin className="mt-0.5 h-4 w-4 text-white/85 flex-shrink-0" />
        <div className="min-w-0">
          {location.venueName && (
            <p className="text-sm font-semibold text-white">{location.venueName}</p>
          )}
          {(location.address || location.postcode) && (
            <p className="text-xs leading-snug text-gray-400 mt-1">
              {[location.address, location.postcode].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <section>
      {venueHref ? (
        <Link to={venueHref}>{content}</Link>
      ) : (
        <a
          href={location.googleMapsLink || undefined}
          target={location.googleMapsLink ? "_blank" : undefined}
          rel={location.googleMapsLink ? "noopener noreferrer" : undefined}
        >
          {content}
        </a>
      )}
    </section>
  );
};
