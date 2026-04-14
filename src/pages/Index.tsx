import React, { Suspense, lazy } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FloatingElements } from '@/components/FloatingElements';
import { useCity } from '@/contexts/CityContext';

// Lazy load the heavy calendar component
const EventCalendar = lazy(() => import('@/components/EventCalendar').then(module => ({ default: module.EventCalendar })));

const Index = () => {
  const { citySlug } = useCity();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  const cityDisplayName = citySlug
    ? citySlug.split('-')[0].replace(/^\w/, (c) => c.toUpperCase())
    : 'Your City';
  const heroCityName = cityDisplayName;
  const calendarCityName = cityDisplayName;

  return (
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
      
      {/* 1. HERO SECTION - High performance, no heavy JS animations */}
      <PageHero
        emoji='💃'
        titleWhite='Bachata'
        titleOrange={heroCityName}
        subtitle={`The most comprehensive calendar for Bachata classes, socials, and festivals in ${calendarCityName}.`}
        largeTitle={true}
        hideBackground={true}
        floatingIcons={[Sparkles]}
        topPadding='pt-20'
      />
      


      {/* EVENT CALENDAR */}
      <section className="py-8 min-h-[600px]">
        <div className="container mx-auto px-4">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[400px] w-full text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading calendar...</p>
            </div>
          }>
            <ErrorBoundary>
              <EventCalendar />
            </ErrorBoundary>
          </Suspense>
        </div>
      </section>



    </div>
  );
};

export default Index;


