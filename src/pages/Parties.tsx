import { Music, Sparkles } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { EventCalendar } from '@/components/EventCalendar';

const Parties = () => {
  return (
    <GlobalLayout
      breadcrumbs={[{ label: 'Parties' }]}
      hero={{
        emoji: '🎉',
        titleWhite: 'Find Your',
        titleOrange: 'Next Party',
        floatingIcons: [Music, Sparkles],
      }}
    >
      {/* What's On Section */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="parties" />
      </section>
    </GlobalLayout>
  );
};

export default Parties;
