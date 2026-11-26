import { Star, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { EventCalendar } from '@/components/EventCalendar';
import ListingIntro from '@/components/listing/ListingIntro';
import { resolvePageCity } from '@/lib/pageCity';
import LiveEventsSection from '@/components/seo/LiveEventsSection';

/**
 * `serverTodayKey` comes only from the framework route for bare /classes, whose
 * loader dehydrates the London "this week" list (site structure S2c). Its
 * presence is what renders the server list below the calendar: the catchall
 * also renders this page for /city/:slug/classes with NO loader, so there the
 * section is left out rather than fetched client-side.
 */
const Classes = ({ serverTodayKey }: { serverTodayKey?: string }) => {
  // Only a /city/:slug URL names the city: bare /classes stays London (its
  // server HTML never meets a stored city at hydration).
  const { slug } = useParams<{ slug?: string }>();
  const city = resolvePageCity(slug);
  useSeo(buildSeoForRoute('classes', { cityDisplay: city.name }));
  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('classes')}
      hero={{
        emoji: '🎓',
        titleWhite: 'Learn',
        titleOrange: 'Bachata',
        floatingIcons: [Star, Sparkles],
      }}
    >
      {city.isLondon ? (
        <ListingIntro>
          Bachata classes for every level in London - beginners' courses,
          intermediate drops, sensual and Dominican specialisations, intensives and
          workshops. Most rooms rotate partners so you can come on your own.
          Never danced before? Read our{' '}
          <Link to="/learn-bachata-london" className="text-primary underline">
            beginner&rsquo;s guide to learning bachata in London
          </Link>
          . Or browse{' '}
          <Link to="/teachers" className="text-primary underline">
            teachers by style
          </Link>
          .
        </ListingIntro>
      ) : (
        <ListingIntro>
          Bachata classes for every level in {city.name} - beginners&rsquo; courses,
          drop-ins, workshops and intensives. Most rooms rotate partners so you can
          come on your own.
        </ListingIntro>
      )}

      {/* Class Schedule */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="classes" />
      </section>

      {serverTodayKey !== undefined && city.isLondon ? (
        <div className="px-4 mb-8">
          <LiveEventsSection
            id="this-week"
            heading="Bachata classes in London this week"
            classesOnly
            serverTodayKey={serverTodayKey}
            emptyText="Nothing listed in the next seven days yet &mdash; the calendar above shows every date."
          />
        </div>
      ) : null}
    </GlobalLayout>
  );
};

export default Classes;
