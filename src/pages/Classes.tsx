import { Star, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { EventCalendar } from '@/components/EventCalendar';
import ListingIntro from '@/components/listing/ListingIntro';
import { usePageCity } from '@/hooks/usePageCity';

const Classes = () => {
  // urlOnly: bare /classes is prerendered and stays London.
  const city = usePageCity({ urlOnly: true });
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
          . Want the full picture? See the{' '}
          <Link to="/london-bachata-guide" className="text-primary underline">
            London bachata guide
          </Link>{' '}
          or browse{' '}
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
    </GlobalLayout>
  );
};

export default Classes;
