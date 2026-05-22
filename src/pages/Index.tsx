import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { useCity } from '@/contexts/CityContext';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { LatestEventsWheel } from '@/components/LatestEventsWheel';

// Lazy load the heavy calendar component
const EventCalendar = lazy(() => import('@/components/EventCalendar').then(module => ({ default: module.EventCalendar })));

const Index = () => {
  const { citySlug } = useCity();

  const cityDisplayName = citySlug
    ? citySlug.split('-')[0].replace(/^\w/, (c) => c.toUpperCase())
    : 'Your City';

  // Fetch this week's events purely for the SEO meta event count.
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

  // Update document meta tags for city SEO
  useEffect(() => {
    if (!cityDisplayName || cityDisplayName === 'Your City') return;

    const title = `Bachata Classes & Events in ${cityDisplayName} | Bachata Calendar`;
    const description = `Find bachata classes, socials and festivals in ${cityDisplayName}. Browse this week's ${thisWeek} events - updated daily.`;

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
        {/* COMPACT BRAND STRIP */}
        <div className="relative px-4 pt-12 pb-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <h1 className="text-5xl font-black tracking-tight leading-tight mb-2">
              What's on in{' '}
              <span className="text-primary">{cityDisplayName}</span>
            </h1>
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
