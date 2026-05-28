import { Star, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { EventCalendar } from '@/components/EventCalendar';
import ListingIntro from '@/components/listing/ListingIntro';

const Classes = () => {
  useSeo(buildSeoForRoute('classes'));
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
      <ListingIntro>
        Bachata classes for every level in London - beginners' courses,
        intermediate drops, sensual and Dominican specialisations, intensives and
        workshops. Drop-ins typically run &pound;10-&pound;18 and most rooms
        rotate partners so you can come on your own. Want to start from scratch?
        See the{' '}
        <Link to="/london-bachata-guide" className="text-primary underline">
          London bachata guide
        </Link>{' '}
        or browse{' '}
        <Link to="/teachers" className="text-primary underline">
          teachers by style
        </Link>
        .
      </ListingIntro>

      {/* Class Schedule */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="classes" />
      </section>
    </GlobalLayout>
  );
};

export default Classes;
