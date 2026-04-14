import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Train, Users, X, ChevronLeft, ChevronRight, Images, Calendar } from 'lucide-react';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { supabase } from '@/integrations/supabase/client';
import PageBreadcrumb from '@/components/PageBreadcrumb';

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
const Lightbox = ({
  urls,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
    onClick={onClose}
  >
    <button
      className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
      onClick={onClose}
      aria-label="Close"
    >
      <X className="h-5 w-5" />
    </button>
    {urls.length > 1 && (
      <button
        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
    )}
    {urls.length > 1 && (
      <button
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    )}
    <img
      src={`${urls[index]}?t=1`}
      alt={`Photo ${index + 1} of ${urls.length}`}
      className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
      onClick={(e) => e.stopPropagation()}
    />
    {urls.length > 1 && (
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
        {index + 1} / {urls.length}
      </span>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Fever-style photo block
// ---------------------------------------------------------------------------
const VenuePhotoBlock = ({ allImages, venueName }: { allImages: string[]; venueName: string }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const close  = useCallback(() => setLightboxIndex(null), []);
  const prev   = useCallback(() => setLightboxIndex((i) => i !== null ? (i - 1 + allImages.length) % allImages.length : null), [allImages.length]);
  const next   = useCallback(() => setLightboxIndex((i) => i !== null ? (i + 1) % allImages.length : null), [allImages.length]);

  if (!allImages.length) return null;

  const primary  = allImages[0];
  const thumbs   = allImages.slice(1, 5);          // up to 4 right-side tiles
  const showMore = allImages.length > 5;
  const moreCount = allImages.length - 5;

  return (
    <>
      {/* Single image — full-width 16:9 hero (all breakpoints) */}
      {allImages.length === 1 && (
        <button
          type="button"
          className="w-full aspect-[16/9] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={() => setLightboxIndex(0)}
        >
          <img
            src={`${allImages[0]}?t=1`}
            alt={`${venueName} cover`}
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        </button>
      )}

      {/* Mobile: horizontal scroll (2+ images) */}
      {allImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto md:hidden">
          {allImages.map((url, i) => (
            <button
              key={url + i}
              type="button"
              className="flex-none aspect-[4/3] h-52 overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={() => setLightboxIndex(i)}
            >
              <img
                src={`${url}?t=1`}
                alt={`${venueName} photo ${i + 1}`}
                className="h-full w-full object-cover object-center"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>
      )}

      {/* Desktop: Fever-style split (2+ images) */}
      {allImages.length > 1 && (
        <div className="hidden md:grid md:grid-cols-[3fr_2fr] md:gap-1 overflow-hidden rounded-xl">
        {/* Primary — left, full height */}
        <button
          type="button"
          className="relative aspect-[4/3] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={() => setLightboxIndex(0)}
        >
          <img
            src={`${primary}?t=1`}
            alt={`${venueName} cover`}
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        </button>

        {/* Right thumbnails */}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {thumbs.map((url, i) => {
              const absIdx = i + 1;
              const isLastVisible = i === thumbs.length - 1 && showMore;
              return (
                <button
                  key={url + i}
                  type="button"
                  className="relative aspect-square overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  onClick={() => setLightboxIndex(isLastVisible ? 0 : absIdx)}
                >
                  <img
                    src={`${url}?t=1`}
                    alt={`${venueName} photo ${absIdx + 1}`}
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                  {isLastVisible && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(0); }}
                    >
                      <Images className="h-5 w-5" />
                      <span className="text-sm font-semibold">+{moreCount} more</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox urls={allImages} index={lightboxIndex} onClose={close} onPrev={prev} onNext={next} />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FACILITY_LABELS: Record<string, string> = {
  air_conditioning: 'Air Conditioning',
  wood_floor: 'Wood Floor',
  mirrors: 'Mirrors',
  sound_system: 'Sound System',
  stage: 'Stage',
  wheelchair_access: 'Wheelchair Access',
};

const toTitleCase = (key: string) =>
  key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const getFacilityLabel = (key: string) => FACILITY_LABELS[key] ?? toTitleCase(key);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const VenueDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ['venue-upcoming-events', id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as any, {
        p_from: now,
        p_to: thirtyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      });
      return (data as Array<{ event_id: string; name: string; instance_start: string; occurrence_id: string; poster_url: string | null }>) ?? [];
    },
    enabled: !!id && !!venue,
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading venue…</div>;
  }

  if (!venue) {
    return <div className="p-6 text-center text-muted-foreground">Venue not found</div>;
  }

  const mapsHref = venue.google_maps_href ?? venue.google_maps_link ?? venue.google_maps_url ?? null;

  const coverPhoto = venue.image_url?.[0] ?? null;

  const galleryUrls = venue.gallery_urls ?? [];
  const allImages = [coverPhoto, ...galleryUrls].filter((u): u is string => Boolean(u));

  const tj = venue.transport_json;
  const transportNotes =
    tj && typeof tj.notes === 'string' && tj.notes.trim() ? tj.notes.trim() : null;
  const nearestStations: Array<{ station: string; line_names: string[]; walking_distance_minutes: number }> =
    tj && Array.isArray(tj.nearest_stations)
      ? (tj.nearest_stations as Array<{ station: string; line_names: string[]; walking_distance_minutes: number }>)
      : [];
  const hasTransport = Boolean(transportNotes || nearestStations.length > 0);

  const openingHoursEntries =
    venue.opening_hours && Object.keys(venue.opening_hours).length > 0
      ? Object.entries(venue.opening_hours).filter(([, v]) => v !== null && v !== undefined)
      : [];

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <PageBreadcrumb items={[{ label: 'Venues', path: '/venues' }, { label: venue.name }]} />

      {/* Fever-style photo block — above name/address */}
      {allImages.length > 0 && (
        <VenuePhotoBlock allImages={allImages} venueName={venue.name} />
      )}

      <div className="px-4 py-6 space-y-4">
        <h1 className="text-3xl font-bold">{venue.name}</h1>

        {(venue.address || venue.postcode) && (
          <p className="text-muted-foreground">
            {[venue.address, venue.postcode].filter(Boolean).join(', ')}
          </p>
        )}

        {venue.description && (
          <p className="text-sm leading-relaxed">{venue.description}</p>
        )}

        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            View on Google Maps
          </a>
        )}

        {venue.website && (
          <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-primary underline"
          >
            {venue.website}
          </a>
        )}

        {venue.phone && (
          <p className="text-sm">
            <span className="font-medium">Phone: </span>{venue.phone}
          </p>
        )}

        {venue.email && (
          <p className="text-sm">
            <span className="font-medium">Email: </span>{venue.email}
          </p>
        )}

        {/* Capacity + floor type */}
        {(venue.capacity !== null || venue.floor_type) && (
          <div className="flex flex-wrap gap-2">
            {venue.capacity !== null && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {venue.capacity} capacity
              </span>
            )}
            {venue.floor_type && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {venue.floor_type}
              </span>
            )}
          </div>
        )}

        {/* Facilities */}
        {(venue.facilities_new?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Facilities</p>
            <div className="flex flex-wrap gap-1.5">
              {venue.facilities_new!.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {getFacilityLabel(key)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Getting Here */}
        {hasTransport && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Getting Here</p>
            {transportNotes && (
              <p className="text-sm leading-relaxed text-muted-foreground">{transportNotes}</p>
            )}
            {nearestStations.length > 0 && (
              <ul className="space-y-1.5">
                {nearestStations.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Train className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{s.station}</span>
                      {s.line_names?.length > 0 && (
                        <span className="text-muted-foreground"> · {s.line_names.join(', ')}</span>
                      )}
                      <span className="text-muted-foreground"> · {s.walking_distance_minutes} min walk</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Opening Hours */}
        {openingHoursEntries.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Opening Hours</p>
            <ul className="space-y-1">
              {openingHoursEntries.map(([day, hours]) => {
                let hoursLabel: string;
                if (typeof hours === 'string') {
                  hoursLabel = hours;
                } else if (
                  hours !== null &&
                  typeof hours === 'object' &&
                  !Array.isArray(hours)
                ) {
                  const h = hours as { open?: string | null; close?: string | null };
                  if (!h.open && !h.close) return null;
                  hoursLabel = [h.open, h.close].filter(Boolean).join(' – ');
                } else {
                  return null;
                }
                return (
                  <li key={day} className="flex justify-between text-sm">
                    <span className="font-medium capitalize">{day}</span>
                    <span className="text-muted-foreground">{hoursLabel}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Upcoming Events */}
        {(upcomingEvents?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Upcoming Events</p>
            <ul className="space-y-2">
              {upcomingEvents!.map((evt) => {
                const d = new Date(evt.instance_start);
                const dateLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <li key={evt.occurrence_id ?? evt.event_id}>
                    <Link
                      to={`/event/${evt.event_id}`}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 transition hover:border-primary/50"
                    >
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{evt.name}</p>
                        <p className="text-xs text-muted-foreground">{dateLabel}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueDetail;

