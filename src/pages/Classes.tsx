import { Star, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { EventCalendar } from '@/components/EventCalendar';
import ListingIntro from '@/components/listing/ListingIntro';
import { resolvePageCity } from '@/lib/pageCity';
import LiveEventsSection from '@/components/seo/LiveEventsSection';
import ClassesTwoDoors from '@/components/seo/classes/ClassesTwoDoors';
import { flags } from '@/lib/featureFlags';

/**
 * `serverTodayKey` comes only from the framework route for bare /classes, whose
 * loader dehydrates the London "this week" list (site structure S2c). Its
 * presence is what renders the server list: the catchall also renders this
 * page for /city/:slug/classes with NO loader, so there the section is left
 * out rather than fetched client-side.
 *
 * London reads like a news article (owner picks, SEO arc 2026-11-27): heading
 * "Bachata classes in London", a two-line standfirst, the week's classes by
 * day with an "Updated" line, then the full calendar. City pages change the
 * heading only.
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
        titleWhite: 'Bachata classes',
        titleOrange: `in ${city.name}`,
        floatingIcons: [Star, Sparkles],
      }}
    >
      {city.isLondon ? (
        <ListingIntro>
          Every bachata class in London this week, for beginners to advanced
          dancers. Most classes rotate partners, so you can come on your own.
          <br />
          New to bachata?{' '}
          <Link to="/learn-bachata-london" className="text-primary underline">
            Start here
          </Link>
          . Or{' '}
          <Link to="/teachers" className="text-primary underline">
            find a teacher by style
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

      {serverTodayKey !== undefined && city.isLondon && flags.classesTwoDoors ? (
        // Two doors (owner pick C 2026-11-27): owns the list, FAQ, by-day links,
        // the calendar section and "More in London". Flag off = the block below.
        <ClassesTwoDoors serverTodayKey={serverTodayKey} calendar={<EventCalendar defaultCategory="classes" />} />
      ) : serverTodayKey !== undefined && city.isLondon ? (
        <div className="px-4 mb-6">
          <LiveEventsSection
            id="this-week"
            heading="This week"
            classesOnly
            groupByDay
            limit={Infinity}
            updatedLine={(n) => `${n} ${n === 1 ? 'class' : 'classes'} this week`}
            serverTodayKey={serverTodayKey}
            emptyText="Nothing listed in the next seven days yet &mdash; the calendar below shows every date."
          />
        </div>
      ) : null}

      {/* Class Schedule */}
      {serverTodayKey !== undefined && city.isLondon && flags.classesTwoDoors ? null : (
        <section id="calendar" className="px-4 mb-8">
          {city.isLondon ? <h2 className="text-2xl font-bold mb-3">Full class calendar</h2> : null}
          <EventCalendar defaultCategory="classes" />
        </section>
      )}
    </GlobalLayout>
  );
};

export default Classes;
