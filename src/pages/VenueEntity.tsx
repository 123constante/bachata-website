import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalLayout from '@/components/layout/GlobalLayout';
import {
  useSeo,
  buildSeoForRoute,
  useEntitySlugOrId,
  useCanonicalReplaceState,
} from '@/lib/seo';
import {
  fetchPublicVenue,
  type PublicVenue,
} from '@/services/venuePublicService';
import { buildVenueJsonLd } from '@/lib/buildVenueJsonLd';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { splitLineNames } from '@/lib/tubeLineColour';

import VenueHeroMosaic from '@/components/venue/VenueHeroMosaic';
import VenueSectionTitle from '@/components/venue/VenueSectionTitle';
import VenueDirectionsCard from '@/components/venue/VenueDirectionsCard';
import VenueDirectionsSheet from '@/components/venue/VenueDirectionsSheet';
import VenueContactRow from '@/components/venue/VenueContactRow';
import VenueGoodToKnow from '@/components/venue/VenueGoodToKnow';
import VenueWhatsOnList, {
  type VenueWhatsOnEvent,
} from '@/components/venue/VenueWhatsOnList';
import VenueHoursTable, {
  type VenueHoursRow,
} from '@/components/venue/VenueHoursTable';
import VenueFaqAccordion, {
  type VenueFaqItem,
} from '@/components/venue/VenueFaqAccordion';
import VenueStickyBar from '@/components/venue/VenueStickyBar';
import { venueGoldInvertTheme } from '@/components/venue/venuePageTheme';

// ============================================================
// Types & helpers
// ============================================================
type TransportJson = {
  notes?: string | null;
  nearest_stations?:
    | {
        station?: string | null;
        line_names?: string[] | null;
        walking_distance_minutes?: number | null;
      }[]
    | null;
};

type ParkingJson = {
  parking_available?: boolean | null;
  nearby_parking_notes?: string | null;
};

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const DAY_FULL: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
const JS_DAY_TO_ORDER = [6, 0, 1, 2, 3, 4, 5];

const parseStrArray = (val: unknown): string[] | null => {
  if (!val) return null;
  if (Array.isArray(val))
    return (val as unknown[]).filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p)
        ? (p as unknown[]).filter(
            (v): v is string => typeof v === 'string' && v.length > 0,
          )
        : null;
    } catch {
      return [val];
    }
  }
  return null;
};

const parseFromEventParam = (search: string): string | null => {
  const raw = new URLSearchParams(search).get('from');
  if (!raw) return null;
  const [kind, value] = raw.split(':');
  if (kind !== 'event' || !value) return null;
  return /^[0-9a-f-]{8,}$/i.test(value) ? value : null;
};

const stripUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return (
      u.host.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname)
    );
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
};


// ============================================================
// Data extractors from PublicVenue
// ============================================================
function extractHoursRows(venue: PublicVenue): VenueHoursRow[] {
  const openingHours =
    venue.opening_hours &&
    typeof venue.opening_hours === 'object' &&
    !Array.isArray(venue.opening_hours)
      ? (venue.opening_hours as Record<string, unknown>)
      : null;
  if (!openingHours) return [];
  const todayKey = DAY_ORDER[JS_DAY_TO_ORDER[new Date().getDay()]];
  const rows: VenueHoursRow[] = [];
  for (let i = 0; i < 7; i++) {
    const dayKey = DAY_ORDER[i];
    let raw: unknown;
    for (const k of Object.keys(openingHours)) {
      if (k.toLowerCase() === dayKey) {
        raw = openingHours[k];
        break;
      }
    }
    if (raw == null) continue;
    let display = '';
    if (typeof raw === 'string') {
      display = raw;
    } else if (typeof raw === 'object') {
      const h = raw as { open?: string; close?: string; isOpen?: boolean };
      if (h.isOpen === false) display = 'Closed';
      else if (h.open && h.close) display = `${h.open} - ${h.close}`;
    }
    if (display)
      rows.push({
        day: DAY_FULL[dayKey],
        display,
        isToday: dayKey === todayKey,
      });
  }
  return rows;
}

function extractNearestStation(venue: PublicVenue): {
  station: string | null;
  lines: string[];
  walkMinutes: number | null;
} {
  const tj =
    venue.transport_json &&
    typeof venue.transport_json === 'object' &&
    !Array.isArray(venue.transport_json)
      ? (venue.transport_json as TransportJson)
      : null;
  const station = tj?.nearest_stations?.[0] ?? null;
  return {
    station: station?.station ?? null,
    lines: Array.isArray(station?.line_names)
      ? station!.line_names!
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
          .flatMap(splitLineNames)
      : [],
    walkMinutes:
      typeof station?.walking_distance_minutes === 'number'
        ? station.walking_distance_minutes
        : null,
  };
}

function extractParkingNote(venue: PublicVenue): string | null {
  const tjParking =
    venue.parking_json &&
    typeof venue.parking_json === 'object' &&
    !Array.isArray(venue.parking_json)
      ? (venue.parking_json as ParkingJson)
      : null;
  const parts: string[] = [];
  if (tjParking?.nearby_parking_notes)
    parts.push(tjParking.nearby_parking_notes.trim());
  if (venue.parking_cost_notes) parts.push(venue.parking_cost_notes.trim());
  if (parts.length === 0 && venue.parking && venue.parking.trim())
    parts.push(venue.parking.trim());
  return parts.length > 0 ? parts.join(' ') : null;
}

function extractFaq(venue: PublicVenue): VenueFaqItem[] {
  if (!Array.isArray(venue.faq_json)) return [];
  return venue.faq_json
    .filter(
      (r): r is { q?: string; a?: string; question?: string; answer?: string } =>
        r != null && typeof r === 'object',
    )
    .map((r) => ({
      q: (r.q ?? r.question ?? '').trim(),
      a: (r.a ?? r.answer ?? '').trim(),
    }))
    .filter((r) => r.q && r.a);
}

function extractPhotos(venue: PublicVenue): string[] {
  const raw = [
    ...(Array.isArray(venue.image_url) ? venue.image_url : []),
    ...(parseStrArray(venue.gallery_urls) ?? []),
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);
  return Array.from(new Set(raw));
}


// ============================================================
// Inline lightbox - fullscreen photo viewer
// ============================================================
interface VenueLightboxProps {
  photos: string[];
  index: number | null;
  onClose: () => void;
  onStep: (delta: number) => void;
}

function VenueLightbox({ photos, index, onClose, onStep }: VenueLightboxProps) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onStep(-1);
      else if (e.key === 'ArrowRight') onStep(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose, onStep]);

  if (index === null || photos.length === 0) return null;
  const src = photos[index];
  return createPortal((
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'rgba(8,9,12,0.97)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div className="flex items-center justify-between p-4 pt-12 md:pt-6">
        <span className="text-sm font-bold text-white">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
        >
          <XIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
      <div
        className="relative mx-3 flex-1 overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={`Photo ${index + 1}`}
          className="h-full w-full object-contain"
        />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Previous photo"
              className="absolute left-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur"
            >
              <ChevronLeft className="h-[22px] w-[22px]" />
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Next photo"
              className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur"
            >
              <ChevronRight className="h-[22px] w-[22px]" />
            </button>
          </>
        ) : null}
      </div>
      <div className="flex justify-center gap-2 py-5">
        {photos.map((_, i) => (
          <span
            key={i}
            className="h-[7px] rounded-full transition-all"
            style={{
              width: i === index ? 20 : 7,
              background: i === index ? '#F2A93B' : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>
    </div>
  ), document.body);
}

// ============================================================
// Font injection (page-scoped)
// ============================================================
const FONT_LINK_ID = 'venue-page-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Manrope:wght@400..800&display=swap';

function useVenuePageFonts() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    return () => {
      document.getElementById(FONT_LINK_ID)?.remove();
    };
  }, []);
}


// ============================================================
// Page
// ============================================================
const VenueEntity = () => {
  useVenuePageFonts();
  const { id: rawId } = useParams<{ id: string }>();
  const location = useLocation();
  const resolved = useEntitySlugOrId(rawId, 'venues');
  const id = resolved.id ?? undefined;

  const fromEventId = parseFromEventParam(location.search);
  const fromOccurrenceId =
    new URLSearchParams(location.search).get('occ') ?? null;

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => '/venue-entity/' + s,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id, fromEventId, fromOccurrenceId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const sixtyDaysLater = new Date(
        Date.now() + 60 * 86400000,
      ).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as never, {
        p_from: now,
        p_to: sixtyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      } as never);
      const rows = (data as VenueWhatsOnEvent[] | null) ?? [];
      const filtered = fromOccurrenceId
        ? rows.filter((r) => r.occurrence_id !== fromOccurrenceId)
        : fromEventId
        ? rows.filter((r) => r.event_id !== fromEventId)
        : rows;
      return filtered.slice(0, 12);
    },
    enabled: !!id && !!venue,
  });

  useSeo(
    buildSeoForRoute('venue.detail', {
      entityName: venue?.name,
      entitySlug: resolved.slug ?? id ?? undefined,
      cityDisplay: venue?.city_name ?? undefined,
      ogImage: Array.isArray(venue?.image_url)
        ? venue?.image_url[0]
        : (venue?.image_url ?? undefined),
      isLoading,
    }),
  );

  const backHref = fromEventId ? '/event/' + fromEventId : '/venues';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Page-level vars
  const photos = useMemo(
    () => (venue ? extractPhotos(venue) : []),
    [venue],
  );
  const hoursRows = useMemo(
    () => (venue ? extractHoursRows(venue) : []),
    [venue],
  );
  const transport = useMemo(
    () =>
      venue
        ? extractNearestStation(venue)
        : { station: null, lines: [] as string[], walkMinutes: null },
    [venue],
  );
  const parkingNote = useMemo(
    () => (venue ? extractParkingNote(venue) : null),
    [venue],
  );
  const faqItems = useMemo(
    () => (venue ? extractFaq(venue) : []),
    [venue],
  );

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------
  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={buildBreadcrumbs('venue.detail', { isLoading: true })}
        backHref={backHref}
        showGradientBg={false}
      >
        <div
          className="min-h-screen px-4 pt-4"
          style={{ background: '#0E0F13', color: '#fff' }}
        >
          <Skeleton className="h-8 w-2/3 bg-white/10" />
          <Skeleton className="mt-4 h-[240px] w-full bg-white/10" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-1/3 bg-white/10" />
            <Skeleton className="h-4 w-1/2 bg-white/10" />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // ----------------------------------------------------------
  // Not found
  // ----------------------------------------------------------
  if (!venue) {
    return (
      <GlobalLayout
        breadcrumbs={buildBreadcrumbs('venue.detail', { entityName: 'Venue' })}
        backHref="/venues"
        showGradientBg={false}
      >
        <div
          className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center"
          style={{ background: '#0E0F13', color: '#fff' }}
        >
          <h1 className="text-2xl font-bold">Venue not found</h1>
          <p className="mt-2 text-white/60">
            We could not find this venue. It may have been removed or the link
            is no longer valid.
          </p>
        </div>
      </GlobalLayout>
    );
  }


  // Single display address: street + city + postcode joined with commas.
  const addressDisplay = [venue.address, venue.city_name, venue.postcode]
    .filter(Boolean)
    .join(', ');

  const addressLine = [venue.address, venue.postcode].filter(Boolean).join(', ');
  const fullAddress = [venue.address, venue.postcode, venue.country]
    .filter(Boolean)
    .join(', ');
  const shortAddress = addressLine;


  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy address');
    }
  };

  const stepLightbox = (delta: number) => {
    if (photos.length === 0) return;
    setLightboxIndex((i) =>
      i === null
        ? 0
        : (i + delta + photos.length) % photos.length,
    );
  };

  const jsonLd = buildVenueJsonLd({
    name: venue.name,
    description: venue.description ?? null,
    image: photos.length > 0 ? photos : null,
    address: venue.address ?? null,
    postcode: venue.postcode ?? null,
    city_name: venue.city_name ?? null,
    country: venue.country ?? null,
    telephone: venue.phone ?? null,
    url: typeof window !== "undefined" ? window.location.href : "",
    opening_hours: (venue.opening_hours ?? null) as Parameters<
      typeof buildVenueJsonLd
    >[0]["opening_hours"],
  });

  const websiteLabel = venue.website ? stripUrl(venue.website) : null;
  const phoneLabel = venue.phone;

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('venue.detail', {
        entityName: venue.name,
      })}
      backHref={backHref}
      showGradientBg={false}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        className="min-h-screen pb-32 md:pb-16"
        style={{
          ...(venueGoldInvertTheme as React.CSSProperties),
          background: '#0E0F13',
          fontFamily: 'var(--va-body)',
        }}
      >
        <div className="va-bento mx-auto w-full px-3 pt-3 sm:px-5 md:px-8 md:pt-5 lg:px-12 xl:px-16">
          <section className="va-bento-hero">
            <VenueHeroMosaic
              name={venue.name}
              photos={photos}
              onPhoto={(idx) =>
                setLightboxIndex(Math.min(idx, Math.max(0, photos.length - 1)))
              }
            />
          </section>

          <section className="va-bento-directions">
            <VenueSectionTitle>Find the venue</VenueSectionTitle>
            <VenueDirectionsCard
              addressLine={addressDisplay}
              nearestStation={transport.station}
              nearestLines={transport.lines}
              walkMinutes={transport.walkMinutes}
              onDirections={() => setSheetOpen(true)}
              onCopy={copyAddress}
            />
            {venue.phone || venue.website ? (
              <div className="mt-3">
                <VenueContactRow
                  phone={venue.phone}
                  phoneLabel={phoneLabel}
                  website={venue.website}
                  websiteLabel={websiteLabel}
                />
              </div>
            ) : null}
          </section>

          {(venue.bar_available != null ||
            venue.cloakroom_available != null ||
            venue.id_required != null ||
            venue.water_situation ||
            venue.food_situation ||
            parkingNote ||
            venue.late_night_notes) ? (
            <section className="va-bento-gtk">
              <VenueSectionTitle>Good to know</VenueSectionTitle>
              <VenueGoodToKnow
                barAvailable={venue.bar_available}
                cloakroomAvailable={venue.cloakroom_available}
                idRequired={venue.id_required}
                waterNote={venue.water_situation ?? null}
                foodNote={venue.food_situation ?? null}
                parkingNote={parkingNote}
                gettingHomeNote={venue.late_night_notes ?? null}
              />
            </section>
          ) : null}

          {events && events.length > 0 ? (
            <section className="va-bento-whatson">
              <VenueSectionTitle>What&rsquo;s on here</VenueSectionTitle>
              <VenueWhatsOnList
                events={events}
                venueName={venue.name}
                onSeeAll={() => toast.message('Showing all events at this venue')}
              />
            </section>
          ) : null}

          {hoursRows.length > 0 ? (
            <section className="va-bento-hours">
              <VenueSectionTitle>Opening hours</VenueSectionTitle>
              <VenueHoursTable rows={hoursRows} />
            </section>
          ) : null}

          {faqItems.length > 0 ? (
            <section className="va-bento-faq">
              <VenueSectionTitle>FAQ</VenueSectionTitle>
              <VenueFaqAccordion items={faqItems} />
            </section>
          ) : null}
        </div>
        <style>{`
          .va-bento {
            display: grid;
            gap: 24px;
            grid-template-columns: 1fr;
          }
          @media (min-width: 640px) {
            .va-bento {
              grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
            }
          }
          @media (min-width: 1280px) {
            .va-bento {
              grid-template-columns: repeat(12, minmax(0, 1fr));
              gap: 20px;
            }
            .va-bento-hero       { grid-column: 1 / span 8; }
            .va-bento-directions { grid-column: 9 / span 4; }
            .va-bento-gtk        { grid-column: 1 / span 5; }
            .va-bento-whatson    { grid-column: 6 / span 7; }
            .va-bento-hours      { grid-column: 1 / span 6; }
            .va-bento-faq        { grid-column: 7 / span 6; }
          }
        `}</style>
      </div>

      <VenueStickyBar
        phone={venue.phone}
        onDirections={() => setSheetOpen(true)}
      />

      <VenueDirectionsSheet
        open={sheetOpen}
        venueName={venue.name}
        shortAddress={shortAddress || venue.name}
        fullAddress={fullAddress || venue.name}
        onClose={() => setSheetOpen(false)}
        onCopy={copyAddress}
      />

      <VenueLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onStep={stepLightbox}
      />
    </GlobalLayout>
  );
};

export default VenueEntity;
