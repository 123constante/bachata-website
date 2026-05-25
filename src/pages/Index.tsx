import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { useCity } from '@/contexts/CityContext';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { LatestEventsWheel } from '@/components/LatestEventsWheel';
import { renderEventListJsonLd } from '@/lib/buildEventListJsonLd';

// Lazy load the heavy calendar component
const EventCalendar = lazy(() => import('@/components/EventCalendar').then(module => ({ default: module.EventCalendar })));

const Index = () => {
  const { citySlug } = useCity();

  // Derive a display name from the slug. Slugs are '{city}-{country}' (e.g.
  // 'london-gb'); drop a trailing 2-letter country code and title-case every
  // remaining word so multi-word cities render correctly ('new-york-us' ->
  // 'New York', not 'New').
  const cityDisplayName = useMemo(() => {
    if (!citySlug) return 'Your City';
    const parts = citySlug.split('-');
    if (parts.length > 1 && parts[parts.length - 1].length === 2) parts.pop();
    return parts.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
  }, [citySlug]);

  // Fetch this week's events for the SEO meta event count + JSON-LD list.
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);

  const { data: weekEvents } = useCalendarEvents({
    rangeStart: weekStart,
    rangeEnd: weekEnd,
    citySlug: citySlug ?? null,
    enabled: Boolean(citySlug),
  });

  const thisWeek = weekEvents?.length ?? 0;

  // Schema.org ItemList of this week's events, emitted as inline JSON-LD so
  // search engines can surface event rich results from the home page.
  const eventsJsonLd = useMemo(() => {
    if (!weekEvents || weekEvents.length === 0) return null;
    const origin =
      typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return renderEventListJsonLd({ events: weekEvents, origin });
  }, [weekEvents]);

  // Update document meta tags for city SEO
  useEffect(() => {
    if (!cityDisplayName || cityDisplayName === 'Your City') return;

    const title = `Bachata Classes & Events in ${cityDisplayName} | Bachata Calendar`;
    const description = `Find bachata classes, parties and festivals in ${cityDisplayName}. Browse this week's ${thisWeek} events \u2014 updated daily.`;

    document.title = title;

    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
  }, [cityDisplayName, thisWeek]);

  return (
    <PageErrorBoundary>
      <GlobalLayout showSubheader={false}>
        {eventsJsonLd && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: eventsJsonLd }}
          />
        )}
        {/* COMPACT BRAND STRIP */}
        <div className="relative px-4 pt-8 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-accent">
              {cityDisplayName} &middot; Bachata
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.02] mb-2">
              What's on in{' '}
              <span className="text-primary">{cityDisplayName}</span>
            </h1>
            <p className="max-w-[280px] text-sm text-muted-foreground">
              Every class, party &amp; festival in one place &mdash; updated daily.
            </p>
            {thisWeek > 0 && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-accent">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                {thisWeek} {thisWeek === 1 ? 'event' : 'events'} this week
              </span>
            )}
          </div>
        </div>

        {/* JUST ADDED - newest uploads (3D carousel wheel) */}
        <ErrorBoundary>
          <LatestEventsWheel />
        </ErrorBoundary>

        {/* EVENT CALENDAR */}
        <section className="min-h-[500px] sm:min-h-[650px]">
          <div className="container mx-auto px-4">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center min-h-[600px] w-full text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                <p>Loading calendar&hellip;</p>
              </div>
            }>
              <ErrorBoundary>
                <EventCalendar />
              </ErrorBoundary>
            </Suspense>
          </div>
        </section>
      </GlobalLayout>
    </PageErrorBoundary>
  );
};

export default Index;
