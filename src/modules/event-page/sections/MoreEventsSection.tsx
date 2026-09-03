import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getCalendarEvents } from '@/integrations/supabase/eventRpcs';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { weekdayOfKey } from '@/lib/londonDate';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// instance_start is London wall-clock text — its leading date part IS the
// calendar day to label. new Date(iso) read it as an instant (wrong weekday
// west of UTC) and iOS Safari rejects the space-separated form outright.
const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const key = iso.slice(0, 10);
  const [, m, d] = key.split('-').map(Number);
  if (!m || !d) return '';
  return `${WEEKDAYS[weekdayOfKey(key)]} ${d} ${MONTHS[m - 1]}`;
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

// Series-termination arc P4b. An ended page renders this section TWICE: once
// high up as the "forward door" directly under the tombstone, once in its usual
// place at the foot of the page. `blocks` splits the content between the two so
// nothing appears in both. Defaults to all three, so every existing call site --
// and every page that is not a tombstone -- is unchanged.
export type MoreEventsBlock = 'organiser' | 'thisWeek' | 'calendarPill';

const ALL_BLOCKS: readonly MoreEventsBlock[] = ['organiser', 'thisWeek', 'calendarPill'];

type Props = {
  currentEventId: string | null;
  organiserId: string | null;
  organiserName: string | null;
  citySlug: string | null;
  cityName: string | null;
  /** Which blocks this instance renders. The other-organisers strip rides with
   *  'organiser': it is that block's empty state, and it is what stops the door
   *  under a tombstone from rendering as an empty promise. */
  blocks?: readonly MoreEventsBlock[];
  /** Landmark label. Two <section>s carrying the same aria-label on one page are
   *  indistinguishable in a screen reader's landmark list, so the door names
   *  itself rather than repeating "More events". */
  sectionLabel?: string;
  /** Label used INSTEAD of `sectionLabel` when this instance ends up rendering
   *  the other-organisers fallback rather than the organiser's own events. The
   *  door is labelled "Still running from this organiser", which is a false
   *  statement to a screen-reader user when what rendered is a grid of DIFFERENT
   *  organisers -- the opposite of the fact the tombstone exists to state. */
  fallbackSectionLabel?: string;
  /** Let the "See full calendar" pill stand alone, without another block above
   *  it. Off by default so ordinary pages keep rendering nothing when they have
   *  nothing; on for a tombstone, where the pill is the way off a dead-end page. */
  pillIsTheWayOut?: boolean;
};

// "More from {Organiser}" -- one P5-native call returns each of the organiser's
// events with its next upcoming occurrence (M2: this replaced a direct
// event_entities->events embed plus a calendar_occurrences lookup). The RPC applies
// the organiser linkage, the is_active gate and the London-wall-clock "upcoming"
// boundary server-side. Ranking stays here: 30-day view counts from event_views,
// tie-broken by next-occurrence date ASC. Excludes the current event.
type OrganiserOccurrenceRow = {
  event_id: string;
  slug: string | null;
  name: string | null;
  poster_url: string | null;
  occurrence_id: string;
  next_start: string;
};

const useOrganiserEvents = (organiserId: string | null, currentEventId: string | null) =>
  useQuery({
    queryKey: ['more-events:organiser-flagship-v2', organiserId, currentEventId],
    enabled: !!organiserId && !!currentEventId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MoreEvent[]> => {
      const { data, error } = await supabase.rpc('get_organiser_next_occurrences_v1' as never, {
        p_organiser_id: organiserId!,
      } as never);
      if (error) throw error;

      const events = ((data ?? []) as OrganiserOccurrenceRow[])
        .filter((e) => e.event_id !== currentEventId);
      if (events.length === 0) return [];

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: views } = await supabase
        .from('event_views')
        .select('event_id')
        .in('event_id', events.map((e) => e.event_id))
        .gte('viewed_at', thirtyDaysAgo);
      const viewCount: Record<string, number> = {};
      for (const v of ((views ?? []) as { event_id: string }[])) {
        viewCount[v.event_id] = (viewCount[v.event_id] ?? 0) + 1;
      }

      return events
        .sort((a, b) => {
          const diff = (viewCount[b.event_id] ?? 0) - (viewCount[a.event_id] ?? 0);
          if (diff !== 0) return diff;
          return a.next_start.localeCompare(b.next_start);
        })
        .slice(0, 2)
        .map((e) => ({
          id: e.event_id,
          slug: e.slug,
          occurrenceId: e.occurrence_id,
          title: e.name ?? '',
          dateLabel: formatDate(e.next_start),
          imageUrl: e.poster_url ?? null,
        }));
    },
  });

// Fallback when the current event's organiser has no other upcoming events:
// surface other active organisers in the same city, picked at random.
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
      const eligible = (((countsData as unknown) as CountRow[]) ?? [])
        .filter((c) => c.entity_id !== currentOrganiserId && (c.event_count ?? 0) > 0);
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const picked = eligible.slice(0, 2);

      if (picked.length === 0) return [];

      const ids = picked.map((r) => r.entity_id);
      const { data: orgData } = await supabase
        .from('organiser_profiles')
        .select('id, name, avatar_url')
        .in('id', ids)
        .not('is_active', 'is', false);

      type OrgRow = { id: string; name: string; avatar_url: string | null };
      const byId: Record<string, OrgRow> = Object.fromEntries(
        ((orgData ?? []) as OrgRow[]).map((o) => [o.id, o]),
      );

      return picked
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
      const rows = await getCalendarEvents({
        range_start: start.toISOString(),
        range_end: end.toISOString(),
        city_slug_param: citySlug,
      });
      const allRows = rows.filter((e) => e.event_id !== currentEventId);
      // Collapse multi-day festivals (one row per day) to a single card per
      // event -- keep the earliest occurrence so a festival fills one slot, not many.
      const byEvent = new Map<string, (typeof allRows)[number]>();
      for (const r of allRows) {
        const cur = byEvent.get(r.event_id);
        if (!cur || (r.instance_date ?? '') < (cur.instance_date ?? '')) byEvent.set(r.event_id, r);
      }
      const candidates = [...byEvent.values()];
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
          imageUrl: e.cover_image_url ?? e.photo_url?.[0] ?? null,
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
        <img src={optimizedImageUrl(ev.imageUrl, 320)} alt="" className="h-full w-full object-cover" loading="lazy" />
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
        <img src={optimizedImageUrl(org.avatarUrl, 160)} alt="" className="h-full w-full object-cover" loading="lazy" />
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
  blocks = ALL_BLOCKS,
  sectionLabel = 'More events',
  fallbackSectionLabel,
  pillIsTheWayOut = false,
}: Props) => {
  // All three queries run on EVERY instance, whatever `blocks` says -- hooks
  // cannot be conditional, and it costs no extra network: both instances share
  // react-query keys, so each RPC is fetched once. It is also load-bearing: the
  // de-dupe below needs the organiser list even on the instance that does not
  // render it, or the door and the bottom strip would show the same event twice.
  const { data: organiserEvents = [] } = useOrganiserEvents(organiserId, currentEventId);
  const { data: thisWeekRaw = [] } = useThisWeekEvents(citySlug, currentEventId);
  const { data: otherOrganisers = [] } = useOtherOrganisers(organiserId, citySlug);

  // De-dupe -- if an event is in the organiser list it shouldn't repeat in
  // the this-week list (small overlap is the usual case for local nights).
  const thisWeekEvents = useMemo(() => {
    const seen = new Set(organiserEvents.map((e) => e.id));
    return thisWeekRaw.filter((e) => !seen.has(e.id)).slice(0, 4);
  }, [organiserEvents, thisWeekRaw]);

  const wants = (block: MoreEventsBlock) => blocks.includes(block);

  const hasOrganiserEvents = organiserEvents.length > 0 && Boolean(organiserName);
  // Fallback strip: only when organiser has no events of their own to show.
  // Keeps the page from showing two strips of unrelated content.
  const showOtherOrganisers = !hasOrganiserEvents && otherOrganisers.length > 0;
  const hasThisWeek = thisWeekEvents.length > 0;

  const showOrganiser = wants('organiser') && hasOrganiserEvents;
  const showFallback = wants('organiser') && showOtherOrganisers;
  const showThisWeek = wants('thisWeek') && hasThisWeek;
  // The pill is a destination, not content: normally it renders only above
  // something. An earlier draft let it count as content everywhere so it could
  // not vanish from a tombstone whose city had a quiet week -- but that made the
  // early return unreachable on every DEFAULT call site too, turning a
  // prop-scoped refactor into a site-wide render change (an ordinary event with
  // no organiser events, no fallback and a quiet week went from rendering
  // nothing to rendering a bare link home). That draft was reverted.
  //
  // `pillIsTheWayOut` is the same idea SCOPED TO THE CALL SITE THAT NEEDS IT, so
  // the default stays byte-identical. The tombstone's own copy promises "have a
  // look at what else is on below", and the earlier reasoning here -- that the
  // door above still carries the organiser strip -- only holds while the
  // organiser HAS other live events. get_organiser_next_occurrences_v1 gates on
  // lifecycle_status = 'live', so an organiser whose only series is the one that
  // just ended has none: the door hits its own early return, this instance hits
  // this one, and the tombstone becomes a hard dead end with no link off it.
  const showCalendarPill =
    wants('calendarPill') && (pillIsTheWayOut || showOrganiser || showFallback || showThisWeek);
  if (!showOrganiser && !showFallback && !showThisWeek && !showCalendarPill) return null;

  return (
    <section
      className="mt-4 space-y-4"
      // The label has to describe what ACTUALLY rendered. showFallback is the
      // organiser block's empty state -- a grid of OTHER organisers -- so a door
      // labelled "Still running from this organiser" would tell a screen-reader
      // user the organiser is still running events and then land them on a list
      // of people who are not that organiser.
      aria-label={showFallback && !showOrganiser ? (fallbackSectionLabel ?? sectionLabel) : sectionLabel}
    >
      {showOrganiser && (
        <div>
          <SectionTitle>More from {organiserName}</SectionTitle>
          <div className="flex justify-center gap-1.5">
            {organiserEvents.map((ev) => (
              <div key={ev.id} className="w-[calc((100%-1.125rem)/4)]">
                <EventCard ev={ev} />
              </div>
            ))}
          </div>
        </div>
      )}

      {showFallback && (
        <div>
          <SectionTitle>Other organisers you might like</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {otherOrganisers.map((org) => (
              <OrganiserCard key={org.id} org={org} />
            ))}
          </div>
        </div>
      )}

      {showThisWeek && (
        <div>
          <SectionTitle>Don&rsquo;t miss this week{cityName ? ` in ${cityName}` : ''}</SectionTitle>
          <div className="grid grid-cols-4 gap-1.5">
            {thisWeekEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}

      {showCalendarPill && (
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
      )}
    </section>
  );
};
