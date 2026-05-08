import { Fragment, useState, type CSSProperties } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInCalendarDays } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { fetchPublicVenue } from '@/services/venuePublicService';
import { buildVenueJsonLd } from '@/lib/buildVenueJsonLd';
import { computeVenueOpenStatus } from '@/lib/venueOpenStatus';

type VenueOccurrenceRow = {
  event_id: string;
  name: string;
  instance_start: string;
  occurrence_id: string;
  poster_url: string | null;
  type: string | null;
};

type TransportJson = {
  notes?: string | null;
  nearest_stations?: {
    station?: string | null;
    line_names?: string[] | null;
    walking_distance_minutes?: number | null;
  }[] | null;
};

type ParkingJson = {
  parking_available?: boolean | null;
  nearby_parking_notes?: string | null;
};

const FACILITY_MAP: Record<string, { emoji: string; label: string }> = {
  mirrors: { emoji: '\u{1FA9E}', label: 'Mirrors' },
  sound_system: { emoji: '\u{1F50A}', label: 'Sound system' },
  changing_area: { emoji: '\u{1F6BF}', label: 'Changing area' },
  wifi: { emoji: '\u{1F4F6}', label: 'Wi-Fi' },
  wheelchair_access: { emoji: '♿', label: 'Wheelchair access' },
  air_conditioning: { emoji: '❄️', label: 'Air con' },
  drinking_water: { emoji: '\u{1F4A7}', label: 'Drinking water' },
  bottle_refill: { emoji: '\u{1FAD7}', label: 'Bottle refill' },
  lockers: { emoji: '\u{1F512}', label: 'Lockers' },
  kitchen: { emoji: '\u{1F373}', label: 'Kitchen' },
  snacks_available: { emoji: '\u{1F36B}', label: 'Snacks' },
  free_parking: { emoji: '\u{1F17F}️', label: 'Free parking' },
  late_train_friendly: { emoji: '\u{1F686}', label: 'Late train' },
  stage: { emoji: '\u{1F3AD}', label: 'Stage' },
  outdoor_space: { emoji: '\u{1F333}', label: 'Outdoor space' },
};

const LINE_COLOURS: Record<string, { bg: string; textBlack?: boolean }> = {
  Northern: { bg: '#000099' },
  Victoria: { bg: '#e1251b' },
  Central: { bg: '#dc241f' },
  Circle: { bg: '#f3a712', textBlack: true },
  District: { bg: '#007229' },
  Jubilee: { bg: '#868f98' },
  Piccadilly: { bg: '#0019a8' },
  Bakerloo: { bg: '#894e24' },
  Metropolitan: { bg: '#750042' },
  Overground: { bg: '#e86a10' },
  Elizabeth: { bg: '#6950a1' },
  DLR: { bg: '#009b77' },
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_ABBR: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};
// JS getDay(): 0=Sun ... 6=Sat. Map to DAY_ORDER index (0=Mon ... 6=Sun).
const JS_DAY_TO_ORDER = [6, 0, 1, 2, 3, 4, 5];

const parseStrArray = (val: unknown): string[] | null => {
  if (!val) return null;
  if (Array.isArray(val))
    return (val as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p)
        ? (p as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
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

const countdown = (isoStart: string): string => {
  const diff = differenceInCalendarDays(new Date(isoStart), new Date());
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  return 'in ' + diff + ' days';
};

const LABEL: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#f97316',
  textAlign: 'center',
  margin: '0 0 8px',
};

const DARK_CARD: CSSProperties = {
  background: '#111',
  border: '1px solid #1e1e1e',
  borderRadius: 8,
  padding: 12,
};

const VenueEntity = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const fromEventId = parseFromEventParam(location.search);

  const { data: venue, isLoading } = useQuery({
    queryKey: ['public-venue', id],
    queryFn: () => fetchPublicVenue(id!),
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['venue-upcoming-events', id, fromEventId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const sixtyDaysLater = new Date(Date.now() + 60 * 86400000).toISOString();
      const { data } = await supabase.rpc('calendar_events_dto' as never, {
        p_from: now,
        p_to: sixtyDaysLater,
        p_city_id: null,
        p_venue_id: id,
      } as never);
      const rows = (data as VenueOccurrenceRow[] | null) ?? [];
      const filtered = fromEventId ? rows.filter((r) => r.event_id !== fromEventId) : rows;
      return filtered.slice(0, 9);
    },
    enabled: !!id && !!venue,
  });

  const [showAll, setShowAll] = useState(false);

  const venueBreadcrumbs = buildBreadcrumbs('venue.detail', { entityName: venue?.name, isLoading });
  const backHref = fromEventId ? '/event/' + fromEventId : '/venues';

  if (isLoading) {
    return (
      <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showGradientBg={false}>
        <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', padding: 12 }}>
          <Skeleton className="w-full h-[180px] rounded-none bg-[#1e1e1e]" />
          <div style={{ padding: '12px 0' }}>
            <Skeleton className="h-4 w-1/2 mb-2 bg-[#1e1e1e]" />
            <Skeleton className="h-16 w-full bg-[#1e1e1e]" />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (!venue) {
    return (
      <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showGradientBg={false}>
        <div style={{
          backgroundColor: '#0a0a0a', minHeight: '100vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 24,
        }}>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
            This venue doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate(backHref)} variant="outline" size="sm">
            <ArrowLeft className="w-3 h-3 mr-1" />
            {fromEventId ? 'Back to event' : 'Back to Venues'}
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  // --- Data parsing ---
  const facilitiesRaw = parseStrArray(venue.facilities_new ?? venue.facilities);
  const transportJson: TransportJson | null =
    venue.transport_json && typeof venue.transport_json === 'object' && !Array.isArray(venue.transport_json)
      ? (venue.transport_json as TransportJson)
      : null;
  const parkingJson: ParkingJson | null =
    venue.parking_json && typeof venue.parking_json === 'object' && !Array.isArray(venue.parking_json)
      ? (venue.parking_json as ParkingJson)
      : null;
  const openingHours =
    venue.opening_hours && typeof venue.opening_hours === 'object' && !Array.isArray(venue.opening_hours)
      ? (venue.opening_hours as Record<string, unknown>)
      : null;

  const addressLine = [venue.address, venue.postcode].filter(Boolean).join(', ');
  const mapsUrl =
    venue.google_maps_href ||
    venue.google_maps_link ||
    venue.google_maps_url ||
    (addressLine
      ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(
          [venue.name, addressLine, venue.city_name].filter(Boolean).join(', '),
        )
      : null);

  const heroImage =
    Array.isArray(venue.image_url) && venue.image_url.length > 0 ? venue.image_url[0] : null;
  const galleryUrls = parseStrArray(venue.gallery_urls);
  const allImages = [heroImage, ...(galleryUrls ?? [])].filter((u): u is string => Boolean(u));

  const openStatus = computeVenueOpenStatus(
    openingHours as Parameters<typeof computeVenueOpenStatus>[0],
    venue.timezone ?? null,
    new Date(),
  );
  const isVenueOpen = openStatus.status === 'open' || openStatus.status === 'closing-soon';
  const statusText = (() => {
    if (openStatus.status === 'open' || openStatus.status === 'closing-soon')
      return 'Open · until ' + openStatus.closesAt;
    if (openStatus.status === 'opens-soon') return 'Closed · opens ' + openStatus.opensAt;
    if (openStatus.status === 'closed') {
      if (openStatus.opensAt && openStatus.opensDayLabel && openStatus.opensDayLabel !== 'today')
        return 'Closed · opens ' + openStatus.opensDayLabel;
      if (openStatus.opensAt) return 'Closed · opens ' + openStatus.opensAt;
      return 'Closed';
    }
    return null;
  })();

  // Amenity pills: facilities_new entries matching FACILITY_MAP, plus bar + cloakroom flags.
  const facilityPills: { key: string; emoji: string; label: string }[] = [];
  if (facilitiesRaw) {
    for (const key of facilitiesRaw) {
      if (FACILITY_MAP[key]) facilityPills.push({ key, ...FACILITY_MAP[key] });
    }
  }
  if (venue.bar_available) facilityPills.push({ key: 'bar', emoji: '\u{1F379}', label: 'Bar' });
  if (venue.cloakroom_available) facilityPills.push({ key: 'cloakroom', emoji: '\u{1F9E5}', label: 'Cloakroom' });

  const station = transportJson?.nearest_stations?.[0] ?? null;
  const hasTransport = !!station || !!transportJson?.notes;

  // Opening hours rows, starting from today and wrapping through 7 days.
  const todayDayIdx = JS_DAY_TO_ORDER[new Date().getDay()];
  const hoursRows: { day: string; display: string; isToday: boolean }[] = [];
  if (openingHours) {
    for (let i = 0; i < 7; i++) {
      const dayIdx = (todayDayIdx + i) % 7;
      const dayKey = DAY_ORDER[dayIdx];
      let raw: unknown;
      for (const k of Object.keys(openingHours)) {
        if (k.toLowerCase() === dayKey) {
          raw = (openingHours as Record<string, unknown>)[k];
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
        else if (h.open && h.close) display = h.open + '–' + h.close;
      }
      if (display) hoursRows.push({ day: DAY_ABBR[dayKey], display, isToday: i === 0 });
    }
  }

  const parkingBullets: string[] = [];
  if (parkingJson?.nearby_parking_notes) {
    parkingBullets.push(
      ...parkingJson.nearby_parking_notes.split('. ').map((s) => s.trim()).filter(Boolean),
    );
  }
  if (venue.parking_cost_notes) {
    parkingBullets.push(
      ...venue.parking_cost_notes.split('. ').map((s) => s.trim()).filter(Boolean),
    );
  }

  const hasHours = hoursRows.length > 0;
  const hasParking =
    (parkingJson?.parking_available !== null && parkingJson?.parking_available !== undefined) ||
    parkingBullets.length > 0;
  const eventList = Array.isArray(events) ? events : [];
  const visibleEvents = showAll ? eventList : eventList.slice(0, 3);
  const hasMore = eventList.length > 3;

  return (
    <GlobalLayout breadcrumbs={venueBreadcrumbs} backHref={backHref} showGradientBg={false}>
      <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
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

        {/* Section 1: Hero */}
        <div style={{ position: 'relative', height: 180, overflow: 'hidden', backgroundColor: '#111' }}>
          {heroImage && (
            <img
              src={heroImage}
              alt={venue.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
            />
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
            background: 'linear-gradient(to top, #0a0a0a, transparent)',
          }} />
          <div style={{ position: 'absolute', bottom: 12, left: 12 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f97316', margin: 0 }}>
              VENUE
            </p>
            <p style={{ fontSize: 17, fontWeight: 500, color: 'white', margin: 0 }}>
              {venue.name}
            </p>
          </div>
        </div>

        {/* Section 2: Status strip */}
        <div style={{ textAlign: 'center', padding: '12px 16px 4px' }}>
          {statusText && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              borderRadius: 999, padding: '4px 12px', border: '1px solid',
              ...(isVenueOpen
                ? { background: '#0f2e1a', color: '#4ade80', borderColor: '#166534' }
                : { background: '#2e0f0f', color: '#f87171', borderColor: '#991b1b' }),
            }}>
              <span style={{ fontSize: 12 }}>{statusText}</span>
            </div>
          )}
          {mapsUrl && addressLine && (
            <div style={{ marginTop: 6 }}>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12, color: '#888', textDecoration: 'underline',
                  textDecorationColor: '#444', textUnderlineOffset: 2,
                }}
              >
                {addressLine}
              </a>
            </div>
          )}
        </div>

        {/* Section 3: About */}
        <div style={{ padding: '16px 12px 0' }}>
          <p style={LABEL}>About</p>
          {facilityPills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
              {facilityPills.map((p) => (
                <span
                  key={p.key}
                  style={{
                    background: '#1c1008', border: '1px solid #7c2d12',
                    borderRadius: 999, padding: '4px 10px', color: '#fb923c', fontSize: 11,
                  }}
                >
                  {p.emoji} {p.label}
                </span>
              ))}
            </div>
          )}
          {venue.description && (
            <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, marginTop: 8 }}>
              {venue.description}
            </p>
          )}
        </div>

        {/* Section 4: Info grid */}
        <div style={{ padding: '16px 12px 0' }}>
          {/* Getting There -- full width */}
          {hasTransport && (
            <div style={{ ...DARK_CARD, marginBottom: 10 }}>
              <p style={LABEL}>Getting there</p>
              {station && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {/* TfL Roundel */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    border: '4px solid #e1251b', position: 'relative',
                    flexShrink: 0, overflow: 'hidden', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      top: '50%', transform: 'translateY(-50%)', height: 9,
                      background: station.line_names?.[0] && LINE_COLOURS[station.line_names[0]]
                        ? LINE_COLOURS[station.line_names[0]].bg
                        : '#e1251b',
                    }} />
                    <span style={{
                      position: 'relative', fontSize: 7, fontWeight: 700,
                      color: '#fff', letterSpacing: '0.02em',
                      textShadow: '0 0 2px rgba(0,0,0,0.8)',
                    }}>
                      {(station.line_names ?? []).some(
                        (l) => l === 'Overground' || l === 'Elizabeth',
                      ) ? 'LO' : 'LU'}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#f1f1f1', margin: '0 0 4px' }}>
                      {station.station}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      {(station.line_names ?? []).map((line) => {
                        const col = LINE_COLOURS[line];
                        return (
                          <span
                            key={line}
                            style={{
                              background: col?.bg ?? '#333', borderRadius: 3,
                              padding: '2px 6px', fontSize: 10,
                              color: col?.textBlack ? '#000' : '#fff', fontWeight: 500,
                            }}
                          >
                            {line}
                          </span>
                        );
                      })}
                    </div>
                    {station.walking_distance_minutes != null && (
                      <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                        {station.walking_distance_minutes} min walk
                      </p>
                    )}
                  </div>
                </div>
              )}
              {transportJson?.notes && (
                <p style={{ fontSize: 11, color: '#888', marginTop: station ? 8 : 0 }}>
                  {transportJson.notes}
                </p>
              )}
            </div>
          )}

          {/* 2-col grid: Opening Hours + Parking */}
          {(hasHours || hasParking) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {hasHours && (
                <div style={DARK_CARD}>
                  <p style={LABEL}>Opening hours</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', rowGap: 3 }}>
                    {hoursRows.map((r) => (
                      <Fragment key={r.day}>
                        <span style={{
                          fontSize: 11,
                          color: r.isToday ? '#f97316' : '#555',
                          fontWeight: r.isToday ? 500 : 400,
                        }}>
                          {r.day}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: r.isToday ? '#f97316' : r.display === 'Closed' ? '#555' : '#aaa',
                          fontWeight: r.isToday ? 500 : 400,
                        }}>
                          {r.display}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}
              {hasParking && (
                <div style={DARK_CARD}>
                  <p style={LABEL}>Parking</p>
                  {parkingBullets.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                      {parkingBullets.map((b, i) => (
                        <li
                          key={i}
                          style={{ display: 'flex', gap: 5, fontSize: 11, color: '#aaa', lineHeight: 1.5, marginBottom: 3 }}
                        >
                          <span style={{ color: '#f97316', flexShrink: 0 }}>{'•'}</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                      {parkingJson?.parking_available ? 'Parking available nearby.' : 'No parking nearby.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Upcoming events */}
        <div style={{ padding: '16px 12px 20px' }}>
          <p style={LABEL}>Upcoming events here</p>
          {eventList.length === 0 ? (
            <p style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              No upcoming events — check back soon
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }}>
                {visibleEvents.map((ev) => (
                  <Link
                    key={ev.occurrence_id}
                    to={'/event/' + ev.event_id + '?occurrenceId=' + ev.occurrence_id}
                    style={{
                      width: 'calc(33.33% - 4px)', background: '#141414',
                      border: '1px solid #222', borderRadius: 8, overflow: 'hidden',
                      display: 'block', textDecoration: 'none',
                    }}
                  >
                    <div style={{ position: 'relative', height: 50, background: '#1e1e3a' }}>
                      {ev.poster_url && (
                        <img
                          src={ev.poster_url}
                          alt={ev.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                      <span style={{
                        position: 'absolute', top: 3, left: 3,
                        background: '#ea580c', color: 'white', fontSize: 8,
                        textTransform: 'uppercase', borderRadius: 3, padding: '1px 4px',
                      }}>
                        {ev.type ?? 'EVENT'}
                      </span>
                    </div>
                    <div style={{ padding: '5px 6px' }}>
                      <p style={{
                        fontSize: 10, fontWeight: 500, color: '#f1f1f1', margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      } as CSSProperties}>
                        {ev.name}
                      </p>
                      <p style={{ fontSize: 9, color: '#888', margin: '2px 0 0' }}>
                        {format(new Date(ev.instance_start), 'EEE d MMM')}
                      </p>
                      <p style={{ fontSize: 9, color: '#a78bfa', fontWeight: 500, margin: '1px 0 0' }}>
                        {countdown(ev.instance_start)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              {hasMore && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  style={{
                    width: '100%', background: '#141414', border: '1px solid #333',
                    borderRadius: 8, padding: 10, fontSize: 12, color: '#f97316',
                    marginTop: 8, cursor: 'pointer',
                  }}
                >
                  Show more events
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
};

export default VenueEntity;
