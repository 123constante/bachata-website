/**
 * LiveEventsSection - a self-contained "what's on" block for the SEO pillar
 * pages (London guide, /learn-bachata-london). Fetches live calendar events for
 * the next N days via useCalendarEvents, optionally filters to classes or
 * parties, and renders a compact list of crawlable <Link>s to each event page.
 *
 * Why this exists: the guide and learn pages both want a freshness-bearing,
 * internally-linking events list driven by real DB data (per SEO plan 2.2 /
 * 2.4). Keeping it in one place means both pages read `e.location` (the actual
 * RPC field) rather than re-introducing the empty `venueName` bug, and both
 * link via the shared eventHref() util so the 1.2 slug migration lands once.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { useCity } from '@/contexts/CityContext';
import { eventHref } from '@/lib/seo/eventHref';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { type WallClock, formatWallClockLocalIntl } from '@/lib/time/wallClock';
import { londonDayRangeUtc } from '@/lib/londonDate';
import { useLondonToday } from '@/hooks/useLondonToday';

export interface LiveEventsSectionProps {
  /** Section heading rendered as an <h2>. */
  heading: string;
  /** How far ahead to look, in days. Default 7 (this week). */
  windowDays?: number;
  /** Only show events that include a class (has_class). */
  classesOnly?: boolean;
  /** Only show events that include a party (has_party). */
  partiesOnly?: boolean;
  /** Cap the number of events rendered. Default 12. */
  limit?: number;
  /** Empty-state copy shown when no events match. */
  emptyText?: React.ReactNode;
  /** Optional id for in-page ToC anchoring. */
  id?: string;
}

// Reads the stored wall clock AS STORED (no timezone shift) -- a plain
// new Date(iso).toLocaleString() rendered these an hour late all BST ("9:00 pm"
// for a stored 20:00).
const fmt = (wc: WallClock | null | undefined): string =>
  formatWallClockLocalIntl(wc, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) ?? '';

const LiveEventsSection = ({
  heading,
  windowDays = 7,
  classesOnly = false,
  partiesOnly = false,
  limit = 12,
  emptyText,
  id,
}: LiveEventsSectionProps) => {
  const { citySlug } = useCity();
  // These are explicitly London SEO pages. CityContext only sets citySlug from
  // the URL (/city/:slug) or prior localStorage, so a first-time visitor -- and
  // the headless prerender, which has neither -- would otherwise get a null slug
  // and an empty list. Defaulting to london-gb makes the live section render for
  // crawlers and cold visitors alike.
  const effectiveCitySlug = citySlug ?? 'london-gb';

  // London-day range instants (not browser-local midnight), reactive so a
  // long-lived tab rolls the window over at midnight.
  const todayKey = useLondonToday();
  const { rangeStart, rangeEnd } = useMemo(() => {
    const { start, end } = londonDayRangeUtc(todayKey, windowDays);
    return { rangeStart: start, rangeEnd: end };
  }, [todayKey, windowDays]);

  const { data: events = [] } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    citySlug: effectiveCitySlug,
    enabled: true,
  });

  const matched = useMemo(() => {
    const filtered = (events as CalendarEventRow[])
      .filter((e) => (classesOnly ? e.has_class : true))
      .filter((e) => (partiesOnly ? e.has_party : true));
    // Recurring events return one row per occurrence; collapse to the soonest
    // occurrence of each event so the list shows distinct venues/classes (more
    // varied internal links) rather than the same weekly night four times.
    const seen = new Set<string>();
    const deduped: CalendarEventRow[] = [];
    for (const e of filtered) {
      if (seen.has(e.event_id)) continue;
      seen.add(e.event_id);
      deduped.push(e);
    }
    return deduped.slice(0, limit);
  }, [events, classesOnly, partiesOnly, limit]);

  return (
    <section className="space-y-3" id={id}>
      <h2 className="text-2xl font-bold">{heading}</h2>
      {matched.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {emptyText ?? (
            <>
              Nothing listed in this window just now &mdash; browse the{' '}
              <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}
              for what&rsquo;s on next.
            </>
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {matched.map((e) => (
            <li
              key={`${e.event_id}-${e.instance_date}`}
              className="rounded border border-border/60 p-3 hover:bg-primary/5 transition"
            >
              <Link to={eventHref(e)} className="block">
                <div className="font-semibold text-base">{e.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {e.location}
                  {fmt(e.occurrence_starts_at) ? <> &middot; {fmt(e.occurrence_starts_at)}</> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default LiveEventsSection;
