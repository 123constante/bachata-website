/**
 * LiveEventsSection - a self-contained "what's on" block for the SEO pillar
 * pages (London guide, /learn-bachata-london). Fetches live calendar events for
 * the next N days, optionally filters to classes or parties, and renders a
 * compact list of crawlable <Link>s to each event page.
 *
 * Why this exists: the guide and learn pages both want a freshness-bearing,
 * internally-linking events list driven by real DB data (per SEO plan 2.2 /
 * 2.4). Keeping it in one place means both pages read `e.location` (the actual
 * RPC field) rather than re-introducing the empty `venueName` bug, and both
 * link via the shared eventHref() util so the 1.2 slug migration lands once.
 *
 * The list is SERVER-RENDERED: the route loader dehydrates the same query entry
 * this component reads (@/lib/seoLandingEvents owns the one key + fetcher), so
 * crawlers get real events and real /event/ links instead of an empty section.
 * That makes `serverTodayKey` load-bearing -- see the prop doc below.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { eventHref } from '@/lib/seo/eventHref';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { type WallClock, formatWallClockLocalIntl } from '@/lib/time/wallClock';
import { SEO_LANDING_WINDOWS, useSeoLandingEvents } from '@/lib/seoLandingEvents';
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
  /**
   * The London date key the SERVER rendered on, threaded down from the route
   * loader. Load-bearing: the window (and therefore the query key) is derived
   * from it, and these documents are edge-cached for an hour and served stale
   * for a day -- so a document generated before London midnight can be hydrated
   * after it. Without the pin the client's first render would build a different
   * key, miss the dehydrated entry, and render an empty list over server HTML
   * that had events. useLondonToday still rolls the day over post-mount.
   */
  serverTodayKey?: string;
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
  windowDays = SEO_LANDING_WINDOWS.guide,
  classesOnly = false,
  partiesOnly = false,
  limit = 12,
  emptyText,
  id,
  serverTodayKey,
}: LiveEventsSectionProps) => {
  // Pinned for the first render, reactive afterwards (long-lived tabs roll over
  // at London midnight rather than freezing on the server's day).
  const todayKey = useLondonToday(serverTodayKey);

  // City is pinned to London inside the shared seam, NOT read from CityContext:
  // these are explicitly London pages, and a localStorage-seeded slug would
  // change the query key between server and client. See seoLandingEvents.ts.
  const { data: events = [] } = useSeoLandingEvents(todayKey, windowDays);

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
          {matched.map((e) => {
            const when = fmt(e.occurrence_starts_at);
            return (
              <li
                key={`${e.event_id}-${e.instance_date}`}
                className="rounded border border-border/60 p-3 hover:bg-primary/5 transition"
              >
                <Link to={eventHref(e)} className="block">
                  <div className="font-semibold text-base">{e.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {e.location}
                    {when ? <> &middot; {when}</> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default LiveEventsSection;
