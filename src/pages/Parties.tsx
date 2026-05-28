import { Music, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { EventCalendar } from '@/components/EventCalendar';
import ListingIntro from '@/components/listing/ListingIntro';

const Parties = () => {
  useSeo(buildSeoForRoute('parties'));
  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('parties')}
      hero={{
        emoji: '🎉',
        titleWhite: 'Find Your',
        titleOrange: 'Next Party',
        floatingIcons: [Music, Sparkles],
      }}
    >
      <ListingIntro>
        Every regular bachata social, party and weekly room in London - browse by
        night, find your local, see who's playing. The calendar is updated weekly
        from organisers across the city. New here? Start with the{' '}
        <Link to="/london-bachata-guide" className="text-primary underline">
          London bachata guide
        </Link>{' '}
        or check{' '}
        <Link to="/tonight" className="text-primary underline">
          what's on tonight
        </Link>
        .
      </ListingIntro>

      {/* What's On Section */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="parties" />
      </section>
    </GlobalLayout>
  );
};

export default Parties;
