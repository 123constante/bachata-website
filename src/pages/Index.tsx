import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Loader2, Sparkles, Calendar, GraduationCap } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { ErrorBoundary, PageErrorBoundary } from '@/components/ErrorBoundary';
import { FloatingElements } from '@/components/FloatingElements';
import { useCity } from '@/contexts/CityContext';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';

// Lazy load the heavy calendar component
const EventCalendar = lazy(() => import('@/components/EventCalendar').then(module => ({ default: module.EventCalendar })));

const Index = () => {
  const { citySlug } = useCity();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const cityDisplayName = citySlug
    ? citySlug.split('-')[0].replace(/^\w/, (c) => c.toUpperCase())
    : 'Your City';

  // Fetch this week's events for stats
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

  const stats = useMemo(() => {
    if (!weekEvents?.length) return { thisWeek: 0, classesTonight: 0 };
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thisWeek = weekEvents.length;
    const classesTonight = weekEvents.filter(
      (e) => e.instance_date === todayStr && e.has_class
    ).length;
    return { thisWeek, classesTonight };
  }, [weekEvents]);

  // Update document meta tags for city SEO
  useEffect(() => {
    if (!cityDisplayName || cityDisplayName === 'Your City') return;

    const title = `Bachata Classes & Events in ${cityDisplayName} | Bachata Calendar`;
    const description = `Find bachata classes, socials and festivals in ${cityDisplayName}. Browse this week's ${stats.thisWeek} events — updated daily.`;

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
  }, [cityDisplayName, stats.thisWeek]);

  return (
    <PageErrorBoundary>
    <div className="min-h-screen text-foreground overflow-x-hidden">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-40 origin-left"
        style={{ scaleX }}
      />
      {/* Animated background */}
      <motion.div
        className="fixed inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 -z-10 pointer-events-none"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
        transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
        style={{ backgroundSize: '200% 200%' }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <FloatingElements count={20} />
      </div>

      {/* HERO SECTION */}
      <PageHero
        emoji='💃'
        titleWhite='Bachata'
        titleOrange={cityDisplayName}
        subtitle={`The most comprehensive calendar for Bachata classes, socials, and festivals in ${cityDisplayName}.`}
        largeTitle={true}
        hideBackground={true}
        floatingIcons={[Sparkles]}
        topPadding='pt-10'
      />

      {/* CITY STATS STRIP — fixed height to prevent CLS */}
      <div className="container mx-auto px-4 pb-4 min-h-[44px]">
        {stats.classesTonight > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-lg mx-auto">
            <Link
              to={citySlug ? `/${citySlug}/tonight` : '/tonight'}
              className="flex items-center gap-2 rounded-full bg-festival-blue/10 border border-festival-blue/20 px-4 py-2 text-sm font-medium text-festival-blue hover:bg-festival-blue/20 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              <span>{stats.classesTonight} class{stats.classesTonight !== 1 ? 'es' : ''} tonight</span>
            </Link>
          </div>
        )}
      </div>

      {/* EVENT CALENDAR */}
      <section className="py-8 min-h-[650px]">
        <div className="container mx-auto px-4">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[600px] w-full text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading calendar…</p>
            </div>
          }>
            <ErrorBoundary>
              <EventCalendar />
            </ErrorBoundary>
          </Suspense>
        </div>
      </section>

    </div>
    </PageErrorBoundary>
  );
};

export default Index;
