import { Music, Sparkles } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { EventCalendar } from '@/components/EventCalendar';

const Parties = () => {
  return (
    <PageLayout
      emoji="🎉"
      titleWhite="Find Your"
      titleOrange="Next Party"
      breadcrumbLabel="Parties"
      floatingIcons={[Music, Sparkles]}
    >
      {/* What's On Section */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="parties" />
      </section>
    </PageLayout>
  );
};

export default Parties;
