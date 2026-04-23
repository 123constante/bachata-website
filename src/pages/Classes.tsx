import { Star, Sparkles } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { EventCalendar } from '@/components/EventCalendar';

const Classes = () => {
  return (
    <GlobalLayout
      breadcrumbs={[{ label: 'Classes' }]}
      hero={{
        emoji: '🎓',
        titleWhite: 'Learn',
        titleOrange: 'Bachata',
        floatingIcons: [Star, Sparkles],
      }}
    >
      {/* Class Schedule */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="classes" />
      </section>
    </GlobalLayout>
  );
};

export default Classes;
