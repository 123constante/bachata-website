import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCity } from '@/contexts/CityContext';
import { resolveEventImage } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversineKm } from '@/lib/geo/haversineKm';
import NearMeCta from '@/components/tonight/NearMeCta';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';

type TonightEvent = {
  id: string;
  name: string;
  location: string;
  occurrenceStartsAt: string | null;
  occurrenceEndsAt: string | null;
  image: string;
  hasClass: boolean;
  hasParty: boolean;
  classStart: string | null;
  classEnd: string | null;
  partyStart: string | null;
  partyEnd: string | null;
  venueLat: number | null;
  venueLng: number | null;
  primaryOrganiserName: string | null;
  type: string;
};

const formatHHmm = (value?: string | null) => {
  if (!value) return null;
  const sep = value.indexOf('T') !== -1 ? value.indexOf('T') : value.indexOf(' ');
  const timePart = sep !== -1 && sep > 4 ? value.substring(sep + 1) : value;
  return timePart.substring(0, 5);
};

type CountdownState = { label: string; tone: 'soon' | 'live' } | null;

const computeCountdown = (
  startsAt: string | null,
  endsAt: string | null,
  now: Date,
): CountdownState => {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = endsAt ? new Date(endsAt) : null;
  const nowMs = now.getTime();
  if (nowMs < start.getTime()) {
    const diffMin = Math.max(0, Math.round((start.getTime() - nowMs) / 60000));
    if (diffMin < 1) return { label: 'Starts in <1min', tone: 'soon' };
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    const label =
      hours > 0
        ? `Starts in ${hours}hr ${mins}min`
        : `Starts in ${mins}min`;
    return { label, tone: 'soon' };
  }
  if (end && nowMs < end.getTime()) {
    return { label: 'On now', tone: 'live' };
  }
  return null;
};

const Tonight = () => {
  useSeo(buildSeoForRoute('tonight'));
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const {
    status: locStatus,
    reason: locReason,
    coords,
    request,
    clear,
  } = useGeolocation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: rawEvents = [] } = useQuery({
    queryKey: ['tonight-events', citySlug],
    queryFn: async (): Promise<TonightEvent[]> => {
      if (!citySlug) return [];

      // Half-open [start, end) range: get_calendar_events' day filter is exclusive
      // on the upper bound, and re-projects both bounds into the city timezone
      // before taking ::date. An inclusive 23:59:59.999 same-day end collapses
      // to the same local date as start once re-projected, producing an empty
      // window.
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(0, 0, 0, 0);

      const { data, error } = await supabase.rpc('get_calendar_events_v2' as any, {
        range_start: startDate.toISOString(),
        range_end: endDate.toISOString(),
        city_slug_param: citySlug,
      });

      if (error || !data) return [];

      return (data as any[]).map((event) => {
        const keyTimes = event.key_times as any;
        const classData = keyTimes?.classes;
        const partyData = keyTimes?.party;

        // Fallback: derive class/party times from meta_data.program when key_times is absent.
        // Program items have type "class"|"party" and ISO start_time/end_time strings.
        type ProgramItem = { type: string; start_time?: string; end_time?: string };
        const program: ProgramItem[] = Array.isArray(event.meta_data?.program)
          ? event.meta_data.program
          : [];
        const classItems = program.filter(p => p.type === 'class' && p.start_time && p.end_time);
        const partyItems = program.filter(p => p.type === 'party' && p.start_time && p.end_time);

        const minStr = (items: ProgramItem[], key: 'start_time' | 'end_time') =>
          items.length ? items.reduce((m, p) => (p[key]! < m ? p[key]! : m), items[0][key]!) : null;
        const maxStr = (items: ProgramItem[], key: 'start_time' | 'end_time') =>
          items.length ? items.reduce((m, p) => (p[key]! > m ? p[key]! : m), items[0][key]!) : null;

        return {
          id: String(event.event_id),
          // ADR-007 Phase 4.2c — deep-link cards to the specific date so
          // the public page shows that date's per-occurrence program.
          occurrenceId: (event.occurrence_id as string | null) ?? null,
          name: event.name as string,
          location: (event.location as string) || 'Location TBD',
          occurrenceStartsAt: (event.occurrence_starts_at as string | null) ?? null,
          occurrenceEndsAt: (event.occurrence_ends_at as string | null) ?? null,
          image:
            resolveEventImage(event.photo_url, null) ||
            'https://images.unsplash.com/photo-1546707012-c46675f12716',
          hasClass: Boolean(classData) || classItems.length > 0,
          hasParty: Boolean(partyData) || partyItems.length > 0,
          classStart: classData ? formatHHmm(classData.start) : formatHHmm(minStr(classItems, 'start_time')),
          classEnd:   classData ? formatHHmm(classData.end)   : formatHHmm(maxStr(classItems, 'end_time')),
          partyStart: partyData ? formatHHmm(partyData.start) : formatHHmm(minStr(partyItems, 'start_time')),
          partyEnd:   partyData ? formatHHmm(partyData.end)   : formatHHmm(maxStr(partyItems, 'end_time')),
          venueLat: typeof event.venue_lat === 'number' ? event.venue_lat : null,
          venueLng: typeof event.venue_lng === 'number' ? event.venue_lng : null,
          primaryOrganiserName: (event.primary_organiser_name as string | null) ?? null,
          type: (event.type as string | null) ?? '',
        };
      });
    },
    enabled: !!citySlug,
  });

  const events = useMemo(() => {
    if (!coords) {
      return [...rawEvents].sort((a, b) => {
        const ta = a.occurrenceStartsAt ? new Date(a.occurrenceStartsAt).getTime() : Infinity;
        const tb = b.occurrenceStartsAt ? new Date(b.occurrenceStartsAt).getTime() : Infinity;
        return ta - tb;
      });
    }
    const withDistance = rawEvents.map((e) => ({
      ev: e,
      km:
        e.venueLat != null && e.venueLng != null
          ? haversineKm(coords.lat, coords.lng, e.venueLat, e.venueLng)
          : null,
    }));
    withDistance.sort((a, b) => {
      if (a.km == null && b.km == null) {
        const ta = a.ev.occurrenceStartsAt ? new Date(a.ev.occurrenceStartsAt).getTime() : Infinity;
        const tb = b.ev.occurrenceStartsAt ? new Date(b.ev.occurrenceStartsAt).getTime() : Infinity;
        return ta - tb;
      }
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return withDistance.map((x) => x.ev);
  }, [rawEvents, coords]);

  const distanceByEventId = useMemo(() => {
    const map = new Map<string, number>();
    if (!coords) return map;
    for (const e of rawEvents) {
      if (e.venueLat != null && e.venueLng != null) {
        map.set(e.id, haversineKm(coords.lat, coords.lng, e.venueLat, e.venueLng));
      }
    }
    return map;
  }, [rawEvents, coords]);

  const nearestSummary = useMemo(() => {
    if (!coords) return null;
    for (const ev of events) {
      const km = distanceByEventId.get(ev.id);
      if (typeof km === 'number') {
        return { name: ev.name, km };
      }
    }
    return null;
  }, [coords, events, distanceByEventId]);

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('tonight')}
      showGradientBg={false}
      hero={{
        titleWhite: "What's On",
        titleOrange: 'Tonight',
        largeTitle: true,
      }}
    >
      <div className="fixed inset-0 -z-20 bg-black pointer-events-none" aria-hidden="true" />

      <div className="text-neutral-200 font-sans pb-16">
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6">

          <p className="max-w-2xl mx-auto mb-6 text-sm leading-relaxed text-gray-300">
            What's on for bachata dancers in London tonight - socials, classes,
            warm-ups and after-parties happening in the next few hours.
            Use Near Me to sort by distance, or browse the full{' '}
            <Link to="/parties" className="text-primary underline">parties listing</Link>{' '}
            and{' '}
            <Link to="/classes" className="text-primary underline">classes</Link>.
          </p>

          <div className="max-w-md mx-auto mb-6">
            <NearMeCta
              status={locStatus}
              reason={locReason}
              onRequest={request}
              onClear={clear}
            />
          </div>

          {nearestSummary && (
            <div
              className="max-w-md mx-auto mb-8 text-center text-xs text-gray-400"
              data-testid="tonight-nearest-summary"
            >
              Nearest tonight:{' '}
              <span className="text-white font-semibold">
                {nearestSummary.name}
              </span>{' '}
              <span className="text-primary font-semibold">
                ({nearestSummary.km.toFixed(1)} km)
              </span>
            </div>
          )}

          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-white/30" />
              </div>
              <h3 className="text-white/70 text-xl font-bold mb-2">No events tonight</h3>
              <p className="text-white/40 text-sm max-w-xs">
                There are no events scheduled in your city tonight. Check back later or switch city.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, index) => {
              const countdown = computeCountdown(
                event.occurrenceStartsAt,
                event.occurrenceEndsAt,
                now,
              );
              const km = distanceByEventId.get(event.id);
              const startLabel = formatHHmm(event.occurrenceStartsAt);
              const endLabel = formatHHmm(event.occurrenceEndsAt);

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.4) }}
                  className="group relative"
                >
                  <Card
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${event.name}`}
                    onClick={() => navigate(event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`);
                      }
                    }}
                    className="bg-neutral-900/90 border-neutral-800 overflow-hidden hover:border-primary/50 transition-all duration-300 h-full flex flex-col cursor-pointer"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={event.image}
                        alt={event.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />

                      {countdown && (
                        <div className="absolute top-4 left-4">
                          {countdown.tone === 'live' ? (
                            <Badge className="bg-red-500/90 hover:bg-red-500 border-none text-white animate-pulse shadow-lg shadow-red-500/20">
                              {countdown.label}
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/90 hover:bg-yellow-500 border-none text-black font-semibold shadow-lg shadow-yellow-500/20">
                              {countdown.label}
                            </Badge>
                          )}
                        </div>
                      )}

                      {coords && km != null && (
                        <div className="absolute top-4 right-4" data-testid="distance-badge">
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-white shadow-lg shadow-black/40 ring-1 ring-black/30"
                          >
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            {km.toFixed(1)}&nbsp;km
                          </span>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-5 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors mb-1 leading-tight">
                        {event.name}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      </div>

                      {/* Unified labelled time rows */}
                      {(() => {
                        const PERF_TYPES = new Set(['performance', 'showcase', 'competition', 'concert', 'ceremony']);
                        const CLASS_TYPES = new Set(['class', 'masterclass']);
                        const rows = [];

                        if (event.hasClass && event.classStart && event.classEnd) {
                          rows.push(
                            <div key="class" className="mt-2 flex items-center gap-1.5 text-xs text-festival-blue">
                              <span className="font-bold">Class</span>
                              <span className="font-mono opacity-90">{event.classStart} – {event.classEnd}</span>
                            </div>
                          );
                        }
                        if (event.hasParty && event.partyStart && event.partyEnd) {
                          rows.push(
                            <div key="party" className="mt-2 flex items-center gap-1.5 text-xs text-festival-pink">
                              <span className="font-bold">Party</span>
                              <span className="font-mono opacity-90">{event.partyStart} – {event.partyEnd}</span>
                            </div>
                          );
                        }
                        if (rows.length > 0) return rows;

                        if (!startLabel) return null;
                        const timeRange = endLabel ? `${startLabel} – ${endLabel}` : startLabel;
                        if (CLASS_TYPES.has(event.type)) {
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-festival-blue">
                              <span className="font-bold">Class</span>
                              <span className="font-mono opacity-90">{timeRange}</span>
                            </div>
                          );
                        }
                        if (PERF_TYPES.has(event.type)) {
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400">
                              <span className="font-bold">Performance</span>
                              <span className="font-mono opacity-90">{timeRange}</span>
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-festival-pink">
                            <span className="font-bold">Party</span>
                            <span className="font-mono opacity-90">{timeRange}</span>
                          </div>
                        );
                      })()}

                      {event.primaryOrganiserName && (
                        <p className="text-sm text-gray-400 flex items-center mt-3">
                          <Crown className="w-3 h-3 mr-1.5 text-yellow-500" />
                          <span className="text-gray-500 text-xs uppercase tracking-wide mr-1">
                            Hosted by
                          </span>
                          {event.primaryOrganiserName}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default Tonight;
