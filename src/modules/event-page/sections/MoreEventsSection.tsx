import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

type MoreEvent = {
  slug?: string | null;
  id: string;
  occurrenceId: string | null;
  title: string;
  dateLabel: string;
  imageUrl: string | null;
};

type OtherOrganiser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Props = {
  currentEventId: string | null;
  organiserId: string | null;
  organiserName: string | null;
  citySlug: string | null;
  cityName: string | null;
};

// "More from {Organiser}" -- queries event_entities directly (same pattern
// as OrganiserProfile.tsx), then resolves the next upcoming occurrence per
// event via calendar_occurrences. Excludes the current event.
const useOrganiserEvents = (organiserId: string | null, currentEventId: string | null) =>
  useQuery({
    queryKey: ['more-events:organiser', organiserId, currentEventId],
    enabled: !!organiserId && !!currentEventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MoreEvent[]> => {
      const { data: links } = await supabase
        .from('event_entities')
        .select('events(id, slug, name, poster_url, is_active)')
        .eq('entity_id', organiserId!)
        .eq('role', 'organiser');

      type Link = { events: { id: string; slug: string | null; name: string; poster_url: string | null; is_active: boolean | null } | null };
      const events = ((links ?? []) as unknown as Link[])
        .map((r) => r.events)
        .filter((e): e is NonNullable<Link['events']> => Boolean(e))
        .filter((e) => e.is_active !== false && e.id !== currentEventId);
      const slugById = new Map(events.map((e) => [e.id, e.slug]));

      if (events.length === 0) return [];

      const eventIds = events.map((e) => e.id);
      const { data: occs } = await supabase
        .from('calendar_occurrences')
        .select('id, event_id, instance_start')
        .in('event_id', eventIds)
        .gte('instance_start', new Date().toISOString())
        .order('instance_start', { ascending: true });

      const nextByEvent: Record<string, { id: string; start: string }> = {};
      for (const r of (occs ?? []) as { id: string; event_id: string; instance_start: string }[]) {
        if (!nextByEvent[r.event_id]) nextByEvent[r.event_id] = { id: r.id, start: r.instance_start };
      }

      return events
        .filter((e) => nextByEvent[e.id])
        .map((e) => ({
          id: e.id,
          slug: slugById.get(e.id) ?? null,
          occurrenceId: nextByEvent[e.id].id,
          title: e.name,
          dateLabel: formatDate(nextByEvent[e.id].start),
          imageUrl: e.poster_url ?? null,
        }))
        .sort((a, b) => nextByEvent[a.id].start.localeCompare(nextByEvent[b.id].start))
        .slice(0, 2);
    },
  });

// Fallback when the current event's organiser has no other upcoming events:
// surface other active organisers in the same city, ranked by event count
// (get_organiser_event_counts RPC). Returns top 2 names + avatars.
const useOtherOrganisers = (currentOrganiserId: string | null, citySlug: string | null) =>
  useQuery({
    queryKey: ['more-events:other-organisers', currentOrganiserId, citySlug],
    enabled: !!citySlug,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OtherOrganiser[]> => {
      const { data: countsData } = await supabase.rpc('get_organiser_event_counts' as never, {
        p_city_slug: citySlug,
      } as never);

      type CountRow = { entity_id: string; event_count: number };
      const ranked = (((countsData as unknown) as CountRow[]) ?? [])
        .filter((c) => c.entity_id !== currentOrganiserId && (c.event_count ?? 0) > 0)
        .sort((a, b) => b.event_count - a.event_count)
        .slice(0, 2);

      if (ranked.length === 0) return [];

      const ids = ranked.map((r) => r.entity_id);
      const { data: orgData } = await supabase
        .from('organiser_profiles')
        .select('id, name, avatar_url')
        .in('id', ids)
        .not('is_active', 'is', false);

      type OrgRow = { id: string; name: string; avatar_url: string | null };
      const byId: Record<string, OrgRow> = Object.fromEntries(
        ((orgData ?? []) as OrgRow[]).map((o) => [o.id, o]),
      );

      return ranked
        .map((r) => byId[r.entity_id])
        .filter(Boolean)
        .map((o) => ({ id: o.id, name: o.name, avatarUrl: o.avatar_url }));
    },
  });

// "Don&rsquo;t miss this week in {City}" -- flagship-first ranking.
// Candidates come from get_calendar_events_v2 (city, 7-day window), then
// re-ranked by 30-day view counts from event_views (anon-readable).
// events.attendance_count is dormant (all-zero), so view-count is the
// only live popularity signal we have. Ties break by instance_date ASC.
const useThisWeekEvents = (citySlug: string | null, currentEventId: string | null) =>
  useQuery({
    queryKey: ['more-events:this-week-flagship', citySlug, currentEventId],
    enabled: !!citySlug && !!currentEventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MoreEvent[]> => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const { data, error } = await supabase.rpc('get_calendar_events_v2' as never, {
        range_start: start.toISOString(),
        range_end: end.toISOString(),
        city_slug_param: citySlug,
      } as never);
      if (error) throw error;
      type Row = { event_id: string; occurrence_id: string | null; name: string; instance_date: string; cover_image_url: string | null; photo_url: string | null };
      const candidates = ((data as unknown as Row[]) ?? []).filter((e) => e.event_id !== currentEventId);
      if (candidates.length === 0) return [];

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const eventIds = Array.from(new Set(candidates.map((e) => e.event_id)));
      const { data: views } = await supabase
        .from('event_views')
        .select('event_id')
        .in('event_id', eventIds)
        .gte('viewed_at', thirtyDaysAgo);
      const viewCount: Record<string, number> = {};
      for (const v of ((views ?? []) as { event_id: string }[])) {
        viewCount[v.event_id] = (viewCount[v.event_id] ?? 0) + 1;
      }

      return candidates
        .sort((a, b) => {
          const diff = (viewCount[b.event_id] ?? 0) - (viewCount[a.event_id] ?? 0);
          if (diff !== 0) return diff;
          return a.instance_date.localeCompare(b.instance_date);
        })
        .slice(0, 8)
        .map((e) => ({
          id: e.event_id,
          occurrenceId: e.occurrence_id ?? null,
          title: e.name,
          dateLabel: formatDate(e.instance_date),
          imageUrl: e.cover_image_url ?? e.photo_url ?? null,
        }));
    },
  });

const eventHref = (e: MoreEvent) => {
  const key = e.slug ?? e.id;
  return e.occurrenceId ? `/event/${key}?occurrenceId=${e.occurrenceId}` : `/event/${key}`;
};

const EventCard = ({ ev }: { ev: MoreEvent }) => (
  <Link
    to={eventHref(ev)}
    className="flex flex-col overflow-hidden rounded-lg border no-underline transition-transform hover:-translate-y-px"
    style={{
      background: 'hsl(var(--bento-surface-raised))',
      borderColor: 'hsl(var(--bento-accent) / 0.18)',
      color: 'hsl(var(--bento-fg))',
    }}
  >
    <div className="h-24 w-full overflow-hidden bg-gradient-to-br from-primary/30 to-festival-pink/20">
      {ev.imageUrl ? (
        <img src={ev.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
    </div>
    <div className="flex flex-col gap-0.5 px-2 py-1.5">
      <span className="line-clamp-2 text-xs font-semibold leading-tight">{ev.title}</span>
      <span className="text-[10px] leading-tight" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
        {ev.dateLabel}
      </span>
    </div>
  </Link>
);

const OrganiserCard = ({ org }: { org: OtherOrganiser }) => (
  <Link
    to={`/organisers/${org.id}`}
    className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-2 py-3 no-underline transition-transform hover:-translate-y-px"
    style={{
      background: 'hsl(var(--bento-surface-raised))',
      borderColor: 'hsl(var(--bento-accent) / 0.18)',
      color: 'hsl(var(--bento-fg))',
    }}
  >
    <div
      className="h-14 w-14 overflow-hidden rounded-full"
      style={{ background: 'hsl(var(--bento-accent) / 0.18)' }}
    >
      {org.avatarUrl ? (
        <img src={org.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : null}
    </div>
    <span className="line-clamp-2 text-center text-xs font-semibold leading-tight">{org.name}</span>
  </Link>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div
    className="text-center text-base font-bold uppercase tracking-[0.04em] mb-2"
    style={{ color: 'hsl(var(--bento-accent))' }}
  >
    {children}
  </div>
);

export const MoreEventsSection = ({
  currentEventId,
  organiserId,
  organiserName,
  citySlug,
  cityName,
}: Props) => {
  const { data: organiserEvents = [] } = useOrganiserEvents(organiserId, currentEventId);
  const { data: thisWeekRaw = [] } = useThisWeekEvents(citySlug, currentEventId);
  const { data: otherOrganisers = [] } = useOtherOrganisers(organiserId, citySlug);

  // De-dupe -- if an event is in the organiser list it shouldn't repeat in
  // the this-week list (small overlap is the usual case for local nights).
  const thisWeekEvents = useMemo(() => {
    const seen = new Set(organiserEvents.map((e) => e.id));
    return thisWeekRaw.filter((e) => !seen.has(e.id)).slice(0, 4);
  }, [organiserEvents, thisWeekRaw]);

  const hasOrganiserEvents = organiserEvents.length > 0 && Boolean(organiserName);
  // Fallback strip: only when organiser has no events of their own to show.
  // Keeps the page from showing two strips of unrelated content.
  const showOtherOrganisers = !hasOrganiserEvents && otherOrganisers.length > 0;
  const hasThisWeek = thisWeekEvents.length > 0;
  if (!hasOrganiserEvents && !showOtherOrganisers && !hasThisWeek) return null;

  return (
    <section className="mt-4 space-y-4" aria-label="More events">
      {hasOrganiserEvents && (
        <div>
          <SectionTitle>More from {organiserName}</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {organiserEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}

      {showOtherOrganisers && (
        <div>
          <SectionTitle>Other organisers you might like</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {otherOrganisers.map((org) => (
              <OrganiserCard key={org.id} org={org} />
            ))}
          </div>
        </div>
      )}

      {hasThisWeek && (
        <div>
          <SectionTitle>Don&rsquo;t miss this week{cityName ? ` in ${cityName}` : ''}</SectionTitle>
          <div className="grid grid-cols-4 gap-1.5">
            {thisWeekEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-widest no-underline transition-colors"
          style={{
            color: 'hsl(var(--bento-accent))',
            borderColor: 'hsl(var(--bento-accent) / 0.4)',
            background: 'hsl(var(--bento-accent) / 0.10)',
          }}
        >
          See full calendar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
};
