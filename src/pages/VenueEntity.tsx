import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Building2, Calendar, MapPin, Clock, Phone, Mail,
  Globe, Instagram, Car, Train, Users, Layers, Info, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { VenueGalleryLightbox } from '@/components/venue/VenueGalleryLightbox';

type VenueOccurrenceRow = {
  event_id: string;
  name: string;
  instance_start: string;
  occurrence_id: string;
  poster_url: string | null;
};

type FaqItem = { q?: string | null; a?: string | null };

const parseStrArray = (val: unknown): string[] | null => {
  if (!val) return null;
  if (Array.isArray(val)) return (val as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? (p as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0) : null;
    } catch {
      return [val];
    }
  }
  return null;
};

type Station = { station?: string | null; line_names?: string[] | null; walking_distance_minutes?: number | null };
type TransportJson = { notes?: string | null; nearest_stations?: Station[] | null };
type ParkingJson = { parking_available?: boolean | null; nearby_parking_notes?: string | null };

const PILL_CLASS =
  'inline-flex items-center gap-1.5 rounded-md bg-muted/50 hover:bg-muted px-2 py-1 text-xs transition-colors';

const stationMapUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

const VenueEntity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const ninetyDaysLater = new Date(Date.now() + 90 * 86400000).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as never, {
        p_from: now,
        p_to: ninetyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      } as never);
      return ((data as VenueOccurrenceRow[] | null) ?? []).slice(0, 5);
    },
    enabled: !!id && !!venue,
  });

  const venueBreadcrumbs = [{ label: 'Venues', path: '/venues' }];

  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={venueBreadcrumbs}
        backHref="/venues"
        showGradientBg={false}
      >
        <div className="max-w-2xl mx-auto px-3 pb-20 space-y-3">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </GlobalLayout>
    );
  }

  if (!venue) {
    return (
      <GlobalLayout
        breadcrumbs={venueBreadcrumbs}
        backHref="/venues"
        showGradientBg={false}
      >
        <div className="max-w-2xl mx-auto px-3 pb-20 text-center">
          <h1 className="text-lg font-bold text-foreground mb-2">Venue Not Found</h1>
          <p className="text-xs text-muted-foreground mb-4">This venue doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/venues')} variant="outline" size="sm">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to Venues
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  const facilities = parseStrArray(venue.facilities_new ?? venue.facilities);
  const floorType = parseStrArray(venue.floor_type);
  const galleryUrls = parseStrArray(venue.gallery_urls);
  const rules = parseStrArray(venue.rules);

  const transportJson: TransportJson | null =
    venue.transport_json && typeof venue.transport_json === 'object' && !Array.isArray(venue.transport_json)
      ? (venue.transport_json as TransportJson)
      : null;
  const parkingJson: ParkingJson | null =
    venue.parking_json && typeof venue.parking_json === 'object' && !Array.isArray(venue.parking_json)
      ? (venue.parking_json as ParkingJson)
      : null;

  const faqItems: FaqItem[] = Array.isArray(venue.faq_json)
    ? (venue.faq_json as FaqItem[]).filter((f) => f && (f.q || f.a))
    : [];

  const addressLine = [venue.address, venue.postcode].filter(Boolean).join(', ');
  const mapsUrl =
    venue.google_maps_href ||
    venue.google_maps_link ||
    venue.google_maps_url ||
    (addressLine
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [venue.name, addressLine, venue.city_name].filter(Boolean).join(', '),
        )}`
      : null);

  const openingHours =
    venue.opening_hours && typeof venue.opening_hours === 'object' && !Array.isArray(venue.opening_hours)
      ? (venue.opening_hours as Record<string, unknown>)
      : null;

  const heroImage = Array.isArray(venue.image_url) && venue.image_url.length > 0 ? venue.image_url[0] : null;
  const allImages = [heroImage, ...(galleryUrls ?? [])].filter((u): u is string => Boolean(u));

  const addressPillText = [venue.city_name, venue.address, venue.postcode].filter(Boolean).join(', ');

  const hasContact = venue.phone || venue.email || venue.website || venue.instagram;
  const hasDetails = venue.capacity || (facilities && facilities.length > 0) || (floorType && floorType.length > 0);
  const hasHours = openingHours && Object.keys(openingHours).length > 0;
  const hasRules = rules && rules.length > 0;
  const hasFeatures = venue.bar_available || venue.cloakroom_available || venue.id_required;
  const hasTransport =
    transportJson &&
    ((Array.isArray(transportJson.nearest_stations) && transportJson.nearest_stations.length > 0) ||
      !!transportJson.notes);
  const hasParking =
    parkingJson &&
    (parkingJson.parking_available !== null || !!parkingJson.nearby_parking_notes);
  const hasFaq = faqItems.length > 0;

  return (
    <GlobalLayout
      breadcrumbs={venueBreadcrumbs}
      backHref="/venues"
      showGradientBg={false}
    >
      <div className="max-w-2xl mx-auto px-3 pb-20">
        {/* Merged media block */}
        <div className="mb-3">
          {allImages.length > 0 ? (
            <VenueGalleryLightbox allImages={allImages} venueName={venue.name} />
          ) : (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-primary/40" />
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className="text-lg font-bold text-foreground truncate mb-2">{venue.name}</h1>

        {/* Identity strip — pills */}
        {(addressPillText || venue.capacity) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {addressPillText && (
              mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={PILL_CLASS}>
                  <MapPin className="w-3 h-3 flex-shrink-0 text-primary" />
                  <span className="truncate max-w-[70vw] sm:max-w-md">{addressPillText}</span>
                </a>
              ) : (
                <span className={cn(PILL_CLASS, 'hover:bg-muted/50 cursor-default')}>
                  <MapPin className="w-3 h-3 flex-shrink-0 text-primary" />
                  <span className="truncate max-w-[70vw] sm:max-w-md">{addressPillText}</span>
                </span>
              )
            )}
            {venue.capacity && (
              <span className={cn(PILL_CLASS, 'hover:bg-muted/50 cursor-default')}>
                <Users className="w-3 h-3 flex-shrink-0 text-primary" />
                <span className="font-medium">{venue.capacity}</span>
                <span className="text-muted-foreground">capacity</span>
              </span>
            )}
          </div>
        )}

        {/* Description — full width prose */}
        {venue.description && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">About</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{venue.description}</p>
          </div>
        )}

        {/* Rules — full width */}
        {hasRules && (
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <h2 className="text-xs font-semibold text-foreground">Venue Rules</h2>
            </div>
            <div className="flex flex-wrap gap-1">
              {rules!.map((rule, i) => (
                <Badge key={i} variant="destructive" className="text-[10px] px-1.5 py-0">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Two-column body grid */}
        {(hasDetails || hasContact || hasTransport || hasParking || hasHours || hasFeatures || hasFaq) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-min mb-3">
            {/* Venue Details */}
            {hasDetails && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">Venue Details</h2>
                </div>
                <div className="space-y-2">
                  {floorType && floorType.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Floor Type</p>
                      <div className="flex flex-wrap gap-1">
                        {floorType.map((type, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {facilities && facilities.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Facilities</p>
                      <div className="flex flex-wrap gap-1">
                        {facilities.map((facility, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                            {facility}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact */}
            {hasContact && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">Contact</h2>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {venue.phone && (
                    <a href={`tel:${venue.phone}`} className="bg-muted/50 rounded-md p-2 text-center hover:bg-muted transition-colors">
                      <Phone className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Call</p>
                    </a>
                  )}
                  {venue.email && (
                    <a href={`mailto:${venue.email}`} className="bg-muted/50 rounded-md p-2 text-center hover:bg-muted transition-colors">
                      <Mail className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Email</p>
                    </a>
                  )}
                  {venue.website && (
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="bg-muted/50 rounded-md p-2 text-center hover:bg-muted transition-colors">
                      <Globe className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Website</p>
                    </a>
                  )}
                  {venue.instagram && (
                    <a href={`https://instagram.com/${venue.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="bg-muted/50 rounded-md p-2 text-center hover:bg-muted transition-colors">
                      <Instagram className="w-4 h-4 mx-auto mb-1 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Instagram</p>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Getting Here */}
            {hasTransport && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Train className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">Getting here</h2>
                </div>
                {Array.isArray(transportJson!.nearest_stations) && transportJson!.nearest_stations.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {transportJson!.nearest_stations.map((s, i) => {
                      const label = s.station || 'Station';
                      return (
                        <a
                          key={i}
                          href={stationMapUrl(label)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(PILL_CLASS, 'justify-between')}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Train className="w-3 h-3 text-primary shrink-0" />
                            <span className="text-foreground font-medium truncate">{label}</span>
                            {Array.isArray(s.line_names) && s.line_names.length > 0 && (
                              <span className="flex gap-1 flex-wrap">
                                {s.line_names.map((line, j) => (
                                  <Badge key={j} variant="outline" className="text-[9px] px-1 py-0">{line}</Badge>
                                ))}
                              </span>
                            )}
                          </span>
                          {typeof s.walking_distance_minutes === 'number' && (
                            <span className="text-muted-foreground whitespace-nowrap ml-2">
                              {s.walking_distance_minutes} min
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
                {transportJson!.notes && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{transportJson!.notes}</p>
                )}
              </div>
            )}

            {/* Parking */}
            {hasParking && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Car className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">Parking</h2>
                </div>
                {parkingJson!.parking_available !== null && parkingJson!.parking_available !== undefined && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] mb-1',
                      parkingJson!.parking_available
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-muted-foreground/30 bg-muted/20 text-muted-foreground',
                    )}
                  >
                    {parkingJson!.parking_available ? 'On-site parking available' : 'No on-site parking'}
                  </Badge>
                )}
                {parkingJson!.nearby_parking_notes && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{parkingJson!.nearby_parking_notes}</p>
                )}
              </div>
            )}

            {/* Opening Hours */}
            {hasHours && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">Opening Hours</h2>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(openingHours!).map(([day, hours]) => {
                    let displayHours = '';
                    if (typeof hours === 'string') {
                      displayHours = hours;
                    } else if (hours && typeof hours === 'object') {
                      const h = hours as { open?: string; close?: string; isOpen?: boolean };
                      if (h.isOpen === false) {
                        displayHours = 'Closed';
                      } else if (h.open && h.close) {
                        displayHours = `${h.open} - ${h.close}`;
                      }
                    }
                    if (!displayHours) return null;
                    return (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{day}</span>
                        <span className="text-foreground">{displayHours}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Features */}
            {hasFeatures && (
              <div className="bg-card border border-border rounded-lg p-3">
                <h2 className="text-xs font-semibold text-foreground mb-2">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {venue.bar_available && (
                    <Badge variant="outline" className="text-[10px]">🍹 Bar available</Badge>
                  )}
                  {venue.cloakroom_available && (
                    <Badge variant="outline" className="text-[10px]">🧥 Cloakroom</Badge>
                  )}
                  {venue.id_required && (
                    <Badge variant="outline" className="text-[10px]">🪪 ID required</Badge>
                  )}
                </div>
              </div>
            )}

            {/* FAQ */}
            {hasFaq && (
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-semibold text-foreground">FAQ</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {faqItems.map((item, i) => (
                    <div key={i}>
                      {item.q && <p className="text-sm font-medium text-foreground">{item.q}</p>}
                      {item.a && <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upcoming Events */}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">Upcoming events at this venue</h2>
          </div>
          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {events.map((event) => (
                <Link
                  key={event.occurrence_id}
                  to={`/event/${event.event_id}?occurrenceId=${event.occurrence_id}`}
                  className="flex items-center gap-2 rounded-md bg-muted/50 hover:bg-muted p-2 transition-colors"
                >
                  <div className="w-10 h-10 aspect-square rounded-sm overflow-hidden bg-muted/40 shrink-0">
                    {event.poster_url ? (
                      <img src={event.poster_url} alt={event.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(new Date(event.instance_start), 'EEE d MMM, HH:mm')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No upcoming events at this venue yet</p>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

export default VenueEntity;
