import { Star, MapPin, ExternalLink, Bus } from 'lucide-react';
import type { FestivalHotel } from '@/modules/event-page/types';

type FestivalHotelsSectionProps = {
  hotels: FestivalHotel[];
};

export const FestivalHotelsSection = ({ hotels }: FestivalHotelsSectionProps) => {
  if (!hotels.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/45">Hotels</p>
      <div className="flex flex-col gap-3">
        {hotels.map((hotel) => (
          <div
            key={hotel.id}
            className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            {hotel.photoUrl && (
              <img
                src={hotel.photoUrl}
                alt={hotel.name ?? undefined}
                className="h-20 w-20 flex-none rounded-lg object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-white/90">{hotel.name}</p>
                {hotel.isOfficial && (
                  <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    Official
                  </span>
                )}
              </div>

              {hotel.starRating != null && hotel.starRating > 0 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: hotel.starRating }, (_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                {hotel.distance && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {hotel.distance}
                  </span>
                )}
                {hotel.shuttleAvailable && (
                  <span className="flex items-center gap-1">
                    <Bus className="h-3 w-3" /> Shuttle
                  </span>
                )}
              </div>

              {hotel.priceFrom != null && (
                <p className="text-xs text-white/65">
                  From {hotel.priceCurrency ?? ''}{hotel.priceFrom}
                  <span className="text-white/40">/night</span>
                </p>
              )}

              {hotel.bookingUrl && (
                <a
                  href={hotel.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                >
                  Book <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
