import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Building2, Calendar, MapPin, Clock, Phone, Mail,
  Globe, Instagram, Car, Train, Users, Layers, Info, AlertCircle,
  Accessibility,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { VenueMediaHero } from '@/components/venue/VenueMediaHero';
import { CityCard } from '@/components/venue/CityCard';
import { FeaturePillsRow } from '@/components/venue/FeaturePillsRow';
import { buildVenueJsonLd } from '@/lib/buildVenueJsonLd';
import { VenueActionRow } from '@/components/venue/VenueActionRow';
import { OpeningStatusPill } from '@/components/venue/OpeningStatusPill';
import { computeVenueOpenStatus } from '@/lib/venueOpenStatus';
import { AboutSection } from '@/components/venue/sections/AboutSection';
import { RulesSection } from '@/components/venue/sections/RulesSection';
import { TheFloorSection } from '@/components/venue/sections/TheFloorSection';
import { GettingHereSection } from '@/components/venue/sections/GettingHereSection';
import { ParkingSection } from '@/components/venue/sections/ParkingSection';
import { OpeningHoursSection } from '@/components/venue/sections/OpeningHoursSection';
import { ContactSection } from '@/components/venue/sections/ContactSection';
import { AccessibilitySection } from '@/components/venue/sections/AccessibilitySection';
import { FaqSection } from '@/components/venue/sections/FaqSection';
import { VenueUpcomingTile } from '@/components/venue/VenueUpcomingTile';
import { useFacilityLookup } from '@/hooks/useFacilityOptions';

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

// Facility chips are now driven by public.facility_options (filtered to
// dancer_facing=true) via useFacilityLookup. Adding/retiring a facility =
// INSERT/UPDATE on that table, no code deploy. The strict trigger on
// venues.facilities_new ensures only canonical keys can be written, so
// nothing reaches this render path that isn't in the table.

// Parse `?from=event:<uuid>` -> uuid. Returns null when absent or malformed.
const parseFromEventParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('from');
  if (!raw) return null;
  const [kind, value] = raw.split(':');
  if (kind !== 'event' || !value) return null;
  // Loose UUID guard — defends against URL tampering / typos.
  return /^[0-9a-f-]{8,}$/i.test(value) ? value : null;
};

const VenueEntity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { lookup: facilityLookup } = useFacilityLookup({ dancerFacingOnly: true });

  // Warm-entry context: dancer arrived by clicking the venue card on an
  // event page. Filter the source event out of "events here" and surface a
  // thin breadcrumb back to that event.
  const fromEventId = parseFromEventParam(location.search);

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  // Source-event name for the warm-entry breadcrumb. Keep the query cheap —
  // single column, single row, only fires when fromEventId is present.
  const { data: sourceEvent } = useQuery({
    queryKey: ['venue-from-event-name', fromEventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('id, name')
        .eq('id', fromEventId!)
        .maybeSingle();
      return data as { id: string; name: string } | null;
    },
    enabled: !!fromEventId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id, fromEventId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const ninetyDaysLater = new Date(Date.now() + 90 * 86400000).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as never, {
        p_from: now,
        p_to: ninetyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      } as never);
      const rows = (data as VenueOccurrenceRow[] | null) ?? [];
      // Warm entry: hide the event the user just came from.
      const filtered = fromEventId ? rows.filter((r) => r.event_id !== fromEventId) : rows;
      return filtered.slice(0, 12);
    },
    enabled: !!id && !!venue,
  });

  // Breadcrumb adapts to entry context. Cold = "Venues". Warm = source event.
  // Last item has no path → renders as the current-page label (non-clickable),
  // so the prior link (Venues / source event) stays clickable.
const venueBreadcrumbs = buildBreadcrumbs('venue.detail', { entityName: venue?.name, isLoading });
  const backHref = fromEventId ? `/event/${fromEventId}` : '/venues';

  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={venueBreadcrumbs}
        backHref={backHref}
        hero={{
          emoji: '🏛️',
          titleWhite: '',
          titleOrange: 'Venue',
          largeTitle: true,
        }}
      >
        <div className="max-w-2xl mx-auto px-3 pb-20 space-y-3">
          <Skeleton className="aspect-video w-full rounded-xl" />
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
        backHref={backHref}
        hero={{
          emoji: '🏛️',
          titleWhite: 'Venue',
          titleOrange: 'not found',
          largeTitle: true,
        }}
      >
        <div className="max-w-2xl mx-auto px-3 pb-20 text-center">
          <p className="text-xs text-muted-foreground mb-4">This venue doesn't exist or has been removed.</p>
          <Button onClick={() => navigate(backHref)} variant="outline" size="sm">
            <ArrowLeft className="w-3 h-3 mr-1" />
            {fromEventId ? 'Back to event' : 'Back to Venues'}
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  const facilitiesRaw = parseStrArray(venue.facilities_new ?? venue.facilities);
  // Filter to facilities that exist in the dancer-facing lookup. The DB-side
  // strict trigger guarantees the array only contains canonical keys; this
  // filter drops the non-dancer-facing ones (e.g. sound_system, which still
  // lives in the data but never reaches the public page).
  const facilities = facilitiesRaw
    ? facilitiesRaw.filter((key) => facilityLookup.has(key))
    : null;
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
  const hasDetails =
    venue.capacity ||
    (facilities && facilities.length > 0) ||
    (floorType && floorType.length > 0) ||
    !!venue.accessibility;
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

  // Address subtitle removed from page-header 2026-04-30 (Ricky's call) —
  // address still surfaces below in the identity strip + Getting Here tile.
  return (
    <GlobalLayout
      breadcrumbs={venueBreadcrumbs}
      backHref={backHref}
      hero={{
        emoji: '🏛️',
        titleWhite: venue.name ?? '',
        titleOrange: 'Venue',
        largeTitle: true,
      }}
    >
      <div className="max-w-2xl mx-auto px-3 pb-20">
        {/* JSON-LD LocalBusiness schema — SEO master plan Phase 1.
            Emitted as inline <script> so crawlers and rich-result
            previews index the venue with correct hours + address. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildVenueJsonLd({
                name: venue.name,
                description: venue.description,
                image: allImages,
                address: venue.address,
                postcode: venue.postcode,
                city_name: venue.city_name,
                country: venue.country,
                telephone: venue.phone,
                url: typeof window !== 'undefined' ? window.location.href : '',
                opening_hours: openingHours as Parameters<typeof buildVenueJsonLd>[0]['opening_hours'],
              }),
            ),
          }}
        />

        {/* Open-now status banner — first thing in body (Ricky 2026-04-30).
            Big + colour-keyed by current opening hours. Pulse on the dot
            when open. */}
        {(() => {
          const openStatus = computeVenueOpenStatus(
            openingHours as Parameters<typeof computeVenueOpenStatus>[0],
            (venue as { timezone?: string | null }).timezone ?? null,
            new Date(),
          );
          if (openStatus.status === 'unknown') return null;
          return (
            <div className="mb-3 flex justify-center">
              <OpeningStatusPill status={openStatus} size="lg" />
            </div>
          );
        })()}

        {/* Address line + City button — plain text, no card wrapping. */}
        {(addressPillText || venue.city_name) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {addressPillText && (
              <a
                href={mapsUrl ?? undefined}
                target={mapsUrl ? '_blank' : undefined}
                rel={mapsUrl ? 'noopener noreferrer' : undefined}
                className="text-sm text-venue-cream underline decoration-venue-ember decoration-1 underline-offset-4 hover:decoration-2"
              >
                {addressPillText}
              </a>
            )}
            <CityCard
              cityId={(venue as { city_id?: string | null }).city_id ?? null}
              cityName={venue.city_name ?? null}
            />
          </div>
        )}

        {/* Media hero — video left, 2 thumbs right, Gallery button. */}
        <VenueMediaHero
          allImages={allImages}
          videoUrls={(venue as { video_urls?: string[] | null }).video_urls ?? null}
          venueName={venue.name}
        />

        {/* Feature pills — floor mini-row above the rest, then capacity +
            facilities + flags. The single source of truth for what the
            venue offers. */}
        <FeaturePillsRow
          facilities={facilities}
          floorType={floorType}
          capacity={venue.capacity}
          barAvailable={venue.bar_available}
          cloakroomAvailable={venue.cloakroom_available}
          idRequired={venue.id_required}
        />

        {/* Share button on its own row */}
        <div className="flex justify-end mb-3">
          <VenueActionRow venueName={venue.name ?? 'venue'} />
        </div>

        {/* Tight-mosaic section grid (Phase 3 — replaces vertical stack of bg-card boxes).
            Mobile (375px): grid-cols-2. sm: 3, md: 4, lg: 6. About + FAQ + (Rules
            when long) span 2 columns; everything else fits half-width on mobile.
            Each section is data-gated and renders nothing if empty — no fake
            content, no empty tiles. Decided 2026-04-30 (Ricky). */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3 auto-rows-min">
          <AboutSection description={venue.description} />
          <TheFloorSection floorType={floorType} facilities={facilities} />
          <GettingHereSection
            stations={transportJson?.nearest_stations ?? null}
            notes={transportJson?.notes ?? null}
          />
          <OpeningHoursSection hours={openingHours} />
          <ContactSection
            phone={venue.phone}
            email={venue.email}
            website={venue.website}
            instagram={venue.instagram}
          />
          <ParkingSection
            available={parkingJson?.parking_available ?? null}
            notes={parkingJson?.nearby_parking_notes ?? null}
          />
          <AccessibilitySection text={venue.accessibility} />
          <RulesSection rules={rules} />
          <FaqSection items={faqItems} />
        </div>

        {/* Upcoming events — moved to the BOTTOM of the page (Ricky 2026-04-30).
            Cream tile, mobile-2-col events grid. Scroll-target id preserved. */}
        <VenueUpcomingTile events={events} fromEventContext={!!fromEventId} />

      </div>
    </GlobalLayout>
  );
};

export default VenueEntity;
