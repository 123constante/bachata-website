/**
 * Programmatic weekday landing page: /bachata-london-{monday|...|sunday}
 *
 * Targets long-tail queries like "bachata friday london". Pulls live events
 * for the next 4 weeks, filters to the URL weekday, renders a list.
 *
 * SEO plan 2.3 fixes:
 *   - citySlug defaults to london-gb (cold visitors + prerender got 0 events)
 *   - venue names read e.location (the real RPC field, not missing e.venueName)
 *   - event links use eventHref() (slug-ready, uuid fallback)
 *   - recurring events deduplicated to the soonest occurrence per event
 *   - title: "Bachata in London on {Day}s - Classes & Socials"
 *   - canonical uses SITE_ORIGIN (www)
 *   - ItemList JSON-LD for the live event list
 *   - closing links to guide, bachata-parties-london, classes
 */
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, SITE_ORIGIN, type SeoInput } from '@/lib/seo';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { useCity } from '@/contexts/CityContext';
import { eventHref } from '@/lib/seo/eventHref';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { londonDayRangeUtc, weekdayOfKey } from '@/lib/londonDate';
import { useLondonToday } from '@/hooks/useLondonToday';

interface WeekdayMeta {
  slug: string;
  label: string;
  dow: number;
  intro: string;
  context: string;
}

const WEEKDAYS: Record<string, WeekdayMeta> = {
  monday: {
    slug: 'monday', label: 'Monday', dow: 1,
    intro: "Monday night bachata in London - the gentle entry to the week. Beginners' classes, low-pressure socials, and a handful of dedicated rooms that lead the week.",
    context: "Monday is the easiest night to walk into a bachata class with no experience - the rooms are smaller, the teachers have time, and the dancers are local regulars.",
  },
  tuesday: {
    slug: 'tuesday', label: 'Tuesday', dow: 2,
    intro: 'Tuesday bachata in London - mid-week classes pick up and the first big socials of the week run in central London.',
    context: 'Tuesdays in London bachata are class-led. The rooms are mostly schools running structured course blocks; turn up for the class and stay for the social that follows.',
  },
  wednesday: {
    slug: 'wednesday', label: 'Wednesday', dow: 3,
    intro: 'Wednesday bachata in London - the mid-week peak for socials. The biggest dedicated bachata rooms run on Wednesday.',
    context: "Wednesday is when London's bachata scene really opens up - multiple socials run in parallel across the city, with a mix of sensual and Dominican rooms.",
  },
  thursday: {
    slug: 'thursday', label: 'Thursday', dow: 4,
    intro: "Thursday bachata in London - the warm-up to the weekend. Several flagship socials run on Thursdays.",
    context: 'Thursdays carry pre-weekend energy. Expect bigger crowds, sets that lean party-side, and out-of-town teachers passing through on tour.',
  },
  friday: {
    slug: 'friday', label: 'Friday', dow: 5,
    intro: "Friday bachata in London - the weekend kicks off. The biggest parties, the longest nights, the most international dancers in the room.",
    context: "Friday is London bachata's flagship night. Multiple big-room parties run until 3am or later, often with two or three dance floors playing different styles.",
  },
  saturday: {
    slug: 'saturday', label: 'Saturday', dow: 6,
    intro: "Saturday bachata in London - the headline night. Festivals, congresses, special editions and the biggest weekly parties land on Saturdays.",
    context: "Saturday is festival night when a congress is in town, and a flagship-party night when one isn't. Plan ahead - the big rooms sell out.",
  },
  sunday: {
    slug: 'sunday', label: 'Sunday', dow: 0,
    intro: 'Sunday bachata in London - afternoon socials, recovery classes, and the long, slow tail of the weekend.',
    context: 'Sundays mix afternoon socials, weekend-festival closings, and Sunday-night recovery rooms. A relaxed way to close the week.',
  },
};

function isSameWeekday(e: CalendarEventRow, dow: number): boolean {
  // instance_date is 'YYYY-MM-DD' (London calendar day); start_time is a
  // wall-clock-as-UTC string whose leading date part is the same calendar day.
  // Compare via weekdayOfKey — `new Date(str).getDay()` reads the BROWSER's
  // weekday of UTC midnight, which is off by one west of UTC.
  const iso = e.instance_date ?? e.start_time;
  if (!iso) return false;
  return weekdayOfKey(iso.slice(0, 10)) === dow;
}

const fmt = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

interface ItemListJsonLdProps {
  events: CalendarEventRow[];
  canonicalBase: string;
}

const ItemListJsonLd = ({ events, canonicalBase }: ItemListJsonLdProps) => {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: canonicalBase,
    itemListElement: events.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_ORIGIN}${eventHref(e)}`,
      name: e.name,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
};

// Shared with the framework route (app/routes/bachata-weekday.tsx) so the
// route's meta() and the client useSeo() derive identical head tags from the
// pathname -- one source for all seven /bachata-london-{weekday} pages.
export function weekdaySeoInput(pathname: string): SeoInput {
  const weekdayMatch = pathname.match(/^\/bachata-london-([a-z]+)\/?$/i);
  const meta = weekdayMatch ? WEEKDAYS[weekdayMatch[1].toLowerCase()] : undefined;
  return meta
    ? {
        title: `Bachata in London on ${meta.label}s - Classes & Socials`,
        description: meta.intro,
        canonical: `${SITE_ORIGIN}/bachata-london-${meta.slug}`,
        ogType: 'article',
      }
    : {
        title: 'Bachata in London',
        description: 'Bachata events in London by weekday.',
        noindex: true,
      };
}

const BachataWeekday = () => {
  const location = useLocation();
  // Routes are 7 explicit /bachata-london-{weekday} paths (React Router v6
  // doesn't allow partial dynamic segments). Derive weekday from the suffix.
  const weekdayMatch = location.pathname.match(/^\/bachata-london-([a-z]+)\/?$/i);
  const meta = weekdayMatch ? WEEKDAYS[weekdayMatch[1].toLowerCase()] : undefined;
  const { citySlug } = useCity();
  // These are explicitly London SEO pages. CityContext only sets citySlug from
  // the URL (/city/:slug) or prior localStorage, so a first-time visitor and
  // the headless prerender (neither URL nor localStorage) would otherwise get a
  // null slug and 0 live events. Defaulting to london-gb fixes both.
  const effectiveCitySlug = citySlug ?? 'london-gb';

  // London-day range instants (not browser-local midnight), reactive so a
  // long-lived tab rolls the 4-week window over at midnight.
  const todayKey = useLondonToday();
  const { rangeStart, rangeEnd } = useMemo(() => {
    const { start, end } = londonDayRangeUtc(todayKey, 28);
    return { rangeStart: start, rangeEnd: end };
  }, [todayKey]);

  const { data: events = [] } = useCalendarEvents({
    rangeStart,
    rangeEnd,
    citySlug: effectiveCitySlug,
    enabled: Boolean(meta),
  });

  const matched = useMemo((): CalendarEventRow[] => {
    if (!meta) return [];
    const filtered = (events as CalendarEventRow[]).filter((e) =>
      isSameWeekday(e, meta.dow),
    );
    // Recurring events return one row per occurrence; collapse to the soonest
    // so the list shows distinct events rather than the same night four times.
    const seen = new Set<string>();
    const deduped: CalendarEventRow[] = [];
    for (const e of filtered) {
      if (seen.has(e.event_id)) continue;
      seen.add(e.event_id);
      deduped.push(e);
    }
    return deduped.slice(0, 30);
  }, [events, meta]);

  const canonical = meta
    ? `${SITE_ORIGIN}/bachata-london-${meta.slug}`
    : `${SITE_ORIGIN}/`;

  useSeo(weekdaySeoInput(location.pathname));

  if (!meta) {
    return (
      <GlobalLayout showSubheader={false}>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-3">
          <h1 className="text-2xl font-bold">Weekday not found</h1>
          <p className="text-muted-foreground">
            Try{' '}
            <Link to="/london-bachata-guide" className="text-primary underline">
              the London bachata guide
            </Link>{' '}
            for the full weekly rhythm.
          </p>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout showSubheader={false}>
      {matched.length > 0 && (
        <ItemListJsonLd events={matched} canonicalBase={canonical} />
      )}
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Bachata in London on {meta.label}s &mdash; Classes &amp; Socials
          </h1>
          <p className="text-base text-muted-foreground">{meta.intro}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Why {meta.label}?</h2>
          <p className="leading-relaxed">{meta.context}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">
            What&rsquo;s on {meta.label}s in London
            {' '}({matched.length} event{matched.length === 1 ? '' : 's'})
          </h2>
          {matched.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No bachata events listed for the next four {meta.label}s. Check the{' '}
              <Link to="/tonight" className="text-primary underline">Tonight page</Link>{' '}
              or the full{' '}
              <Link to="/parties" className="text-primary underline">parties listing</Link>.
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
                      {e.start_time ? <> &middot; {fmt(e.start_time)}</> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">Other weekdays</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.values(WEEKDAYS)
              .filter((w) => w.slug !== meta.slug)
              .map((w) => (
                <li key={w.slug}>
                  <Link
                    to={`/bachata-london-${w.slug}`}
                    className="block rounded border border-border/60 px-3 py-2 text-center text-sm font-semibold hover:bg-primary/10 transition"
                  >
                    {w.label}
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section className="border-t border-border/40 pt-6">
          <p className="text-sm text-muted-foreground">
            More London bachata:{' '}
            <Link to="/london-bachata-guide" className="text-primary underline">
              London Bachata Guide
            </Link>
            {' '}&middot;{' '}
            <Link to="/bachata-parties-london" className="text-primary underline">
              Bachata parties in London
            </Link>
            {' '}&middot;{' '}
            <Link to="/classes" className="text-primary underline">
              Find a class
            </Link>
          </p>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default BachataWeekday;